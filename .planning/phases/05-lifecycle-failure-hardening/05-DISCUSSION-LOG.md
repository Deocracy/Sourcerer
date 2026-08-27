# Phase 5: Lifecycle & Failure Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 5-lifecycle-failure-hardening
**Areas discussed:** Orphan kill + leftover cleanup, Give-up threshold + error scope, Diagnostics surface + reachability, Single-instance semantics, WINDOWS ledger triage, Verification shape

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Orphan kill + leftover cleanup | SIGKILL runs no cleanup code; detection state contradicts D-107 | ✓ |
| Give-up threshold + error scope | Phase 4 retries forever; error layer vs already-loaded page (D-95) | ✓ |
| Diagnostics surface + reachability | No URL bar; `<browser>` pinned remoteType=web; must survive backend down | ✓ |
| Single-instance semantics | BrowserContentHandler opens a new window; start() is re-entrant | ✓ |

**User's choice:** All four.

## WINDOWS ledger triage

| Option | Description | Selected |
|--------|-------------|----------|
| #6 about: reachability | Same mechanism question as SHELL-04's diagnostics page | ✓ |
| #5 endpoint allowlist | New hosts (127.0.0.1, ciscobinary.openh264.org, github.com) need a privacy call | |
| Neither — defer both | Keep Phase 5 strictly to SIDE-04/05 and SHELL-03/04 | |

**User's choice:** Fold #6 in; leave #5 deferred.
**Notes:** `workflow.windows_enforce` is currently `false`, so neither item blocks `/gsd-ship` today.

---

## Orphan kill + leftover cleanup

### What kills the backend on SIGKILL

| Option | Description | Selected |
|--------|-------------|----------|
| stdin EOF watchdog | Verified: `Subprocess` opens fd 0 as a pipe unconditionally on unix (`subprocess_unix.worker.js:361`); browser holds the write end, SIGKILL closes it. No polling, no race. | ✓ |
| ppid polling | Portable, but detection delayed by the interval and burns a timer all session | |
| Startup cleanup only | Smallest diff, but literally fails SIDE-04's first clause | |
| Both belt-and-braces | EOF primary, ppid poll as a backstop for future packaging paths | |

**User's choice:** stdin EOF watchdog. → **D-109**

### Leftover-detection state

| Option | Description | Selected |
|--------|-------------|----------|
| Pidfile in THEIA_CONFIG_DIR | `{pid, port, startedAt}`; dir already exists and is already mkdir -p'd. Amends D-107. | ✓ |
| Firefox profile dir instead | Ties leftover state to the browser profile rather than the sidecar's config | |
| No file — nothing persists | Keeps D-107 intact but fails SIDE-04's second clause | |

**User's choice:** Pidfile in `THEIA_CONFIG_DIR`. → **D-110**

### Cleanup kill scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only a verified-ours pid | Confirm alive AND identity matches before signalling; refuses a recycled pid | ✓ |
| Anything on the recorded port | Can kill a developer's own `yarn start` sidecar | |
| Kill by pid, no verification | Shortest code; signals an innocent process on pid reuse | |

**User's choice:** Verified-ours pid only. → **D-111**

### Stolen pinned port (D-104 residual risk)

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as unrecoverable — error state | Loaded page can only reconnect to its origin; no silent recovery exists | ✓ |
| Reap the squatter, then rebind | Only helps when the squatter is our own orphan | |
| You decide | Let the planner pick from the observed failure shape | |

**User's choice:** Unrecoverable → SHELL-03 error state. → **D-112**

---

## Give-up threshold + error scope

### Give-up definition

| Option | Description | Selected |
|--------|-------------|----------|
| Split: fatal vs transient | Unrecoverable classes give up immediately; the rest get a bounded budget | ✓ |
| Attempt count only | One constant, trivially testable; wastes time on impossible failures | |
| Wall-clock budget only | Bounds user wait; slow failures get fewer attempts than fast ones | |

**User's choice:** Split fatal vs transient. → **D-113**

### Error layer vs the loaded page

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay, page kept alive | Verified: Theia's offline handling retries indefinitely and never gives up (`connection-status-service.js:183-188`), so the page resumes on its own | ✓ |
| Overlay + navigate away | Cleaner process accounting; discards the state D-104 exists to preserve | |
| Pre-first-load only | Keeps D-95 unchanged; fails SHELL-03's "never a blank or frozen window" mid-session | |

**User's choice:** Overlay, page kept alive. → **D-114** (revises D-95)

### Retry semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Restart backend; auto-dismiss | Resets backoff, respawns on the pinned port; a slow background probe hides the layer if it self-heals | ✓ |
| Restart backend; manual dismiss only | Fewer moving parts; a recovered backend still shows an error until clicked | |
| Restart backend and reload the page | Guaranteed-clean frontend; discards the recoverable session | |

**User's choice:** Restart + auto-dismiss. → **D-115**

### Error content

| Option | Description | Selected |
|--------|-------------|----------|
| Message + route to diagnostics | Detail implemented once, in SHELL-04 | ✓ |
| Message + inline log tail | Everything in one place; duplicates rendering, shows a stack trace to a non-debugging user | |
| Message and Retry only | Cleanest screen; tells the user least | |

**User's choice:** Message + route to diagnostics. → **D-116**

---

## Diagnostics surface + reachability

### Where it renders

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome deck layer | Third layer in the existing deck; alive by construction with the backend down; sidesteps WINDOWS #6 | ✓ |
| Real about:sourcerer | Matches the requirement's wording but drags in remote-type switching (post-4.0) | |
| Served by the sidecar | Dead exactly when needed; ruled out by SHELL-04's own text | |

**User's choice:** Chrome deck layer. → **D-117**

### Entry points (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Keyboard shortcut | Chrome-level handler in `sourcerer.js`; a chord Theia does not claim | ✓ |
| Link from the error state | Guarantees discovery at the moment it matters | ✓ |
| Command-line flag | Useful for a scripted check or a build that will not paint | |

**User's choice:** Shortcut + error-state route. → **D-118**
**Notes:** The command-line flag was noted as a deferred idea rather than dropped.

### Identity fields

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — identity plus sidecar | Gives `verify-branding-identity.mjs` a real reachable surface; turns WINDOWS #6 into a side effect | ✓ |
| Sidecar data only | Tightest scope; leaves #6 needing its own answer | |

**User's choice:** Identity plus sidecar. → **D-119**

### WINDOWS #6 resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Repoint the check chrome-side | All six BRAND-01 surfaces stay genuinely verified | ✓ |
| Waive it, document the reason | Zero code; BRAND-01 loses a surface | |
| Make about: reachable now | CHROME-01 groundwork landing early; the scope gate routes it to the backlog | |

**User's choice:** Repoint the check chrome-side. → **D-120**

---

## Single-instance semantics

### Where the guard lives

| Option | Description | Selected |
|--------|-------------|----------|
| Both layers | Handler intercept for correct UX + idempotent `start()` so no-second-backend is true by construction | ✓ |
| Command-line handler only | Fixes the real path; leaves `start()` re-entrant | |
| TheiaService guard only | Guarantees one backend; leaves a stray blank window | |

**User's choice:** Both layers. → **D-121**
**Notes:** Verified failure path — a second launch remotes into `BrowserContentHandler.handle()` → `openBrowserWindow()` → `BrowserWindowTracker.openWindow()` (`BrowserContentHandler.sys.mjs:398`) at `BROWSER_CHROME_URL`, now `sourcerer.xhtml`, whose `sourcerer.js` calls `TheiaService.start()` again with no guard.

### Finding the existing window

| Option | Description | Selected |
|--------|-------------|----------|
| Services.wm by windowtype | `sourcerer.xhtml` already declares `windowtype="sourcerer:main"`; works today, no new registration | ✓ |
| Register with BrowserWindowTracker | Makes more internals resolve against our window — which is also the risk (they assume `gBrowser`/`browser.js` state D-90 excludes) | |

**User's choice:** `Services.wm.getMostRecentWindow("sourcerer:main")`. → **D-122**

### Second window ever?

| Option | Description | Selected |
|--------|-------------|----------|
| Never — always focus | Matches SHELL-01's one-window design; leaves multi-window semantics to CHROME-01 | ✓ |
| Allow a second window sharing one backend | Useful on two monitors; invents multi-window semantics ahead of the tab model | |

**User's choice:** Never — always focus. → **D-123**

### Command-line arguments

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore args, just focus | Honest and predictable; forwarding needs a chrome-to-sidecar channel | ✓ |
| Forward paths to Theia | Better ergonomics; new capability inside a hardening phase | |
| Refuse to launch with args | Maximally honest; makes the binary feel broken | |

**User's choice:** Ignore args, just focus. → **D-124**

---

## Verification shape

### SIDE-04 proof

| Option | Description | Selected |
|--------|-------------|----------|
| Automated, both directions | SIGKILL orphan assertion paired with a planted-leftover positive control | ✓ |
| Automated, orphan check only | Half the work; the vacuous-pass failure mode behind WINDOWS #2–4 | |
| Human verification | Fast to write; will not re-run at the next ESR rebase | |

**User's choice:** Automated, both directions. → **D-125**

### Criterion 5's bar

| Option | Description | Selected |
|--------|-------------|----------|
| One full working day, human-recorded | Same shape as Phase 3 Items A/B and Phase 4's launch-paint item | ✓ |
| Multiple days / a week | Catches slow leaks; gates the milestone on calendar time | |
| Automated soak instead | Repeatable; does not exercise what daily-drivable means | |

**User's choice:** One full working day, recorded in `05-MANUAL-VERIFICATION.md`. → **D-126**

### Gate shape

| Option | Description | Selected |
|--------|-------------|----------|
| New verify-phase-05.sh; rerun 03 and 04 | Last phase — green v4.0 must mean every gate green at the same commit | ✓ |
| New verify-phase-05.sh only | Faster; Phase 4 already proved a later phase can break an earlier gate | |

**User's choice:** New script plus reruns of 03 and 04. → **D-127**

---

## Claude's Discretion

- Give-up constants (attempt cap / wall-clock ceiling) and the auto-recovery probe interval
- The exact keyboard chord for the diagnostics layer
- Markup, layout, and refresh cadence of the error and diagnostics layers
- State-file name, format, field set, and the precise identity check before signalling
- `SourcererAPI` method names and signatures for the new touchpoints
- How the command-line intercept is registered so it wins ordering against `BrowserContentHandler`
- Which `@sourcerer/*` package hosts the stdin-EOF watchdog

## Deferred Ideas

- WINDOWS #5 — endpoint allowlist's new hosts (needs a product/privacy call)
- Forwarding command-line paths into the IDE — post-4.0 bridge
- A second shell window sharing one backend (two-monitor) — post-4.0
- `about:` page reachability / remote-type switching — post-4.0 (CHROME-01)
- A `--diagnostics` command-line flag
- SEED-001 unified SQL store — still dormant
- WINDOWS #1 (Phase 2 `tabUriRegistry` stub) — still open, untouched
