# Phase 4: Full-Window Theia Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 4-Full-Window Theia Shell
**Areas discussed:** Window substitution, XHTML shape, Chrome registration, Patch layout, First paint, Reconnect presentation, Internals boundary, Boundary enforcement, Token gate, Token handoff, Spawn paths, Health loop, Verification, Port/token lifetime, Quit ordering, Log capture, Workspace, SEED-001 storage interaction

---

## Window substitution mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Repoint BROWSER_CHROME_URL | Second patch hunk in browser/moz.configure; all consumers follow the constant; one-time tier-3 rebuild | ✓ |
| Repoint jar.mn entry | Serve browser.xhtml path from our tree; no rebuild but masquerades + higher-churn file | |
| Startup observer | Open our window, suppress default; fights BrowserContentHandler | |

**User's choice:** Repoint BROWSER_CHROME_URL (recommended)

---

## sourcerer.xhtml internal shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal from scratch | One <browser>, loading deck, own module imports only; no browser.js/gBrowser | ✓ |
| Gutted browser.xhtml copy | Keep init machinery for post-4.0; chases exceptions through unused code, drifts on rebase | |

**User's choice:** Minimal from scratch (recommended)

---

## Build registration

| Option | Description | Selected |
|--------|-------------|----------|
| DIRS hunk in browser/moz.build | One-line patch; own moz.build + jar.mn in sourcerer/shell/ | ✓ |
| chrome.manifest in distribution/ | Zero patch hunks but legacy runtime registration | |

**User's choice:** DIRS hunk (recommended)

---

## Patch layout

| Option | Description | Selected |
|--------|-------------|----------|
| New 020-sourcerer-shell.patch | One patch per concern; independent rebase | ✓ |
| Extend 010-sourcerer-identity.patch | Single file but name stops describing it | |

**User's choice:** New 020 patch (recommended)

---

## First-paint presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome overlay deck in sourcerer.xhtml | Paints with window; one navigation when healthy; Phase 5 error state is another layer | ✓ |
| Loading page inside the <browser> | Content-process lifecycle entangles; SHELL-03 needs chrome-rendered anyway | |

**User's choice:** Chrome overlay (recommended)

---

## Mid-session restart presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Theia's own reconnect UI | Chrome does nothing visually; page state survives | ✓ |
| Re-show chrome overlay | Hides Theia's messaging; risks flicker on transient probe failures | |

**User's choice:** Theia's reconnect UI (recommended)

---

## Internals boundary strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Everything non-sourcerer | Imports + Services.* + XPCOM + AppConstants all gated; zero judgment calls | ✓ |
| Module imports only | Smaller wrap surface but per-global judgment calls and allowlist | |

**User's choice:** Everything non-sourcerer (recommended)

---

## Boundary enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Checked-in guard script | check-internals-boundary.sh with --self-test; D-68 idiom | ✓ |
| Manual catalogue review | Guarantee decays without the script | |

**User's choice:** Guard script (recommended)

---

## Token gate design (SIDE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| @sourcerer backend extension, token via env | EarlyExpressMiddleware handler 403s every HTTP request without token | ✓ |
| Rebind stock BrowserConnectionToken | Stock enforcement stays WS+opt-in; fails SIDE-02 anyway | |

**User's choice:** Backend extension + env token (recommended)

---

## Token handoff

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome-set cookie before first navigation | Token never in a URL; one SourcererAPI method | ✓ |
| Query param on first load | Token in URL history/logs; more backend logic | |

**User's choice:** Chrome-set cookie (recommended)

---

## Sidecar location (SIDE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Firefox prefs with dev defaults | sourcerer.sidecar.* prefs; works from .desktop launch; DIST swaps defaults later | ✓ |
| Env vars at browser launch | .desktop launch has no env; needs wrapper | |
| Hardcoded relative path | Welds dev layout into chrome code | |

**User's choice:** Prefs with dev defaults (recommended)

---

## Health loop (SIDE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Own token-gated endpoint, capped backoff, retry forever | One probe proves liveness + enforcement; Phase 5 adds give-up | ✓ |
| Probe GET / | Heavy; 200 proves assets not services | |
| Process-alive only | Wedged backend never fails the check | |

**User's choice:** Own endpoint (recommended)

---

## Verification method

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted verify-phase-04.sh + one manual item | BiDi + curl 403/200 pair + kill/recover + boundary guard; human checks immediate paint | ✓ |
| Manual checklist only | Nothing re-runnable at next rebase | |

**User's choice:** Scripted + one manual item (recommended)

---

## Port + token lifetime across restarts

| Option | Description | Selected |
|--------|-------------|----------|
| First spawn binds 0; restarts pin that port | Loaded page's reconnect origin stays valid; token per browser launch | ✓ |
| Fresh port + force reload | Destroys page state reconnect would preserve | |

**User's choice:** Pin the port (recommended)

---

## Normal-quit shutdown ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Stop health loop → TERM → bounded grace → KILL | Quit never races restart or hangs the browser | ✓ |
| Immediate SIGKILL | No flush; Phase 5 rebuilds ordering anyway | |

**User's choice:** TERM-grace-KILL (recommended)

---

## Backend log capture

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded ring buffer in TheiaService | Phase 5 diagnostics reads what already exists | ✓ |
| Discard until Phase 5 | Retrofit later; harder crash diagnosis now | |

**User's choice:** Ring buffer (recommended)

---

## Workspace on first load

| Option | Description | Selected |
|--------|-------------|----------|
| Theia's stock behavior | Last-workspace memory under THEIA_CONFIG_DIR | ✓ |
| workspaceDir pref | Duplicates Theia's own memory; fights File > Open Workspace | |

**User's choice:** Stock behavior (recommended)

---

## SEED-001 interaction (raised by user mid-discussion)

User asked whether the SQL tab-state store (SEED-001) should be built before
continuing Phase 4. Analysis: Phase 4 has no tabs and no persistence, so the
store has no consumer this phase; building the schema now would be designed
against an imagined TabModel API and reworked. Decision: build nothing now;
Phase 4 carries two guardrails (D-107 no new persistence, D-108 SessionStore
catalogued as deliberately untouched) so the store later lands on clean
ground. Seed stays dormant, capture-only.

## Claude's Discretion

- Deck markup and loading-state visuals
- Health-poll intervals and backoff constants
- SourcererAPI method names/signatures
- Port read-back mechanism (researcher determines what the backend announces)
- Ring buffer size, grace-period duration
- Keyboard/quit shortcuts in the minimal window
- `<browser>` remote/content typing recorded as D-91 (security-relevant)

## Deferred Ideas

- SIDE-04/SIDE-05/SHELL-03/SHELL-04 → Phase 5 (per roadmap)
- Pinned-port-stolen-during-restart-gap → Phase 5 exhausted-backoff case
- SEED-001 store/engine/schema/MCP organiser → dormant, post-4.0 tab-model milestone
