/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * D-96/D-97: the single anti-corruption layer. This is the ONLY file in
 * sourcerer/ permitted to reach a Firefox internal (Services, Cc/Ci/Cr/Cu,
 * Subprocess, the cookie manager, quit observers) -- every method below is
 * a thin named wrapper with no policy of its own, so the audit surface at
 * the next ESR rebase is exactly this file. Every touchpoint is catalogued
 * in sourcerer/INTERNAL-APIS.md (plan 04-05).
 */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
});

export const SourcererAPI = Object.freeze({
  /**
   * Reads a string pref, returning `fallback` (never throwing) when the
   * pref is unset or holds a different type.
   */
  getStringPref(name, fallback) {
    try {
      return Services.prefs.getStringPref(name, fallback);
    } catch {
      return fallback;
    }
  },

  /**
   * Reads an int pref, returning `fallback` (never throwing) when the pref
   * is unset or holds a different type.
   */
  getIntPref(name, fallback) {
    try {
      return Services.prefs.getIntPref(name, fallback);
    } catch {
      return fallback;
    }
  },

  /** Reads an environment variable. */
  getEnv(name) {
    return Services.env.get(name);
  },

  /** Creates `path` and its parents if absent; a no-op if it already exists. */
  ensureDirectory(path) {
    return IOUtils.makeDirectory(path);
  },

  /**
   * Resolves `command` against PATH, returning null (never throwing) when
   * it cannot be found.
   */
  async pathSearch(command) {
    try {
      return await lazy.Subprocess.pathSearch(command);
    } catch {
      return null;
    }
  },

  /**
   * Adds a session cookie for a plain-HTTP loopback host. D-99: secure is
   * always false -- the sidecar is loopback HTTP, and a secure cookie would
   * never be sent, silently defeating the whole mechanism.
   */
  setSessionCookie({ host, path, name, value }) {
    Services.cookies.add(
      host,
      path,
      name,
      value,
      /* aIsSecure */ false,
      /* aIsHttpOnly */ true,
      /* aIsSession */ true,
      /* aExpiry */ 0,
      /* aOriginAttributes */ {},
      Ci.nsICookie.SAMESITE_STRICT,
      Ci.nsICookie.SCHEME_HTTP,
      /* aIsPartitioned */ false
    );
  },

  /**
   * Spawns `command` with an explicit argument vector -- never through a
   * shell interpreter -- returning the process handle with stderr piped.
   */
  spawnProcess({ command, args, environment }) {
    return lazy.Subprocess.call({
      command,
      arguments: args,
      environment,
      stderr: "pipe",
    });
  },

  /**
   * Kills `proc`, waiting up to `graceMs` before escalating. A single call
   * to the platform's own kill(): it already sends SIGTERM, waits the
   * grace period, then SIGKILL -- do not hand-roll that sequence.
   */
  killProcess(proc, graceMs) {
    return proc.kill(graceMs);
  },

  /**
   * Reads the next available chunk of text from `proc`'s named output
   * pipe ("stdout" or "stderr"), resolving null at end of stream.
   */
  async readPipeChunk(proc, which) {
    const pipe = which === "stderr" ? proc.stderr : proc.stdout;
    const chunk = await pipe.readString();
    return chunk === "" ? null : chunk;
  },

  /**
   * Registers `callback` to fire once the quit decision is final and can
   * no longer be cancelled. Returns a function that unregisters it.
   */
  onQuitGranted(callback) {
    const observer = { observe: () => callback() };
    Services.obs.addObserver(observer, "quit-application-granted");
    return () => Services.obs.removeObserver(observer, "quit-application-granted");
  },

  /**
   * Mirrors one line to the browser console and to stdout, so the
   * supervisor's ring buffer and the verification harness read the same
   * stream.
   */
  log(level, message) {
    dump(`[SourcererAPI] ${level}: ${message}\n`);
    const fn = typeof console[level] === "function" ? console[level] : console.log;
    fn(message);
  },
});
