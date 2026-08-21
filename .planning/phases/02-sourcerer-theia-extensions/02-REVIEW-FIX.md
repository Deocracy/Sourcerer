---
phase: 02-sourcerer-theia-extensions
fixed_at: 2026-08-21T00:00:00Z
review_path: .planning/phases/02-sourcerer-theia-extensions/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 2
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-08-21
**Source review:** .planning/phases/02-sourcerer-theia-extensions/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (all 3 Critical + all 3 Warning, per fix_context)
- Fixed: 6
- Skipped: 2 (both Info findings, explicitly out of scope)

**Verification:** `nix develop .#theia --command bash scripts/verify-phase-02.sh --build`
run to completion after every finding was fixed -- 5/5 checks PASS
(`diff-theia-core`, `verify-branding`, `verify-customize-inert`,
`verify-dev-flag-off`, `verify-uri-roundtrip`), 23/23 URI round-trip rows
PASS, exit code 0. All work done in the main checkout (`workflow.use_worktrees`
is `false` in `.planning/config.json`), so these results are reproducible
directly from this tree with no teardown step required.

## Fixed Issues

### CR-01: `view:plugin-view-container:<id>` never attaches the widget to the shell on first open

**Files modified:** `theia/extensions/tab-uris/src/browser/view-open-handler.ts`,
`scripts/verify-uri-roundtrip.mjs`
**Commits:** `118a1c1` (fix), `b2f4253` (test follow-up)
**Applied fix:** `ViewUriOpenHandler.openView()`'s plugin-view-container
branch now delegates to `PluginViewRegistry.openViewContainer(viewContainerId)`
instead of calling `getOrCreateWidget` + `activateWidget` directly --
`openViewContainer` calls `shell.addWidget(containerWidget, { area, rank })`
whenever `!containerWidget.isAttached`, which is exactly the step the
original code skipped. Verified `PluginViewRegistry`'s own
`toViewContainerIdentifier` produces the identical `{id, progressLocationId}`
options shape `TabUriRegistry.createWidgetOptions` already returns for this
branch, so delegating cannot fork the widget under D-46's dedup key. `tsc -b`
on `@sourcerer/tab-uris` and a full `theia/` build both stayed clean.

Also strengthened `verify-uri-roundtrip.mjs`'s D-53 acceptance check (the
review's explicit ask: "fixing the code is not sufficient -- strengthen the
check too") with an explicit `widget.isAttached` assertion on every row. The
first version of that assertion checked immediately after `open()` resolved
and false-failed 6 legitimate rows (`problems`, `explorer-view-container`,
`outline-view`, `search-view-container`, `scm-view-container`, `debug`) --
found by actually running the full gate, not assumed. Probed live against
the running app: those widgets *were* correctly attached (parent
`theia-bottom-content-panel`), just asynchronously -- `isAttached` was
`false` immediately after `open()`, `true` 500ms later (Lumino's side/bottom
panel reveal path). Replaced the single point-in-time check with a bounded
3s poll (`__waitAttached`), which still fails loudly for a genuinely
never-attached widget (CR-01's actual bug) but tolerates legitimate
async settling. Re-ran: 23/23 rows pass.

### CR-02: `BiDiClient` has no timeout or WebSocket-close handling

**Files modified:** `scripts/lib/firefox-bidi.mjs`
**Commit:** `ed9d55e`
**Applied fix:** `BiDiClient` now rejects every pending request when the
underlying WebSocket closes or errors, and `send()` carries a 20s default
per-request timeout. Matches the review's proposed code essentially
verbatim. Verified with `node -c`.

### CR-03: Racing SIGINT handlers can orphan the Firefox process and leak its profile directory

**Files modified:** `scripts/lib/firefox-bidi.mjs`, `scripts/verify-customize-inert.mjs`
**Commit:** `2d9aea5`
**Applied fix:** Root-caused in the shared driver rather than patched only in
the one caller that exhibited it. `withFirefoxPage`'s own internal SIGINT
handler no longer calls `process.exit()` -- it sets `process.exitCode = 130`
and runs `cleanup()` (kill Firefox, remove the temp profile), then lets the
function's own `try/finally` unwind naturally once CR-02's close-triggered
rejection propagates the awaited callback's failure. `verify-customize-inert.mjs`
now just records that SIGINT arrived (`sigintReceived = true`) and lets its
pre-existing `finally` block (where `restore()` already lived) run
deterministically instead of racing a second `process.exit()` call.

While proving this with a real SIGINT, found and fixed a related gap: a
`send()` call issued *after* the socket had already closed (e.g. the
caller's next `screenshot()` following a plain `setTimeout` sleep) previously
hung for its own full 20s timeout instead of rejecting immediately, because
`close`/`error` only fire once and reject only what's pending *at that
moment*. Added a `closedError` flag so every subsequent `send()` rejects
immediately once the socket is known dead.

**Proof (not just an assertion):** built the app, started it, ran
`scripts/verify-customize-inert.mjs` under the pinned Node 22 runtime
(`nix develop .#theia`), and sent real `SIGINT` mid-run twice, at different
points in the run (once ~5s in during a screenshot capture, once ~2s in
during Firefox launch). Both times: exit code 130, full teardown in
~1.7s, zero `objdir/dist/bin/firefox` processes and zero
`/tmp/sourcerer-firefox-bidi-*` directories left behind afterward, and
`customize.css` restored to its pre-run (absent) state.

### WR-01: `@sourcerer/customize` depends on `@sourcerer/tab-uris` with no build-order enforcement

**Files modified:** `theia/extensions/customize/tsconfig.json`
**Commit:** `16d6d2d`
**Applied fix:** Added `"references": [{ "path": "../tab-uris" }]`. Verified
live: cleaned both packages' `lib/` output, ran `yarn build` inside
`extensions/customize` alone with no manual pre-build of `tab-uris`, and
`tsc -b` built `tab-uris` first automatically (confirmed `tab-uris/lib/`
populated as a side effect). Full `theia/` build stayed clean afterward.

### WR-02: `SourcererWelcomeWidget.doInit()` is a floating promise with no error handling

**Files modified:** `theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx`
**Commit:** `197a426`
**Applied fix:** Wrapped the `await` in `try`/`catch`/`finally`, matching the
pattern already used by `CustomizeCssContribution.applyCss()` and
`CustomizePrivilegedJsContribution.run()` (per the review's own suggested
fix). `tsc -b` on `@sourcerer/branding` stayed clean.

### WR-03: `parseWebviewPath`'s no-slash fallback can silently fork a widget

**Files modified:** `theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts`,
`docs/URI-SCHEMES.md`
**Commit:** `a2fa1b5`
**Applied fix:** Took the review's "make the failure loud" option rather than
documenting it as a fifth carve-out (D-51's carve-out list is locked at
four). `SourcererWebviewOpenHandler.open()` now resolves a bare
`webview:<id>` address (no `/viewId`) against already-open panels by `id`
alone (`findExistingById`, scanning `widgetManager.getWidgets(WebviewWidget.FACTORY_ID)`
and comparing each widget's `getDescription().options.id`) and throws if none
matches, instead of falling through to `getOrCreateWidget` with an
under-specified `{id}`-only options object. `docs/URI-SCHEMES.md` gained a
short paragraph documenting the new behavior, per the fix_context's
instruction that a behavior-changing fix must update the doc. `tsc -b` on
`@sourcerer/tab-uris` and a full `theia/` build both stayed clean.

## Skipped Issues

### IN-01: `captureScreenshot` export is unused dead code

**File:** `scripts/lib/firefox-bidi.mjs:132-190`
**Reason:** Out of scope per fix_context (only fix Info items if genuinely
one-line and risk-free). Removing ~60 lines of dead process-management code
is neither. The finding itself only says "consider deleting."

### IN-02: `sourcererPrivilegedJs: false` is redundant given D-62

**File:** `theia/applications/browser/package.json:14`
**Reason:** Out of scope, and the finding's own text says "no action
required... not a defect."

## Notes

- The 6 fix commits plus the docs commit and this report cover every touched
  file; nothing under `theia/node_modules/@theia/` was created, edited, or
  deleted, and `scripts/diff-theia-core.sh` (criterion 2) still passes as
  part of the full gate.
- `workflow.use_worktrees` is `false` in `.planning/config.json`, so per the
  documented opt-out, all edits and commits above were made directly on
  `master` in the main checkout -- no worktree was created, and there is no
  cleanup tail to run.

---

_Fixed: 2026-08-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
