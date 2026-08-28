---
schema_version: 1
open_count: 6
waived_count: 0
fixed_count: 5
total_count: 11
last_updated: 2026-08-28T16:25:15.213Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | stub | theia/extensions/customize/src/browser/sourcerer-privileged-js.ts |  | SourcererPrivilegedJsSurface.tabUriRegistry is always undefined -- @sourcerer/tab-uris (Plan 06) does not exist yet in this plan's dependency chain; no plan currently wires it up. | open |  | 2026-08-21T01:39:11.591Z |  |
| 2 | 04 | unrun-verify | sourcerer/shell/sourcerer.xhtml |  | RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir. | fixed |  | 2026-08-26T22:15:58.074Z | 2026-08-27T00:57:31.545Z |
| 3 | 04 | unrun-verify | sourcerer/shell/TheiaService.sys.mjs |  | RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir. | fixed |  | 2026-08-26T22:32:50.525Z | 2026-08-27T00:57:31.748Z |
| 4 | 04 | unrun-verify | .planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md |  | RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir. | fixed |  | 2026-08-26T22:55:36.043Z | 2026-08-27T00:57:31.951Z |
| 5 | 04 | unmet-truth | sourcerer/endpoint-allowlist.json |  | verify-phase-03's verify-endpoints now FAILS: with the shell actually working, Gecko resolves three hosts absent from the BRAND-04 allowlist -- 127.0.0.1 (the Theia sidecar; expected, and the architecture), plus ciscobinary.openh264.org (GMP manager, now woken by a real content page being loaded) and github.com (reached by the Theia FRONTEND running inside the browser). Not a code defect: Phase 4 introduces a network surface the D-83..D-88 allowlist never contemplated. Each existing entry carries a reasoned decision, so adding these needs a product/privacy decision, not a mechanical edit. | open |  | 2026-08-27T00:59:23.344Z |  |
| 6 | 04 | unmet-truth | sourcerer/shell/sourcerer.xhtml |  | verify-phase-03's verify-branding-identity-dev now FAILS on its about-support surface only (all 5 other surfaces PASS; the release variant fully PASSES). The check reads branding from about:support via WebDriver, but the shell's single <browser> is pinned remoteType=web and about:support needs a privileged-about remote type. Consistent with v4.0 intent -- Theia is the only GUI, no URL bar, so about: pages are unreachable by design -- but the check needs a different mechanism (read branding chrome-side), or v4.0 accepts about: pages are unreachable until the post-4.0 tab model brings remote-type switching. Needs a decision. | fixed |  | 2026-08-27T00:59:23.557Z | 2026-08-28T02:19:50.352Z |
| 7 | 05 | unrun-verify | scripts/lib/firefox-marionette.mjs |  | Discriminator B (05-02 Task 1): chrome-side Marionette automation is blocked, not merely unverified. WebDriver:NewSession with capabilities.alwaysMatch['moz:windowless']=true does NOT skip the initial-application-window wait on Linux -- Capabilities.sys.mjs:708-720 gates windowless to AppInfo.isMac only, so the value is silently rejected/dropped and driver.sys.mjs:2450-2461 still calls Services.wm.getMostRecentBrowserWindow() (returns null for windowtype=sourcerer:main) then WindowManager.sys.mjs:586's waitForChromeWindowLoaded(null) throws 'TypeError: cant access property document, window is null', failing newSession with 'session not created'. Confirmed live: launched objdir/dist/bin/sourcerer --marionette --remote-allow-system-access on a real DISPLAY, connected via a raw length-prefixed JSON socket client, greeting exchanged correctly (applicationType:gecko, marionetteProtocol:3), WebDriver:NewSession is the exact command and error that failed. firefox-marionette.mjs was NOT created. Fallback: the Retry-button-click assertion (05-02 Task 3) and any other chrome-driven assertion route to the human record instead of an automated check. | open |  | 2026-08-28T01:33:56.593Z |  |
| 8 | 05 | unmet-truth | sourcerer/shell/sourcerer.xhtml |  | REGRESSION, now FIXED. Phase 5 hid both deck overlays with an inline style="display:none;" attribute (05-02 commit f944f5e for #sourcerer-error, 05-03 commit 339db40 for #sourcerer-diagnostics) while sourcerer.css gave both base rules display: flex. The shell document's own CSP (default-src chrome:, no style-src, no unsafe-inline; added in 04-03 commit f835f6e) drops inline style ATTRIBUTES as well as inline <style> elements, so the stylesheet won and BOTH overlays painted over a healthy Theia from startup -- the user saw a near-black window with an empty log box and a Close button, clicked Close and found the error layer underneath, then clicked Retry and the correctly-branded IDE appeared. Theia itself was never at fault (it reached ready in every launch log; SOURCERER_DIAGNOSTICS never appeared, proving no code ever showed the layers). Caught by the developer attempting 05-MANUAL-VERIFICATION.md Item C by hand, NOT by any automated gate: verify-phase-05.sh was 12/12 green and --gate PASS throughout, because nothing in this repo can observe the shell's own rendered chrome state -- BiDi's browsingContext tree contains only the content <browser>, so captureScreenshot photographs the healthy Theia UNDERNEATH two opaque chrome overlays, and chrome-context Marionette is platform-blocked (ledger entry 7). A secondary defect rode along: sourcerer.js decided toggle direction with diagnosticsElement.style.display !== "none", which reads empty string once the inert attribute is gone, so the first chord press would have hidden an already-hidden layer. FIXED in 014b0d9 (both attributes deleted, CSS base rules changed to display: none, toggle now reads window.getComputedStyle(el).display), def0143 (new shell-csp-inline-attrs static check, registered outside --quick, file list derived from jar.mn, self-tested against a known-bad fixture, proven red against the pre-fix markup) and b3a287d (new SOURCERER_DECK_STATE runtime sentinel, asserted all-none by verify-phase-04.sh shell05-paint-before-backend and asserted NOT-none by verify-phase-05.sh shell03-budget-exhausted-error as a positive control). The original bug reproduces on demand from the true pre-fix tree, which emits deck state error:flex diagnostics:flex. | fixed |  | 2026-08-28T16:24:56.911Z | 2026-08-28T16:24:59.575Z |
| 9 | 05 | fixme | theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts | 25 | OPEN code-review finding MED-01 (05-REVIEW.md), deliberately NOT fixed -- recorded so it is tracked rather than dropped. SOURCERER_SUPERVISED=1 is read by the watchdog but never deleted from process.env after arming, and TheiaService._spawnAndGate applies its environment with environmentAppend: true, so the marker inherits into every subprocess the Theia backend later spawns (integrated terminal, task runner, npm/yarn, debug adapter). The same environment object already resets SOURCERER_TOKEN_DISABLE for exactly this inheritance hazard; SOURCERER_SUPERVISED gets no equivalent treatment. Latent, not exploitable by anything in this repo today because nothing else reads the variable -- but that fact, not scoping, is the only defence. Fix: delete process.env[SUPERVISED_ENV_VAR] immediately after the arming check. | open |  | 2026-08-28T16:25:15.020Z |  |
| 10 | 05 | fixme | sourcerer/shell/TheiaService.sys.mjs | 326 | OPEN code-review finding MED-02 (05-REVIEW.md), deliberately NOT fixed -- recorded so it is tracked rather than dropped. _pumpOutput pushes every backend stdout/stderr line into the _log ring buffer with no redaction pass, and the diagnostics layer this phase introduced renders that entire buffer verbatim (sourcerer.js diagnosticsLogElement.textContent = log.join). The shell never logs this._token itself and the SOURCERER_* sentinels are proven token-free, but any backend, Theia extension or third-party dependency that prints process.env (which carries SOURCERER_TOKEN) flows unredacted into a now-reachable in-app UI panel -- new exposure surface introduced by SHELL-04, where previously the same text existed only in the process's own stdout. Fix: redact in _pushLog, at minimum line.replaceAll(this._token, [redacted]). | open |  | 2026-08-28T16:25:15.115Z |  |
| 11 | 05 | todo | sourcerer/shell/TheiaService.sys.mjs | 215 | OPEN housekeeping, deliberately NOT fixed. The CR-01 profile-scoping fix keys the sidecar state file on the profile path, so every distinct profile leaves its own ~/.config/sourcerer/sidecar-state-<profile>.json behind and nothing ever reaps them. 151 such files have accumulated in the real user config directory as of 2026-08-28 (counted: ls ~/.config/sourcerer/sidecar-state*.json), almost all from harness runs against mktemp profiles -- sidecar-state-_tmp_tmp_*.json and sidecar-state-_tmp_sourcerer_firefox_bidi_*.json. Harmless per file (a few bytes, read only if a matching profile path is ever relaunched) but test runs are littering a real user directory. Cheapest remedy: point XDG_CONFIG_HOME at the harness temp dir in verify-phase-05.sh's launch helpers so test runs never touch the real config dir at all -- TheiaService._resolveConfigDir already honours XDG_CONFIG_HOME ahead of HOME. Reaping stale files is a second, larger option. | open |  | 2026-08-28T16:25:15.213Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "02",
    "file": "theia/extensions/customize/src/browser/sourcerer-privileged-js.ts",
    "line": null,
    "description": "SourcererPrivilegedJsSurface.tabUriRegistry is always undefined -- @sourcerer/tab-uris (Plan 06) does not exist yet in this plan's dependency chain; no plan currently wires it up.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-21T01:39:11.591Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "sourcerer/shell/sourcerer.xhtml",
    "line": null,
    "description": "RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-26T22:15:58.074Z",
    "resolved_at": "2026-08-27T00:57:31.545Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "sourcerer/shell/TheiaService.sys.mjs",
    "line": null,
    "description": "RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-26T22:32:50.525Z",
    "resolved_at": "2026-08-27T00:57:31.748Z"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "04",
    "file": ".planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md",
    "line": null,
    "description": "RESOLVED / MISDIAGNOSED: this was never environmental. The RenderCompositorSWGL message appears identically on the untouched Phase-3 binary and is harmless noise; anchoring on it hid the real cause. sourcerer.xhtml was not well-formed XML (an XML comment cannot contain '--'), so the shell never parsed, sourcerer.js never ran and no backend was ever spawned. Five further defects sat behind it (CSP dropping the inline <style> -> 0x0 viewport; no root width/height; an already-expired cookie aExpiry -> 403; sleep() passing {observe} to initWithCallback -> stalled health loop; _swap() using ownerGlobal). Fixed in commits 1bceacd and b97cb5b; verify-phase-04.sh is now 10/10 and verify-phase-02.sh back to 5/5. The discriminator that settles it: a WebDriver BiDi session succeeds against objdir-release and failed against objdir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-26T22:55:36.043Z",
    "resolved_at": "2026-08-27T00:57:31.951Z"
  },
  {
    "id": 5,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "sourcerer/endpoint-allowlist.json",
    "line": null,
    "description": "verify-phase-03's verify-endpoints now FAILS: with the shell actually working, Gecko resolves three hosts absent from the BRAND-04 allowlist -- 127.0.0.1 (the Theia sidecar; expected, and the architecture), plus ciscobinary.openh264.org (GMP manager, now woken by a real content page being loaded) and github.com (reached by the Theia FRONTEND running inside the browser). Not a code defect: Phase 4 introduces a network surface the D-83..D-88 allowlist never contemplated. Each existing entry carries a reasoned decision, so adding these needs a product/privacy decision, not a mechanical edit.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T00:59:23.344Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "sourcerer/shell/sourcerer.xhtml",
    "line": null,
    "description": "verify-phase-03's verify-branding-identity-dev now FAILS on its about-support surface only (all 5 other surfaces PASS; the release variant fully PASSES). The check reads branding from about:support via WebDriver, but the shell's single <browser> is pinned remoteType=web and about:support needs a privileged-about remote type. Consistent with v4.0 intent -- Theia is the only GUI, no URL bar, so about: pages are unreachable by design -- but the check needs a different mechanism (read branding chrome-side), or v4.0 accepts about: pages are unreachable until the post-4.0 tab model brings remote-type switching. Needs a decision.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-27T00:59:23.557Z",
    "resolved_at": "2026-08-28T02:19:50.352Z"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "05",
    "file": "scripts/lib/firefox-marionette.mjs",
    "line": null,
    "description": "Discriminator B (05-02 Task 1): chrome-side Marionette automation is blocked, not merely unverified. WebDriver:NewSession with capabilities.alwaysMatch['moz:windowless']=true does NOT skip the initial-application-window wait on Linux -- Capabilities.sys.mjs:708-720 gates windowless to AppInfo.isMac only, so the value is silently rejected/dropped and driver.sys.mjs:2450-2461 still calls Services.wm.getMostRecentBrowserWindow() (returns null for windowtype=sourcerer:main) then WindowManager.sys.mjs:586's waitForChromeWindowLoaded(null) throws 'TypeError: cant access property document, window is null', failing newSession with 'session not created'. Confirmed live: launched objdir/dist/bin/sourcerer --marionette --remote-allow-system-access on a real DISPLAY, connected via a raw length-prefixed JSON socket client, greeting exchanged correctly (applicationType:gecko, marionetteProtocol:3), WebDriver:NewSession is the exact command and error that failed. firefox-marionette.mjs was NOT created. Fallback: the Retry-button-click assertion (05-02 Task 3) and any other chrome-driven assertion route to the human record instead of an automated check.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-28T01:33:56.593Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unmet-truth",
    "phase": "05",
    "file": "sourcerer/shell/sourcerer.xhtml",
    "line": null,
    "description": "REGRESSION, now FIXED. Phase 5 hid both deck overlays with an inline style=\"display:none;\" attribute (05-02 commit f944f5e for #sourcerer-error, 05-03 commit 339db40 for #sourcerer-diagnostics) while sourcerer.css gave both base rules display: flex. The shell document's own CSP (default-src chrome:, no style-src, no unsafe-inline; added in 04-03 commit f835f6e) drops inline style ATTRIBUTES as well as inline <style> elements, so the stylesheet won and BOTH overlays painted over a healthy Theia from startup -- the user saw a near-black window with an empty log box and a Close button, clicked Close and found the error layer underneath, then clicked Retry and the correctly-branded IDE appeared. Theia itself was never at fault (it reached ready in every launch log; SOURCERER_DIAGNOSTICS never appeared, proving no code ever showed the layers). Caught by the developer attempting 05-MANUAL-VERIFICATION.md Item C by hand, NOT by any automated gate: verify-phase-05.sh was 12/12 green and --gate PASS throughout, because nothing in this repo can observe the shell's own rendered chrome state -- BiDi's browsingContext tree contains only the content <browser>, so captureScreenshot photographs the healthy Theia UNDERNEATH two opaque chrome overlays, and chrome-context Marionette is platform-blocked (ledger entry 7). A secondary defect rode along: sourcerer.js decided toggle direction with diagnosticsElement.style.display !== \"none\", which reads empty string once the inert attribute is gone, so the first chord press would have hidden an already-hidden layer. FIXED in 014b0d9 (both attributes deleted, CSS base rules changed to display: none, toggle now reads window.getComputedStyle(el).display), def0143 (new shell-csp-inline-attrs static check, registered outside --quick, file list derived from jar.mn, self-tested against a known-bad fixture, proven red against the pre-fix markup) and b3a287d (new SOURCERER_DECK_STATE runtime sentinel, asserted all-none by verify-phase-04.sh shell05-paint-before-backend and asserted NOT-none by verify-phase-05.sh shell03-budget-exhausted-error as a positive control). The original bug reproduces on demand from the true pre-fix tree, which emits deck state error:flex diagnostics:flex.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-28T16:24:56.911Z",
    "resolved_at": "2026-08-28T16:24:59.575Z"
  },
  {
    "id": 9,
    "kind": "fixme",
    "phase": "05",
    "file": "theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts",
    "line": 25,
    "description": "OPEN code-review finding MED-01 (05-REVIEW.md), deliberately NOT fixed -- recorded so it is tracked rather than dropped. SOURCERER_SUPERVISED=1 is read by the watchdog but never deleted from process.env after arming, and TheiaService._spawnAndGate applies its environment with environmentAppend: true, so the marker inherits into every subprocess the Theia backend later spawns (integrated terminal, task runner, npm/yarn, debug adapter). The same environment object already resets SOURCERER_TOKEN_DISABLE for exactly this inheritance hazard; SOURCERER_SUPERVISED gets no equivalent treatment. Latent, not exploitable by anything in this repo today because nothing else reads the variable -- but that fact, not scoping, is the only defence. Fix: delete process.env[SUPERVISED_ENV_VAR] immediately after the arming check.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-28T16:25:15.020Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "fixme",
    "phase": "05",
    "file": "sourcerer/shell/TheiaService.sys.mjs",
    "line": 326,
    "description": "OPEN code-review finding MED-02 (05-REVIEW.md), deliberately NOT fixed -- recorded so it is tracked rather than dropped. _pumpOutput pushes every backend stdout/stderr line into the _log ring buffer with no redaction pass, and the diagnostics layer this phase introduced renders that entire buffer verbatim (sourcerer.js diagnosticsLogElement.textContent = log.join). The shell never logs this._token itself and the SOURCERER_* sentinels are proven token-free, but any backend, Theia extension or third-party dependency that prints process.env (which carries SOURCERER_TOKEN) flows unredacted into a now-reachable in-app UI panel -- new exposure surface introduced by SHELL-04, where previously the same text existed only in the process's own stdout. Fix: redact in _pushLog, at minimum line.replaceAll(this._token, [redacted]).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-28T16:25:15.115Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "todo",
    "phase": "05",
    "file": "sourcerer/shell/TheiaService.sys.mjs",
    "line": 215,
    "description": "OPEN housekeeping, deliberately NOT fixed. The CR-01 profile-scoping fix keys the sidecar state file on the profile path, so every distinct profile leaves its own ~/.config/sourcerer/sidecar-state-<profile>.json behind and nothing ever reaps them. 151 such files have accumulated in the real user config directory as of 2026-08-28 (counted: ls ~/.config/sourcerer/sidecar-state*.json), almost all from harness runs against mktemp profiles -- sidecar-state-_tmp_tmp_*.json and sidecar-state-_tmp_sourcerer_firefox_bidi_*.json. Harmless per file (a few bytes, read only if a matching profile path is ever relaunched) but test runs are littering a real user directory. Cheapest remedy: point XDG_CONFIG_HOME at the harness temp dir in verify-phase-05.sh's launch helpers so test runs never touch the real config dir at all -- TheiaService._resolveConfigDir already honours XDG_CONFIG_HOME ahead of HOME. Reaping stale files is a second, larger option.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-28T16:25:15.213Z",
    "resolved_at": null
  }
]
````
