/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * D-96: TheiaService is a *consumer* of the SourcererAPI boundary, not a
 * second one -- it imports nothing else. Supervises the Theia backend
 * sidecar: mint token -> resolve sidecar location -> spawn -> watch stdout
 * for the ready sentinel -> health-gate -> set cookie -> swap (Task 1);
 * steady-state health loop with pinned-port restart and backoff (Task 2);
 * bounded quit and the D-106 ring buffer accessors (Task 3). Every field
 * below is per-launch, in-memory state only (D-107) -- nothing here writes
 * a file.
 */

const { SourcererAPI } = ChromeUtils.importESModule("chrome://sourcerer/content/SourcererAPI.sys.mjs");

const HEALTH_PATH = "/sourcerer/health";

export const TheiaService = {
  // Per-launch state (D-104): minted/resolved once, reused across every
  // restart within this browser session.
  _token: null,
  _port: null,
  _pid: null,
  _proc: null,
  _browserElement: null,
  _nodePath: null,
  _backendMain: null,
  _configDir: null,
  _swapped: false,
  _shuttingDown: false,

  // D-106 ring buffer: bounded, in-memory, mirrored to the console as each
  // line arrives (see _pushLog / _pumpOutput below).
  _log: [],

  /**
   * Launch sequence for the first spawn of this browser session: resolve
   * the sidecar, spawn it on port 0, wait for the ready sentinel and a
   * passing health probe, set the token cookie, then swap the browser
   * element onto the backend's URL. Window show never waited on this --
   * sourcerer.js already wrote SOURCERER_SHELL_READY before calling here.
   */
  async start(browserElement) {
    this._browserElement = browserElement;
    this._token = crypto.randomUUID();

    if (!(await this._resolveSidecar())) {
      return;
    }

    this._configDir = this._resolveConfigDir();
    await SourcererAPI.ensureDirectory(this._configDir);

    await this._spawnAndGate(/* firstSpawn */ true);
  },

  async _resolveSidecar() {
    this._backendMain = SourcererAPI.getStringPref("sourcerer.sidecar.backendMain", "");
    if (!this._backendMain) {
      this._fatal("sourcerer.sidecar.backendMain is unset -- cannot locate the Theia backend entry file.");
      return false;
    }

    const configured = SourcererAPI.getStringPref("sourcerer.sidecar.nodePath", "");
    this._nodePath = configured || (await SourcererAPI.pathSearch("node"));
    if (!this._nodePath) {
      this._fatal("Could not resolve a Node executable -- set sourcerer.sidecar.nodePath or add node to PATH.");
      return false;
    }

    return true;
  },

  _resolveConfigDir() {
    const xdg = SourcererAPI.getEnv("XDG_CONFIG_HOME");
    const home = SourcererAPI.getEnv("HOME");
    const base = xdg || `${home}/.config`;
    return `${base}/sourcerer`;
  },

  /**
   * Spawns the backend and waits for it to become healthy.
   * `firstSpawn: true` requests port 0 (SIDE-01) -- the only place a zero
   * port appears in this file. Every later call (Task 2's restart path)
   * passes the already-pinned `this._port`, because the already-loaded
   * Theia page reconnects to the origin it was loaded from (D-104).
   */
  async _spawnAndGate(firstSpawn) {
    const port = firstSpawn ? 0 : this._port;
    const args = [this._backendMain, "--hostname", "127.0.0.1", "--port", String(port)];
    const environment = {
      SOURCERER_TOKEN: this._token,
      THEIA_CONFIG_DIR: this._configDir,
      VSX_REGISTRY_URL: "https://open-vsx.org",
    };

    let proc;
    try {
      proc = await SourcererAPI.spawnProcess({ command: this._nodePath, args, environment });
    } catch (err) {
      this._fatal(`Failed to spawn the backend: ${err.message}`);
      return false;
    }
    this._proc = proc;

    if (this._shuttingDown) {
      await this._reap();
      return false;
    }

    const pinnedPort = firstSpawn ? null : this._port;
    const readyPromise = this._pumpOutput(proc, pinnedPort);
    const startupTimeoutMs = SourcererAPI.getIntPref("sourcerer.sidecar.startupTimeoutMs", 90000);

    let ready;
    try {
      ready = await Promise.race([
        readyPromise,
        SourcererAPI.sleep(startupTimeoutMs).then(() => null),
      ]);
    } catch (err) {
      this._fatal(`Backend output stream ended before announcing readiness: ${err.message}`);
      return false;
    }

    if (!ready) {
      this._fatal(`Backend did not announce SOURCERER_BACKEND_READY within ${startupTimeoutMs}ms.`);
      return false;
    }

    this._port = ready.port;
    this._pid = ready.pid;

    const healthIntervalStartupMs = SourcererAPI.getIntPref("sourcerer.sidecar.healthIntervalStartupMs", 250);
    const healthTimeoutMs = SourcererAPI.getIntPref("sourcerer.sidecar.healthTimeoutMs", 4000);
    const healthy = await this._pollUntilHealthy(startupTimeoutMs, healthIntervalStartupMs, healthTimeoutMs);
    if (!healthy) {
      this._fatal(`Health probe on port ${this._port} never returned 200 within ${startupTimeoutMs}ms.`);
      return false;
    }

    if (firstSpawn) {
      SourcererAPI.setSessionCookie({
        host: "127.0.0.1",
        path: "/",
        name: "SOURCERER_TOKEN",
        value: this._token,
      });
      this._swap();
    } else {
      this._pushLog(`Recovered on port ${this._port}, pid ${this._pid}.`);
    }

    return true;
  },

  /**
   * Reads both output pipes in a loop for the lifetime of `proc`, pushing
   * every line into the ring buffer and mirroring it to the console. Keeps
   * running after the ready sentinel is found (the returned promise settles
   * once, but the pumps themselves are not stopped) so ongoing backend
   * output during the steady state and any later restart also lands in the
   * log. Resolves `{port, pid}` parsed from the SOURCERER_BACKEND_READY
   * line; rejects if both pipes close without ever finding it.
   *
   * `pinnedPort`, when non-null, is D-104's restart invariant: a
   * respawn's sentinel reporting a different port is a hard error, logged
   * loudly, never silently followed -- the loop keeps waiting rather than
   * resolving with the wrong port.
   */
  _pumpOutput(proc, pinnedPort) {
    let settled = false;
    let resolveReady;
    let rejectReady;
    const readyPromise = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const handleLine = line => {
      this._pushLog(line);
      SourcererAPI.log("log", line);

      if (settled || !line.startsWith("SOURCERER_BACKEND_READY")) {
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(line.slice("SOURCERER_BACKEND_READY".length).trim());
      } catch {
        return;
      }
      if (typeof parsed.port !== "number" || typeof parsed.pid !== "number") {
        return;
      }
      if (pinnedPort !== null && parsed.port !== pinnedPort) {
        this._fatal(
          `Respawn reported port ${parsed.port}, but this browser session is pinned to port ${pinnedPort} -- refusing to follow a moved port (D-104).`
        );
        return;
      }
      settled = true;
      resolveReady(parsed);
    };

    const pump = async which => {
      let pending = "";
      for (;;) {
        let chunk;
        try {
          chunk = await SourcererAPI.readPipeChunk(proc, which);
        } catch {
          break;
        }
        if (chunk === null) {
          break;
        }
        pending += chunk;
        let idx;
        while ((idx = pending.indexOf("\n")) !== -1) {
          handleLine(pending.slice(0, idx));
          pending = pending.slice(idx + 1);
        }
      }
      if (pending) {
        handleLine(pending);
      }
    };

    Promise.all([pump("stdout"), pump("stderr")]).then(() => {
      if (!settled) {
        rejectReady(new Error("backend output stream ended"));
      }
    });

    return readyPromise;
  },

  async _pollUntilHealthy(overallTimeoutMs, intervalMs, requestTimeoutMs) {
    const deadline = Date.now() + overallTimeoutMs;
    for (;;) {
      if (await this._probeHealth(requestTimeoutMs)) {
        return true;
      }
      if (Date.now() >= deadline) {
        return false;
      }
      await SourcererAPI.sleep(intervalMs);
    }
  },

  _probeHealth(timeoutMs) {
    const url = `http://127.0.0.1:${this._port}${HEALTH_PATH}`;
    return SourcererAPI.probeHealth(url, this._token, timeoutMs);
  },

  /**
   * Hides the loading layer and navigates the browser element exactly
   * once, via sourcerer.js's own exposed function (reached through the
   * browser element's owner window, not a Firefox-internal import).
   */
  _swap() {
    if (this._swapped) {
      return;
    }
    this._swapped = true;
    this._browserElement.ownerGlobal.sourcererSwapToUrl(`http://127.0.0.1:${this._port}/`);
  },

  _fatal(message) {
    this._pushLog(`FATAL: ${message}`);
    SourcererAPI.log("error", `[TheiaService] ${message}`);
  },

  _pushLog(line) {
    const max = SourcererAPI.getIntPref("sourcerer.sidecar.logBufferLines", 500);
    this._log.push(line);
    while (this._log.length > max) {
      this._log.shift();
    }
  },
};
