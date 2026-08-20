---
phase: 2
slug: sourcerer-theia-extensions
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` §"Validation Architecture", §5 and §6.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None, and none is installed. Phase 1 shipped shell smoke tests (`scripts/smoke-theia.sh`, `scripts/smoke-firefox.sh`). Wave 0 adds plain Node `.mjs` assertion scripts that drive **the Firefox this repo already builds** (`objdir/dist/bin/firefox`, 153.1.0esr) in headless mode over WebDriver BiDi — see CONTEXT.md **D-69**. |
| **Browser driver** | `objdir/dist/bin/firefox --headless`, plus `--screenshot`/`--window-size` for image capture and `--remote-debugging-port` for BiDi. **Zero npm dependencies** — the pinned `nodejs_22` (**v22.23.2**, verified inside `nix develop .#theia`) exposes a global `WebSocket`, which is the BiDi client. The binary also runs fine outside the `firefox` dev shell, so the harness does not shell-hop. |
| **Config file** | none — nothing to install |
| **Quick run command** | `node scripts/verify-uri-roundtrip.mjs --scheme <scheme>` (Wave 0 deliverable) |
| **Full suite command** | `scripts/verify-phase-02.sh` (Wave 0 deliverable — runs the URI round-trip table, the dev-flag-off check, and the core-diff check in sequence) |
| **Estimated runtime** | ~60–120 seconds (dominated by one Theia backend boot + one headless Firefox launch) |

**Why the Firefox we build, not Playwright** (D-69, proven live 2026-08-20):
v4.0 ships a Firefox fork, so a Chromium-based harness would prove Theia works
in an engine Sourcerer does not ship; driving the exact `153.1.0esr` build makes
these scripts reusable as Phase 4/5 integration tests. It also adds no
dependency — keeping `theia/package.json` clean matters because criterion 2
diffs the workspace against the pinned Theia release. And Playwright's
downloaded browser binaries do not run on NixOS without
`nixpkgs.playwright-driver` / `nix-ld` workarounds, on the only platform v4.0
targets.

**Why plain scripts, not a test framework:** this phase needs a handful of
assertion scripts, not a suite. Fixtures and reporters are overhead the scope
does not justify. Revisit only if the check count grows past what a single
shell driver reads cleanly.

---

## Sampling Rate

- **After every task commit:** the relevant single-scheme round-trip script
  (seconds) plus `yarn check --integrity` (RESEARCH §5 mechanism 1 — cheap
  drift detection against the pinned `@theia/*` set)
- **After every plan wave:** the full §4-table-driven URI round-trip suite plus
  `scripts/verify-dev-flag-off.ts` against a release-configured build
- **Before `/gsd-verify-work`:** the fresh-resolve diff (RESEARCH §5 mechanism
  2, criterion 2), the full URI round-trip table (criteria 4 and 5), and a
  manual branding pass (criterion 1)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table binds requirements to proof
mechanisms so the planner can attach the right `<verify>` to each task.

| Requirement | Behavior proved | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| BRAND-05 | Welcome widget, About dialog, window/tab title and favicon carry Sourcerer identity; no `Theia`/`Eclipse` string in user-visible chrome | automated string-presence + manual visual | BiDi `script.evaluate` asserting `/Theia\|Eclipse/i.test(document.body.innerText)` is `false` in the About dialog and welcome widget; `document.title` equals the configured `applicationName`; `link[rel="icon"]` present with a non-empty `href` — **all four shapes proven working in the D-69 probe** | ❌ W0 | ⬜ pending |
| CUST-01 | Absent/empty `customize.css` → zero visual change; populated file → visible restyle, hot-reloaded | automated screenshot diff | `firefox --headless --window-size 800,600 --screenshot` across three states: no file, empty file, file with one high-specificity rule. **Open detail:** confirm whether byte-hash equality is stable across two captures of an unchanged page; if not, decode raw pixels with python3 `zlib`+`struct` rather than adding an image library (D-69) | ❌ W0 | ⬜ pending |
| CUST-02 | Dev flag off → the privileged binding does not exist | automated | `scripts/verify-dev-flag-off.mjs` — asserts `window.theia.container.isBound(Symbol.for('SourcererPrivilegedJs')) === false` via BiDi `script.evaluate` in the running page, against a **release-configured `theia build`**, served from `lib/` not `src-gen/`. Ships a positive control (`--expect-bound`) so a vacuous pass is detectable. Both branches proven in the D-69 probe | ❌ W0 | ⬜ pending |
| URI-01 | `settings:` opens or focuses the Settings widget and the tab reports that address | automated | D-53 round-trip: `registry.uriOf(await open(u)).toString(true) === u`, **plus** `widgetManager.getWidgets('settings_widget').length === 1` after opening via both the menu and the URI | ❌ W0 | ⬜ pending |
| URI-02 | `terminal:t1` round-trips; a stale name creates a fresh shell under that name | automated | Same D-53 pattern against `TERMINAL_WIDGET_FACTORY_ID`, plus a stale-name case asserting a new widget appears rather than an error | ❌ W0 | ⬜ pending |
| URI-03 | Every widget in RESEARCH §4's FactoryId table has a working `view:` address | automated, table-driven | One parameterized script iterating the §4 table, D-53's round-trip assertion per row. **Must include `ai-sessions-widget`** — the entry missing from CONTEXT.md D-43. | ❌ W0 | ⬜ pending |
| URI-04 | URIs are typeable by hand; per-scheme semantics documented | manual (type a URI into an input) + doc deliverable | No automated command for the typing check. The per-scheme semantics doc is a phase artifact, verified by its existence and by covering every scheme in RESEARCH §4 plus the three carve-outs in CONTEXT.md D-51. | ❌ W0 (doc) | ⬜ pending |
| — (criterion 2) | Zero changes inside `@theia/*` | automated | `scripts/diff-theia-core.sh` — fresh-resolve-and-diff, RESEARCH §5 mechanism 2 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**No framework install.** D-69 replaced the Playwright line that used to head
this list — the harness drives `objdir/dist/bin/firefox`, which Phase 1 already
built. Nothing is added to `theia/package.json`.

- [ ] `scripts/lib/firefox-bidi.mjs` — the shared driver: launch
      `objdir/dist/bin/firefox --headless --profile <tmp>
      --remote-debugging-port=<port> --remote-allow-hosts 127.0.0.1`, poll
      **stderr** for `WebDriver BiDi listening on ws://…` (do not sleep),
      connect with Node's global `WebSocket`, then
      `session.new` → `browsingContext.getTree` → `script.evaluate`. Must kill
      Firefox and remove the temp profile in a `finally` — Phase 5's subject is
      orphaned processes and the harness must not create any. Driver shape is
      transcribed from D-69, which proved it on this host.
- [ ] `scripts/verify-dev-flag-off.mjs` — covers CUST-02, on top of the driver.
      Keeps RESEARCH §6's `Symbol.for('SourcererPrivilegedJs')` requirement: a
      bare `Symbol()` token is unretrievable from outside the bundle's module
      graph, so `script.evaluate` could never see it. Ships the
      `--expect-bound` positive control.
- [ ] `scripts/diff-theia-core.sh` — covers criterion 2. Fully specified in
      RESEARCH §5 mechanism 2 (unaffected by D-69 — no browser involved)
- [ ] `scripts/verify-uri-roundtrip.mjs` — table-driven off RESEARCH §4,
      covers URI-01 through URI-03's round-trip clause, on top of the driver
- [ ] `scripts/verify-phase-02.sh` — the sequencing driver for the above

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Branding reads as Sourcerer, not as a renamed Theia | BRAND-05 | String absence is scriptable; "looks like our product" is not | Launch the standalone app, open the welcome tab and the About dialog, confirm the mark renders at favicon size in the browser tab |
| A hand-typed URI opens the right tab | URI-04 | The requirement is specifically about a human typing it | Type `settings:`, `terminal:t1` and `view:problems` by hand into the opener input; confirm each lands on the expected tab |
| Empty-CSS inertness | CUST-01 | Screenshot diff proves pixel equality; a human confirms nothing subtle shifted (focus rings, scrollbars, font smoothing) | Compare the app with no `customize.css` against the app with an empty one, side by side |

---

## Known Validation Risks

- **Criterion 3's dev-flag clause passes vacuously in two ways** (CONTEXT.md
  D-64): running against `src-gen` rather than `lib`, and grepping source
  instead of evaluating in the page. The Wave 0 script must do neither.
- **CONTEXT.md D-65 caveat stands:** the binding is absent but the class
  remains in `bundle.js`. The test asserts binding absence, which is what
  CUST-02 as worded requires. Do not extend it to assert artifact absence
  without first re-opening the requirement.
- **RESEARCH open question 1:** `theia rebuild:browser`'s native-module skip
  list may grow beyond Phase 1's four names once 38 more packages' transitive
  deps enter the tree. Read the actual rebuild log at implementation time
  rather than assuming the Phase 1 list still holds.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
