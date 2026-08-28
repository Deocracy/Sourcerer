---
phase: 05-lifecycle-failure-hardening
reviewed: 2026-08-28T03:30:20Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - scripts/verify-branding-identity.mjs
  - scripts/verify-phase-05.sh
  - sourcerer/INTERNAL-APIS.md
  - sourcerer/shell/SourcererAPI.sys.mjs
  - sourcerer/shell/TheiaService.sys.mjs
  - sourcerer/shell/components.conf
  - sourcerer/shell/moz.build
  - sourcerer/shell/sourcerer-sidecar.js
  - sourcerer/shell/sourcerer.css
  - sourcerer/shell/sourcerer.js
  - sourcerer/shell/sourcerer.xhtml
  - theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts
  - theia/extensions/token-gate/src/node/token-gate-backend-module.ts
findings:
  critical: 1
  high: 0
  medium: 2
  low: 2
  total: 5
status: issues_found
---

# Phase 5: Code Review Report — Lifecycle & Failure Hardening

**Reviewed:** 2026-08-28T03:30:20Z
**Depth:** deep (cross-file trace: TheiaService ↔ SourcererAPI ↔ verify-phase-05.sh ↔ the watchdog contribution)
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The bare-pid `kill(2)` / `/proc/<pid>/stat` identity-verification path (D-111) is sound: the last-`)` parsing correctly handles a `comm` field containing spaces or parentheses, the writer (`_spawnAndGate`) and reader (`_reapLeftover`, `wait_pid_gone_or_zombie`'s shell-side twin) agree on the exact same field offset, and a pid is never signalled without an exact start-ticks string match first. The `SOURCERER_SUPERVISED` gate correctly protects `yarn start`/`smoke-theia.sh`/`verify-phase-04.sh`. The single-instance handler is inert on first launch and on a different-profile launch, reads no argument, and cannot leave a second window open. The error/diagnostics sentinels are deliberately narrow (`{reason, recoverable}` / port+pid+health+counts, never the token) and use `textContent`, never `innerHTML`.

One finding is a genuine correctness bug reachable through a scenario this very phase's own test suite (SIDE-05) validates as supported: **the sidecar state file is not scoped to the Firefox profile**, so two concurrently-running Sourcerer instances under different profiles share one `sidecar-state.json` and the second instance's startup reap logic will send `SIGTERM` to the first instance's live, healthy backend. The remaining findings are narrower robustness/defense-in-depth gaps, not exploitable on their own.

## Critical Issues

### CR-01: Sidecar state file is shared across concurrently-running instances with different profiles — one instance's startup can SIGTERM another's live backend

**File:** `sourcerer/shell/TheiaService.sys.mjs:215-220` (`_resolveConfigDir`), `sourcerer/shell/TheiaService.sys.mjs:107` (`_stateFilePath` derivation), `sourcerer/shell/TheiaService.sys.mjs:236-285` (`_reapLeftover`)

**Issue:** `_resolveConfigDir()` derives the config directory purely from `XDG_CONFIG_HOME`/`HOME`:

```js
_resolveConfigDir() {
  const xdg = SourcererAPI.getEnv("XDG_CONFIG_HOME");
  const home = SourcererAPI.getEnv("HOME");
  const base = xdg || `${home}/.config`;
  return `${base}/sourcerer`;
},
```

This is completely independent of the Firefox `--profile` path. `sourcerer/shell/moz.build`/`SourcererAPI.sys.mjs` confirm there is no other input (no `Services.dirsvc`/profile-derived component) folded into this path anywhere in the phase. Every Sourcerer instance launched by the same OS user — regardless of which `--profile` it was started with — therefore reads and writes the exact same `~/.config/sourcerer/sidecar-state.json`.

05-04-SUMMARY.md explicitly validates (D3) that "a launch naming a DIFFERENT profile still gets its own window and its own distinct backend pid" — i.e., running two profiles concurrently is a supported, tested scenario, not an accident. Trace what happens when it occurs:

1. Instance A (profile A) starts, spawns backend pid X, and writes `{pid: X, port, startTicks, writtenAt}` to the shared state file.
2. Instance B (profile B, same `$HOME`) starts. Firefox's remoting is profile-keyed, so B is a genuinely separate OS process — the single-instance handler (`SourcererSingleInstanceHandler`) never intercepts it, and B runs its own `start()` → `_reapLeftover()`.
3. `_reapLeftover()` reads the *shared* state file, finds pid X, confirms it is alive (it is — Instance A is healthy), reads its `/proc/X/stat` start ticks (they match exactly, because it genuinely is the same process the file describes), and concludes this is "a verified-identity leftover" — then sends it `SIGTERM`.
4. Instance A's live, healthy backend is killed by Instance B's startup, even though nothing about Instance A crashed or was left over.

The verify-phase-05.sh SIDE-05 checks (`check_side05_no_second_backend`'s positive control) never exercise this because they always `stop_shell_display` the first instance (which removes the state file on clean stop) *before* starting the different-profile control instance — so the two never run in the shared-state-file window at the same time. That timing gap in the test harness is why this went uncaught, not evidence that the underlying design is safe.

**Fix:** Scope `_configDir`/`_stateFilePath` (and, ideally, `THEIA_CONFIG_DIR`, though that pre-dates this phase and is a larger change) to the profile actually in use, e.g. derive a stable per-profile suffix from `Services.dirsvc.get("ProfD", Ci.nsIFile).path` (would need a new `SourcererAPI` accessor, catalogued per D-96/D-97) and key the state file path on it:

```js
_resolveConfigDir() {
  const xdg = SourcererAPI.getEnv("XDG_CONFIG_HOME");
  const home = SourcererAPI.getEnv("HOME");
  const base = xdg || `${home}/.config`;
  const profileKey = SourcererAPI.getProfileKey(); // e.g. a short hash of ProfD's path
  return `${base}/sourcerer/${profileKey}`;
},
```
At minimum, `_reapLeftover()` should refuse to signal a recorded pid unless the state file also records *this launch's own profile path* and it matches — so a healthy, differently-profiled instance's record is recognized as "not mine" rather than "a verified leftover."

## Medium Issues

### MED-01: `SOURCERER_SUPERVISED=1` is never cleared after being read, and propagates to every process the backend later spawns

**File:** `theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts:24-37`, `sourcerer/shell/TheiaService.sys.mjs:325-346`

**Issue:** `_spawnAndGate()`'s environment object is applied with `environmentAppend: true` (`SourcererAPI.spawnProcess`, `SourcererAPI.sys.mjs:177-185`), which merges onto the *parent* (browser) process's own environment rather than replacing it. `SOURCERER_SUPERVISED: "1"` therefore lands in the spawned Theia backend's `process.env` — and, by ordinary Node `child_process` env-inheritance defaults, in the env of *every subprocess that backend itself later spawns* (a user's integrated terminal, a task runner, `npm`/`yarn` invoked from a terminal, a debug adapter, …), none of which the watchdog intends to arm.

The same file demonstrates the authors are aware of this exact inheritance hazard — `SOURCERER_TOKEN_DISABLE` is deliberately reset to `""` in the same environment object specifically because `environmentAppend: true` would otherwise leak it in from the launching shell (see the comment at `TheiaService.sys.mjs:338-345`). `SOURCERER_SUPERVISED` gets no equivalent treatment: nothing clears or scopes it after the intended, single, direct child reads it.

Today this is latent rather than actively exploited — no other contribution in this repo reads `SOURCERER_SUPERVISED`. But it means the gate's only defense is "no one else currently checks this variable," not "this variable cannot reach an unintended process." A terminal spawned inside a supervised session, if it (directly or via a nested dev-shell invocation) starts a second Theia backend for testing, would inherit `SOURCERER_SUPERVISED=1` and arm ITS OWN parent-watchdog against that terminal's own stdin lifecycle — an unrelated signal, producing a surprising self-termination unconnected to the actual browser parent dying.

**Fix:** Have the watchdog consume the marker once observed, the same discipline `SOURCERER_TOKEN_DISABLE` already gets:
```ts
initialize(): void {
    if (process.env[SUPERVISED_ENV_VAR] !== '1') {
        return;
    }
    delete process.env[SUPERVISED_ENV_VAR]; // never re-armed by anything this process spawns
    process.stdin.resume();
    ...
```

### MED-02: Diagnostics/error surfaces render the full, unredacted backend stdout/stderr history

**File:** `sourcerer/shell/TheiaService.sys.mjs:704-710` (`_pumpOutput`'s `handleLine`, unconditional `this._pushLog(line)`), `sourcerer/shell/sourcerer.js:138` (`diagnosticsLogElement.textContent = log.join("\n")`)

**Issue:** Every line the backend writes to stdout or stderr — success or crash — is pushed into `TheiaService._log` (the ring buffer `getRecentLog()` exposes) with no filtering. The diagnostics layer (reachable via `Ctrl+Alt+Shift+D` or the error layer's Details control — SHELL-04, this phase) renders that entire buffer verbatim as text. The task brief for this phase explicitly calls out "confirm no credential, token, or path leaks into rendered output… the diagnostics surface must not weaken or expose \[the token gate\]." The code itself never logs `this._token` — that part is clean, and the `SOURCERER_DIAGNOSTICS`/`SOURCERER_SHELL_ERROR` sentinels are deliberately narrow (verified: `grep -c innerHTML sourcerer.js == 0`, field lists match the plan exactly). But there is no equivalent guarantee about the *raw backend output* itself: if the Node backend, any Theia extension, or a third-party dependency ever prints a stack trace, a startup banner, or a debug dump that includes `process.env` (which contains `SOURCERER_TOKEN`), that text flows straight into the ring buffer and is rendered on-screen with no redaction step.

This is not a proven active leak — it depends on backend/dependency behavior outside this diff's control — but it is a real gap relative to the stated requirement, and the diagnostics layer is new exposure surface introduced by this phase (the same log data existed before only in the process's own stdout, not in a reachable in-app UI panel).

**Fix:** Add a redaction pass before either buffering or rendering — at minimum, scrub any line containing the literal token value or the string `SOURCERER_TOKEN=`:
```js
_pushLog(line) {
  const redacted = this._token ? line.replaceAll(this._token, "[redacted]") : line;
  ...
}
```

## Low Issues

### LOW-01: Verified-identity reap still has an inherent (documented-away, but real) TOCTOU window between the ticks check and the `SIGTERM`

**File:** `sourcerer/shell/TheiaService.sys.mjs:249-262`

**Issue:** `_reapLeftover()` reads `readProcessStartTicks(record.pid)` (an `await`, i.e. a real yield point across an I/O call), compares it to the recorded value, and only then calls `SourcererAPI.signalBarePid(record.pid, SIGTERM)`. Between the ticks read and the signal, the OS is free to reap that pid and recycle it onto a new process. The window is narrow (no other code in this codebase races it), and clock-tick collision on a freshly-recycled pid is a low-probability event, but it is a structural TOCTOU inherent to the `kill(2)`-by-pid approach (a `pidfd`-based signal, which pins identity across the whole open-then-signal sequence, would close this categorically). Given the review brief specifically asked whether this check "cannot be bypassed" or "races benignly," this is worth naming even though it is not currently exploitable by anything in this repo.

**Fix:** Not blocking; note as an accepted limitation, or migrate to `pidfd_open`/`pidfd_send_signal` (Linux ≥5.1, matches the project's Linux-only constraint) if the risk profile changes.

### LOW-02: A transient `readProcessStartTicks` failure at spawn time permanently orphans that leftover on a later crash

**File:** `sourcerer/shell/TheiaService.sys.mjs:405-419` (state write), `sourcerer/shell/TheiaService.sys.mjs:249-259` (reap comparison)

**Issue:** `_spawnAndGate()` writes `startTicks: null` to the state file if `readProcessStartTicks` transiently fails at spawn time (e.g. a brief `/proc` read race). If that exact backend later crashes and leaves a real leftover, the next startup's `_reapLeftover()` compares the live process's real ticks string against the recorded `null` — always a mismatch — so it is classified as "recycled pid," never signalled, and the state file is simply deleted (via `_removeStateFileQuietly()`, which runs on every branch). The orphan process itself is never cleaned up; it just silently stops being tracked. Self-limiting (no accumulating false kills, no stale-record reuse) but a real, if narrow, robustness gap.

**Fix:** Not blocking. Could log a distinguishing "identity unknown, cannot reap" message so the gap is at least observable, or retry the ticks read once before falling back to `null`.

---

_Reviewed: 2026-08-28T03:30:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
