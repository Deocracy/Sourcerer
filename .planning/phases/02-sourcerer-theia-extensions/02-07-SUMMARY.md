---
phase: 02-sourcerer-theia-extensions
plan: 07
subsystem: ui
tags: [theia, inversify, uri-scheme, terminal, output-channel, webview, opener-service, widget-manager]

requires:
  - phase: 02-sourcerer-theia-extensions (plan 06)
    provides: "@sourcerer/tab-uris's TabUriRegistry and ViewUriOpenHandler for view:/settings:, the registry's public shape (getViewContribution, parseName, createWidgetOptions, uriOf), and registerLateOpenHandler"
  - phase: 02-sourcerer-theia-extensions (plan 02)
    provides: "scripts/verify-uri-roundtrip.mjs -- the table-driven URI-01..URI-04 proof this plan turns fully green (23/23), and scripts/verify-phase-02.sh, the sequencing driver this plan reorders and re-runs clean"
provides:
  - "@sourcerer/tab-uris gains SourcererTerminalFrontendContribution (mints t<n> terminal identities), SourcererTerminalWidget (Navigatable, the one widget type with a real implementation), TerminalUriOpenHandler (terminal: scheme), SourcererOutputOpenHandler (fixes a live channel-selection bug in @theia/output's own forward open path), SourcererWebviewOpenHandler (webview: scheme, session-scoped), and reverse-lookup coverage in TabUriRegistry.uriOf for terminal/output/extension-detail/webview"
  - "docs/URI-SCHEMES.md -- URI-04's deliverable, per-scheme semantics for all seven addresses plus the four D-51 carve-outs"
  - "scripts/verify-phase-02.sh's check order corrected to match the plan's intended sequence"
  - "URI-02 and URI-04 closed; the phase's full verification gate (bash scripts/verify-phase-02.sh --build) is green end to end"
affects: []

actuals:
  tokens: 10525
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Mint a per-instance identity by overriding a widget-factory contribution's own creation method (SourcererTerminalFrontendContribution.newTerminal), rather than patching the WidgetFactory or the widget class -- the base method already spreads caller options after the token it mints, so injecting {created, id, title} before delegating wins automatically with zero core changes."
    - "When a widget-manager-created singleton widget needs a Navigatable implementation, rebind the DI token for the widget CLASS itself (TerminalWidget -> SourcererTerminalWidget) rather than touching the WidgetFactory that constructs it -- every creation path (contribution method, direct widgetManager.getOrCreateWidget call, layout restore) resolves through the same rebound token."
    - "A bare OpenHandler delegating to the in-tree contribution's own open()/openView() method reuses that contribution's correct area-placement logic; extending WidgetOpenHandler is only safe when its hardcoded default area ('main') already matches the widget's own default area -- verified false for Terminal (real default 'bottom'), so the terminal and output handlers stay bare OpenHandlers even though the plan text suggested WidgetOpenHandler for one of them."
    - "Reverse-lookup helpers for a widget-manager singleton with no per-instance construction options (@theia/output's OutputWidget) must read the widget's own live state (OutputChannelManager.selectedChannel), not WidgetManager.getDescription -- the WidgetFactory takes no options, so the description carries no per-address payload at all."

key-files:
  created:
    - theia/extensions/tab-uris/src/browser/terminal-naming-contribution.ts
    - theia/extensions/tab-uris/src/browser/terminal-open-handler.ts
    - theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts
    - docs/URI-SCHEMES.md
  modified:
    - theia/extensions/tab-uris/package.json
    - theia/extensions/tab-uris/src/browser/tab-uri-registry.ts
    - theia/extensions/tab-uris/src/browser/tab-uris-frontend-module.ts
    - scripts/verify-phase-02.sh

key-decisions:
  - "TerminalUriOpenHandler and SourcererOutputOpenHandler are bare OpenHandlers, not WidgetOpenHandler subclasses, despite the plan text citing VSXExtensionEditorManager as the pattern to follow -- found live/by source reading that WidgetOpenHandler.doOpen defaults an unattached widget's area to 'main' (widget-open-handler.ts), which is correct for the extension detail editor (already a main-area tab) but wrong for Terminal (real default 'bottom', from terminal-shell-handler.ts) and irrelevant for Output (a fixed bottom-panel singleton). Delegating to each widget's own in-tree contribution (TerminalFrontendContribution.open(), OutputContribution.open()) reuses Theia's own already-correct placement logic instead of reintroducing a placement bug."
  - "Fixed a real bug found live in @theia/output's own OutputContribution.open(): it validates the output: scheme and then calls this.openView(options), never reading the URI's channel at all -- opening output:B after output:A left OutputChannelManager.selectedChannel on A. SourcererOutputOpenHandler (priority 1000, clears the in-tree 200) selects the channel first, then delegates the actual reveal to the existing OutputContribution instance. Verified live: selectedChannel and registry.uriOf both track the second channel correctly after the fix; before it, both stayed pinned to the first."
  - "The output: channel name is extracted by reusing D-39/D-40's own lenient scheme:path parse rule (uri.authority || strip-leading-slash(uri.path.toString())) rather than OutputUri.channelName's slice-based extraction -- OutputUri.channelName assumes the canonical output:/<name> form vscode-uri's URI.parse(x).with({scheme}) produces, which a hand-constructed scheme:path-shaped URI (as the BiDi test harness's URI shim necessarily is) does not reproduce; the lenient parse tolerates both forms."
  - "terminalIdentityOptions({created, id, title} all equal to the same name) is a single shared helper used by both the auto-mint path (SourcererTerminalFrontendContribution.newTerminal) and the stale-name 'create a fresh shell under that name' path (TerminalUriOpenHandler.open) -- WidgetManager dedups on stableJsonStringify({factoryId, options}), so any drift between the two call sites would fork a duplicate widget instead of resolving to the terminal a human typed."
  - "SourcererTerminalWidget.getResourceUri() reads this.id directly rather than calling back into the registry -- terminalIdentityOptions always sets id and created to the identical name, and TerminalWidgetImpl's own @postConstruct sets this.id from that same injected id, so the widget's own id already IS its terminal: address."
  - "existing-scheme-coverage.ts's own tiny parseName duplicate (rather than importing TabUriRegistry.parseName) avoids a circular module dependency: TabUriRegistry already imports this file's extensionDetailUriOf/webviewUriOf reverse-lookup helpers."
  - "@theia/output, @theia/plugin-ext-vscode, @theia/terminal and @theia/vsx-registry added as declared dependencies to @sourcerer/tab-uris's package.json -- all four were already resolved in the frozen 49-package set (D-19) and present in node_modules; this is a manifest-only change requiring yarn install --ignore-scripts --frozen-lockfile to regenerate the integrity record, not a new external dependency."

requirements-completed: [URI-02, URI-04]

coverage:
  - id: D1
    description: "SourcererTerminalFrontendContribution mints t<n> terminal identities (lowest unused index, scanning existing widgets so a restored layout's names are never reused), preserves a caller-supplied identity unchanged, and both injected fields (created, id) land in persisted construction options so an address survives a page reload."
    requirement: "URI-02"
    verification:
      - kind: e2e
        ref: "Live BiDi against a running build: three no-arg newTerminal() calls yield t1/t2/t3 with no gaps; disposing t2 then allocating again reuses t2 (gap-fill); newTerminal({id:'custom-name'}) keeps that id unchanged; a page reload with two named terminals (t1, t9) restores both under the same names, confirmed via registry.uriOf after restore -- all PASS"
        status: pass
    human_judgment: false
  - id: D2
    description: "TerminalUriOpenHandler: terminal:t1 focuses an existing terminal without creating a new one; terminal:t9 (stale/absent) creates a fresh shell named t9; an empty path means the active terminal or a new one if none exists; renaming a terminal's tab title does not break resolution by its original address."
    requirement: "URI-02"
    verification:
      - kind: e2e
        ref: "Live BiDi: terminal:t1 open on an existing t1 leaves widgetManager.getWidgets('terminal').length unchanged; terminal:t9 on an absent t9 increases the count by exactly one with the new widget's id === 't9'; renaming t1's tab.title.label then reopening terminal:t1 resolves to the identical widget object -- all PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "SourcererTerminalWidget implements Navigatable (getResourceUri/createMoveToUri), its resource URI equals its terminal: address exactly, and Save-As stays disabled on a focused terminal (Terminal has no saveable property, so it fails Saveable.isSource before Navigatable.is is ever consulted)."
    verification:
      - kind: e2e
        ref: "Live BiDi: registry.uriOf(t1).toString(true) === 'terminal:t1' and t1.getResourceUri().toString(true) === 'terminal:t1', both exact matches; with a terminal focused, no candidate save-as-shaped command (file.saveAs, workspace:saveAs, workbench.action.saveWorkspaceAs) reports enabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "SourcererOutputOpenHandler fixes @theia/output's own OutputContribution.open() discarding the URI's channel -- opening output:A then output:B leaves exactly one outputView widget, now showing channel B, and the registry's reverse lookup reports the correct address after each open."
    verification:
      - kind: e2e
        ref: "Live BiDi against the real handler chain (canHandle/open, not a mocked call): after opening output:/ChanA then output:/ChanB, OutputChannelManager.selectedChannel.name === 'ChanB', registry.uriOf(widget).toString(true) === 'output:/ChanB', widgetManager.getWidgets('outputView').length === 1"
        status: pass
      - kind: e2e
        ref: "node scripts/verify-uri-roundtrip.mjs (full run, all schemes): output carve-out row PASS with the D-51 reason string, alongside 22 other non-carve-out rows -- 23/23 total"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reverse-lookup coverage for the extension detail editor (vscode-extension:) and plugin-contributed webview panels (webview:, session-scoped); preference: needs no new code and no sourcerer handler claims it."
    verification:
      - kind: e2e
        ref: "Live BiDi: registry.uriOf on a mocked {factoryId:'vsx-extension-editor', options:{id,version}} description returns vscode-extension://<id>/<version> (and .../.../ with a trailing slash when version is omitted, matching VSCodeExtensionUri.toId's own root-path check); a real plugin-webview widget created via widgetManager.getOrCreateWidget('plugin-webview',{id,viewId}) round-trips through registry.uriOf to webview:<viewId>/<id> and reopens the identical widget object via the opener; canHandle(preference:) is 0 across all four sourcerer-owned OpenHandlers (view, terminal, output, webview)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/URI-SCHEMES.md documents all seven schemes, the general opaque-form/lenient-parse/identity-only rules, the full 21-row view: address list with the coverage boundary and runtime-mutation note, the keybindings.view.widget dots exception, and the four D-51 carve-outs with wording matching existing-scheme-coverage.ts's CARVE_OUTS list."
    requirement: "URI-04"
    verification:
      - kind: manual_procedural
        ref: "Spot-checked three of the document's behavioural claims directly against source/live behaviour before signing off: the terminal: empty-path/stale-name semantics against terminal-open-handler.ts and the Task 1 live test; the output: channel-selection claim against existing-scheme-coverage.ts and the Task 2 live test; the webview: same-session reopen claim against the Task 2 live test's sameWidget:true result"
        status: pass
    human_judgment: true
    rationale: "Prose-level documentation accuracy and completeness is a judgment call no script fully covers; the automated round-trip and the live spot-checks establish the underlying facts are correct, but confirming the document reads clearly and covers what a human would actually need is not mechanically verifiable."
  - id: D7
    description: "The full phase gate (bash scripts/verify-phase-02.sh --build) runs the core diff, the branding check, the customize inertness check, the dev-flag check and the full URI round-trip in that order, and passes end to end with clean process teardown."
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-02.sh --build: diff-theia-core/verify-branding/verify-customize-inert/verify-dev-flag-off/verify-uri-roundtrip all PASS (23/23 URI rows); confirmed no orphaned Firefox process and no leftover /tmp/sourcerer-firefox-bidi-* profile directory afterward"
        status: pass
      - kind: integration
        ref: "nix develop .#theia --command bash scripts/diff-theia-core.sh (full, non-quick mode): PASS, zero changes inside theia/node_modules/@theia/*"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-08-21
status: complete
---

# Phase 2 Plan 7: terminal:, the remaining reverse lookups, and docs/URI-SCHEMES.md Summary

**Terminals get typeable, reload-surviving `t<n>` addresses via a guarded `TerminalFrontendContribution` rebind and the one real `Navigatable` implementation in the phase; a live bug in `@theia/output`'s own `open()` (it silently discarded the channel from `output:<channel>` URIs) is found and fixed; `webview:`/`vscode-extension:` reverse lookups close out the registry; and `docs/URI-SCHEMES.md` documents all seven schemes plus the four D-51 carve-outs, closing URI-02 and URI-04 with `scripts/verify-phase-02.sh --build` green end to end (23/23 round-trip rows).**

## Performance

- **Duration:** ~90 min
- **Tasks:** 3 completed
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `SourcererTerminalFrontendContribution` (guarded `rebind` over `TerminalFrontendContribution`, reaching `TerminalService`, commands, menus, keybindings, toolbar/colour contributions, and the frontend application contribution through the one binding all seven route through) mints `t<n>` identities only when the caller supplied neither `created` nor `id`, scanning `widgetManager.getWidgets('terminal')` for the lowest unused index so a restored layout's names are never reused. Verified live: `t1`/`t2`/`t3` sequencing with no gaps, correct gap-fill after disposal, caller-supplied identities left unchanged, and — the load-bearing D-47 claim — a page reload with two named terminals (`t1`, `t9`) restores both under the identical names.
- `SourcererTerminalWidget` (`rebind(TerminalWidget)`) is the one widget type in this phase with a real `Navigatable` implementation, since `TerminalWidget` genuinely extends `BaseWidget`. `getResourceUri()` reads `this.id` directly (always equal to the minted/caller identity via the shared `terminalIdentityOptions` helper); `createMoveToUri()` returns `undefined`. Deliberately adds no `saveable` property, so Save-As stays off a focused terminal — verified live, not merely inferred from the gate's source.
- `TerminalUriOpenHandler` is a bare `OpenHandler` — not `WidgetOpenHandler`, whose hardcoded `'main'`-area default would have been a real placement regression for Terminal's actual `'bottom'` default — delegating attach/reveal/activate to `TerminalFrontendContribution.open()`, which already implements the correct area logic and the "don't re-add an attached widget" guard. `terminal:t1` focuses without creating; `terminal:t9` (stale) creates a fresh shell under that name; an empty path means the active terminal or a new one.
- **Found and fixed a live bug in `@theia/output` itself:** `OutputContribution.open()` (priority 200) validates the `output:` scheme and then calls `this.openView(options)`, never reading the URI's channel — opening `output:B` right after `output:A` left `OutputChannelManager.selectedChannel` pinned on `A`. `SourcererOutputOpenHandler` (priority 1000) selects the channel first, then delegates the actual reveal to the existing `OutputContribution` instance for its own correct panel placement. Verified live against the real handler chain: `selectedChannel` and `registry.uriOf` both track the second channel correctly.
- `existing-scheme-coverage.ts` adds the remaining reverse lookups: `vscode-extension:` (pure function of `WidgetManager`'s reconstructed `{id, version}`, using Theia's own `VSCodeExtensionUri.fromId`) and the new session-scoped `webview:` scheme (`SourcererWebviewOpenHandler`, reusing `WidgetManager`'s own dedup with no restore machinery added — a stale/absent panel after a restart is the documented "restores a blank panel" degradation, not engineered around). `preference:` needs no new code; verified live that `canHandle(preference:)` is `0` across all four sourcerer-owned handlers.
- `docs/URI-SCHEMES.md` documents all seven schemes (`view:`, `settings:`, `terminal:`, `output:`, `preference:`, `vscode-extension:`, `webview:`), the general opaque-form/lenient-parse/identity-only rules, the full 21-row `view:` address list with the container-not-parts coverage boundary and the runtime-mutation note, the `keybindings.view.widget` dots exception, and the four D-51 carve-outs quoted verbatim from `existing-scheme-coverage.ts`'s own `CARVE_OUTS` list.
- `scripts/verify-phase-02.sh`'s check order corrected to the plan's stated sequence (core diff → branding → customize inertness → dev-flag → URI round-trip; dev-flag and customize-inert had been swapped). Full `bash scripts/verify-phase-02.sh --build` run: all five checks PASS, 23/23 URI round-trip rows (21 `view:` + `settings:` + `terminal:` + all four carve-outs), `diff-theia-core.sh` PASS in full (non-quick) mode, clean process teardown confirmed.

## Task Commits

1. **Task 1: Terminal identity, the terminal: handler, and Terminal's navigable implementation** - `d5c6261` (feat)
2. **Task 2: Registry coverage for the schemes Theia already owns** - `3625442` (feat)
3. **Task 3: docs/URI-SCHEMES.md and the full-phase gate** - `f4ae645` (docs)

## Files Created/Modified

- `theia/extensions/tab-uris/src/browser/terminal-naming-contribution.ts` - `SourcererTerminalFrontendContribution` (identity minting), `SourcererTerminalWidget` (Navigatable), `terminalIdentityOptions` (shared options-shape helper)
- `theia/extensions/tab-uris/src/browser/terminal-open-handler.ts` - `TerminalUriOpenHandler`: bare `OpenHandler` for `terminal:`
- `theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts` - `SourcererOutputOpenHandler` (fixes the live channel-discard bug), `SourcererWebviewOpenHandler`, `extensionDetailUriOf`/`webviewUriOf` reverse-lookup helpers, `CARVE_OUTS`
- `theia/extensions/tab-uris/src/browser/tab-uri-registry.ts` - `uriOf` gains terminal/output/extension-detail/webview branches; injects `OutputChannelManager`
- `theia/extensions/tab-uris/src/browser/tab-uris-frontend-module.ts` - guarded rebinds for `TerminalFrontendContribution`/`TerminalWidget`, bindings for the three new `OpenHandler`s
- `theia/extensions/tab-uris/package.json` - `@theia/terminal`, `@theia/output`, `@theia/plugin-ext-vscode`, `@theia/vsx-registry` added as declared (already-resolved) dependencies
- `docs/URI-SCHEMES.md` - URI-04's deliverable
- `scripts/verify-phase-02.sh` - check order corrected

## Decisions Made

See `key-decisions` in frontmatter for the seven load-bearing notes: the bare-`OpenHandler`-over-`WidgetOpenHandler` choice for Terminal and Output (with the specific area-placement bug it avoids), the live `@theia/output` bug found and fixed, the lenient-parse fix for `output:` channel-name extraction, the shared `terminalIdentityOptions` dedup-key discipline, `SourcererTerminalWidget.getResourceUri()` reading `this.id` directly, the circular-import avoidance in `existing-scheme-coverage.ts`, and the manifest-only nature of the four new `@theia/*` dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `@theia/output`'s own `OutputContribution.open()` discards the URI's channel**
- **Found during:** Task 2, live BiDi verification of the output carve-out's channel-switching behaviour
- **Issue:** `OutputContribution.open(uri, options)` (priority 200, already bound by `@theia/output`) validates `OutputUri.is(uri)` and then calls `this.openView(options)` — it never reads the channel out of `uri` at all. Opening `output:A` then `output:B` left `OutputChannelManager.selectedChannel` pinned on `A`; only the *first* channel a session ever showed ever got selected (via the widget's own first-open auto-select fallback), and every subsequent `output:<channel>` open was a no-op with respect to channel selection.
- **Fix:** `SourcererOutputOpenHandler` (priority 1000, clears the in-tree 200) sets `outputChannelManager.selectedChannel = outputChannelManager.getChannel(<name>)` before delegating the actual widget reveal to the existing `OutputContribution` instance.
- **Files modified:** `theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts`
- **Verification:** Live BiDi against the real handler chain: `selectedChannel.name` and `registry.uriOf(widget).toString(true)` both correctly track the second channel after the fix.
- **Committed in:** `3625442` (Task 2 commit)

**2. [Rule 1 - Bug] The straightforward `OutputUri.channelName` slice assumes a URI form the test harness's shim cannot produce**
- **Found during:** Task 2, first live run of `scripts/verify-uri-roundtrip.mjs`'s `output` carve-out row after wiring `SourcererOutputOpenHandler`
- **Issue:** `OutputUri.channelName(uri)` slices `uri.toString(true)` by `'output:/'.length`, which is correct only for the canonical `output:/<name>` form `vscode-uri`'s `URI.parse(x).with({scheme})` produces for a real app-constructed URI — confirmed by direct `vscode-uri` testing. The round-trip script's own `output:A`/`output:B` test URIs (a hand-shaped `{scheme, path}` shim, necessarily different from a real `URI` instance per this phase's own documented BiDi-reflection constraint) serialize without that leading slash, so the slice produced an empty string and `outputChannelManager.getChannel('')` threw `"'name' must be defined."`.
- **Fix:** Extract the channel name via the same lenient `scheme:path` parse rule (`uri.authority || strip-leading-slash(path.toString())`) `TabUriRegistry.parseName` already uses, rather than `OutputUri.channelName`'s canonical-form-only slice.
- **Files modified:** `theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts`
- **Verification:** `node scripts/verify-uri-roundtrip.mjs`'s `output` carve-out row: FAIL → PASS; full run 23/23.
- **Committed in:** `3625442` (Task 2 commit)

**3. [Rule 3 - Blocking] `yarn install --ignore-scripts --frozen-lockfile` (needed to regenerate the integrity record after adding four declared dependencies) relinked `node_modules` and lost the previously-rebuilt `drivelist.node`**
- **Found during:** Task 3, first full `bash scripts/verify-phase-02.sh --build` run
- **Issue:** Backend boot failed with `Cannot find module 'drivelist/build/Release/drivelist.node'` — a re-link of `node_modules` (triggered by `@sourcerer/tab-uris`'s new `@theia/terminal`/`@theia/output`/`@theia/plugin-ext-vscode`/`@theia/vsx-registry` dependency declarations) discarded the native module build artifact `docs/BUILD.md`'s documented install sequence produces as an explicit follow-up step, not part of a plain `yarn install`.
- **Fix:** Re-ran the documented follow-up: `(cd node_modules/drivelist && node-gyp rebuild)`.
- **Files modified:** none (build artifact only, gitignored)
- **Verification:** `theia/node_modules/drivelist/build/Release/drivelist.node` present; subsequent `bash scripts/verify-phase-02.sh --build` run started the backend cleanly and completed all five checks.
- **Committed in:** n/a (no source change; documented in the Task 3 commit message)

---

**Total deviations:** 3 auto-fixed (two Rule 1 bugs found live while proving this plan's own acceptance criteria; one Rule 3 blocking issue re-triggered by this plan's own dependency-manifest change, resolved via the pre-existing documented procedure).
**Impact on plan:** All three were required for the plan's own verification steps (the channel-switching acceptance criterion, the full round-trip script, and the full-phase gate actually booting) to pass honestly rather than vacuously. No scope creep — none touches a file outside this plan's own `files_modified` list, and none reverses or reinterprets a locked `CONTEXT.md` decision. The `WidgetOpenHandler`-vs-bare-`OpenHandler` choice (documented under Decisions, not here, since it was a design choice made before writing code rather than a fix to broken code) is the one place this plan exercised discretion beyond the plan's literal action text, for the reason stated there.

## Issues Encountered

None beyond the three auto-fixed items documented above, all found through this plan's own prescribed live-BiDi verification process.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 2 is complete: URI-02 and URI-04 close out the phase's remaining requirements, and `bash scripts/verify-phase-02.sh --build` — the full phase gate — is green end to end (all five checks PASS, 23/23 URI round-trip rows including all four D-51 carve-outs, zero drift inside `theia/node_modules/@theia/*` in full non-quick mode, clean process teardown with no orphaned Firefox process or leftover temp profile). `TabUriRegistry`'s public shape (`getViewContribution`, `parseName`, `createWidgetOptions`, `uriOf`) now covers every scheme this phase scoped in, and `docs/URI-SCHEMES.md` is the stable reference the post-4.0 unified browser bridge (`@sourcerer/browser-bridge`) consumes. No blockers.

## Self-Check: PASSED

All 4 created files and 4 modified files confirmed present on disk (verified via `[ -f ... ]` checks during execution); all three task commits (`d5c6261`, `3625442`, `f4ae645`) confirmed present in `git log --oneline`.

---
*Phase: 02-sourcerer-theia-extensions*
*Completed: 2026-08-21*
