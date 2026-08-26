# Internal APIs Catalogue

D-96/D-97: `sourcerer/shell/SourcererAPI.sys.mjs` is the **only** file in
`sourcerer/` permitted to reach a Firefox internal. Every row below is one
distinct occurrence of a forbidden pattern (`Services.*`, `Cc`/`Ci`/`Cr`/`Cu`,
XPCOM constructors, `AppConstants`, an unqualified `ChromeUtils.import*`) as
enumerated by `scripts/check-internals-boundary.sh`'s own
`FORBIDDEN_PATTERNS` array, run in `--catalogue` mode directly against
`SourcererAPI.sys.mjs` (the one file the default `--quick`/full scan
excludes). The rule is written once in that script; this document is derived
from it, not maintained beside it — `check-internals-boundary.sh --catalogue`
fails on any occurrence with no matching row here, naming the uncatalogued
`file:line`.

One row = one touchpoint + why, the same discipline
`sourcerer/endpoint-allowlist.json` already uses for network hosts.

## Touchpoints

| Internal | File:Line | `SourcererAPI` Method | Purpose | Threat Notes |
|---|---|---|---|---|
| `resource://gre/modules/Subprocess.sys.mjs` (`ChromeUtils.defineESModuleGetters`) | `SourcererAPI.sys.mjs:15` | *(module-level lazy import, backs `spawnProcess`/`pathSearch`)* | Lazy-imports Firefox's `Subprocess` module, the platform primitive `spawnProcess`/`pathSearch` wrap to launch and locate the Theia backend. | **Process-spawn row.** The spawned backend runs unprivileged but with the user's own file access. Phase 2's **D-29** already records that `@theia/ai-terminal`'s backend `ShellExecutionServer` calls `spawn(command, [], { shell: true })` with **no permission logic** — all approval machinery is frontend-only — so Theia's AI terminal is an arbitrary-execution surface reachable the moment the page loads. The sidecar's per-launch token gate (see the cookie row below) is the sole guard against reaching that surface from off-host. |
| `Services.prefs.getStringPref` | `SourcererAPI.sys.mjs:26` | `getStringPref` | Reads a string pref (sidecar config: `nodePath`, `backendMain`), never throwing — returns the caller's fallback on any error. | None — local config read, no externally-controlled input. |
| `Services.prefs.getIntPref` | `SourcererAPI.sys.mjs:38` | `getIntPref` | Reads an int pref (sidecar timeouts/intervals/log-buffer size), never throwing. | None — local config read, no externally-controlled input. |
| `Services.env.get` | `SourcererAPI.sys.mjs:46` | `getEnv` | Reads an environment variable used to help resolve sidecar paths. | None — host-controlled, feeds only `spawnProcess`'s environment, no network input. |
| `Services.cookies.add` | `SourcererAPI.sys.mjs:72` | `setSessionCookie` | Mints the per-launch `SOURCERER_TOKEN` session cookie that gates every plain-HTTP route on the backend (D-99: `secure=false` is deliberate — the sidecar is loopback HTTP, and a secure cookie would never be sent). | **Cookie row.** The token gates HTTP and the WebSocket upgrade, but Phase 2's **D-66** records that the WS origin validator returns `true` when the `Origin` header is absent entirely — so anything that can reach `127.0.0.1:PORT` and omit `Origin` bypasses that check, and the token is the only real barrier left. The token itself is a pure function of the environment (no re-handshake needed across a respawn, D-104), so its secrecy is what stands between a co-resident process and the backend. |
| `Ci.nsICookie.SAMESITE_STRICT` | `SourcererAPI.sys.mjs:82` | `setSessionCookie` | `SameSite=Strict` constant applied to the token cookie. | Same cookie-row note as `SourcererAPI.sys.mjs:72` above (D-66) — this constant is part of the one cookie-mint call. |
| `Ci.nsICookie.SCHEME_HTTP` | `SourcererAPI.sys.mjs:83` | `setSessionCookie` | Cookie-scheme constant permitting the token cookie over plain HTTP, matching D-99's loopback-HTTP rationale. | Same cookie-row note as `SourcererAPI.sys.mjs:72` above (D-66). |
| `Cc["@mozilla.org/timer;1"]` / `Ci.nsITimer` | `SourcererAPI.sys.mjs:135` | `sleep` | Platform one-shot timer backing the supervisor's health-loop delay — a `sys.mjs` module's global scope has no `setTimeout`, confirmed against multiple in-tree modules that either import `Timer.sys.mjs` or hand-roll it with `nsITimer`. | None — no externally-controlled input, purely an internal timing primitive. |
| `Ci.nsITimer.TYPE_ONE_SHOT` | `SourcererAPI.sys.mjs:139` | `sleep` | Timer-type constant for the one-shot delay, part of the same `sleep` call. | None — see `SourcererAPI.sys.mjs:135` above. |
| `Services.obs.addObserver` | `SourcererAPI.sys.mjs:180` | `onQuitGranted` | Registers `TheiaService`'s shutdown hook on `quit-application-granted` — the final, non-cancellable quit topic. | **Quit-observer row.** If the browser is force-killed (`SIGKILL`, a crash, `kill -9`) rather than quit normally, this observer never fires and the spawned backend receives no signal at all, leaving an orphaned process. This gap is explicitly out of this phase's scope and is named here rather than discovered later: it is Phase 5's **SIDE-04** (zero orphaned processes after `SIGKILL`, process-group kill semantics plus startup cleanup of leftovers). |
| `Services.obs.removeObserver` | `SourcererAPI.sys.mjs:181` | `onQuitGranted` | Unregisters the quit observer via the unsubscribe function `onQuitGranted` returns. | Same quit-observer note as `SourcererAPI.sys.mjs:180` above (Phase 5 SIDE-04). |

## Deliberately not touched

| Internal | Reason |
|---|---|
| Firefox's session store (`sessionstore.jsonlz4`, `SessionStore.sys.mjs`) | **D-107:** Phase 4 introduces no persistence of its own — port, PID, token, and the supervisor's log buffer are all per-launch, in-memory state; nothing writes session files, and no dependence on Firefox's SessionStore is added. **D-108:** naming it here, un-touched, keeps the storage ground clean for the future unified SQL store (SEED-001, dormant this milestone), whose first real consumer (the chrome-owned TabModel) is post-4.0. |

## Consistency

Enforced by `scripts/check-internals-boundary.sh --catalogue`, run as the
`internals-catalogue` check in `scripts/verify-phase-04.sh`'s `--quick` set.
It re-derives the occurrence list above straight from
`SourcererAPI.sys.mjs` using the guard script's own `FORBIDDEN_PATTERNS`
enumeration and fails on any occurrence whose `file:line` has no matching
row here — the two can never silently drift apart. `--self-test` proves the
check can go red on both a planted boundary violation and a planted removal
from this document.
