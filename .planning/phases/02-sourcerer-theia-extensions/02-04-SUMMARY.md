---
phase: 02-sourcerer-theia-extensions
plan: 04
subsystem: infra
tags: [theia, yarn-classic, ai-ide, inversify, dependency-pinning, webdriver-bidi]

requires:
  - phase: 02-sourcerer-theia-extensions (plan 01)
    provides: "extensions/* workspace glob, @sourcerer/branding package shape, sourcerer-frontend-module.ts as the file this plan extends with two more guarded rebinds"
  - phase: 02-sourcerer-theia-extensions (plan 02)
    provides: "scripts/diff-theia-core.sh, scripts/verify-phase-02.sh sequencing driver, scripts/verify-uri-roundtrip.mjs (red-by-design, unaffected by this plan)"
  - phase: 02-sourcerer-theia-extensions (plan 03)
    provides: "sourcerer-frontend-module.ts's existing isBound-guarded AboutDialog rebind, the pattern this plan's two new rebinds follow"
provides:
  - "The frozen 49-@theia/*-package daily-drivable set (D-19), exact-pinned in both theia/package.json resolutions and applications/browser/package.json dependencies, boots clean"
  - "SourcererAIFirstPerspectiveContribution and SourcererAIConfigurationViewContribution (sourcerer-ai-layout-contribution.ts) -- the two D-22 rebinds neutralizing @theia/ai-ide's first-boot layout forcing"
  - "applications/browser's start script setting VSX_REGISTRY_URL and THEIA_CONFIG_DIR explicitly (with mkdir -p) -- the seam Plan 05's customization hot reload and R9's registry mirror swap depend on"
  - "docs/BUILD.md's Theia half now describes the 49-package install/build reality with real measured numbers, not Phase 1's 11-package figures"
affects: [02-05, 02-06, 02-07]

actuals:
  tokens: 39232
  tasks: 3
  commits: 3

tech-stack:
  added: ["@theia/ai-anthropic, ai-chat, ai-chat-ui, ai-code-completion, ai-core, ai-core-ui, ai-editor, ai-ide, ai-mcp, ai-mcp-ui, ai-openai, ai-terminal, bulk-edit, callhierarchy, console, debug, editor-preview, file-search, notebook, outline-view, output, ovsx-client, plugin, plugin-ext, plugin-ext-vscode, scm, search-in-workspace, task, test, timeline, typehierarchy, userstorage, variable-resolver, vsx-registry (all 1.74.1) and monaco-editor-core (1.108.201) -- the 38 new packages completing the 11->49 set"]
  patterns:
    - "Guarded isBound-rebind of an upstream class token to neutralize a specific method (registerPerspectives, initializeLayout) rather than rebinding the whole class's DI role -- same idiom Plan 03 established for AboutDialog, now applied twice more in the same frontend module"
    - "Re-running an install-script audit as package count grows: a package appearing in the 'carries an install script' list is not automatically load-bearing -- check whether a platform-gated optionalDependency already resolved its native artifact before assuming --ignore-scripts broke something"

key-files:
  created:
    - theia/extensions/branding/src/browser/sourcerer-ai-layout-contribution.ts
  modified:
    - theia/package.json
    - theia/applications/browser/package.json
    - theia/yarn.lock
    - theia/extensions/branding/package.json
    - theia/extensions/branding/src/browser/sourcerer-frontend-module.ts
    - docs/BUILD.md

key-decisions:
  - "VSX_REGISTRY_URL and THEIA_CONFIG_DIR (Task 2's stated deliverable) were written into applications/browser/package.json's start script in the same edit pass as Task 1's dependency-set extension, since both touched the same script block of the same file. Verified as part of Task 1's own build/boot check, then re-verified explicitly under Task 2's acceptance criteria (fresh THEIA_CONFIG_DIR boot, WidgetManager.getWidgets('ai-configuration') checks) before committing Task 2. Not a plan deviation in the Rule 1-4 sense -- purely a sequencing note so a later reader isn't confused about which commit introduced which line."
  - "theia rebuild:browser's actual output at 49 packages is a single generic line ('native node modules are already rebuilt for browser'), not a per-module skip list -- verified by reading @theia/application-manager's rebuild.js: it only does per-module backup/revert work when reverting a previous ELECTRON-target rebuild, which this browser-only app never performs. Phase 1's docs/BUILD.md paragraph naming four skipped modules (native-keymap, find-git-repositories, drivelist, keytar) was never literal command output at any package count -- corrected in Task 3 rather than left stale."
  - "Of the 7 packages carrying an install/preinstall/postinstall script in the 49-package tree (@parcel/watcher, drivelist, esbuild, keytar, msgpackr-extract, node-pty, puppeteer), only drivelist is load-bearing under --ignore-scripts. node-pty/@parcel/watcher/msgpackr-extract/esbuild each resolve their native artifact through a platform-gated optionalDependency package already installed by Yarn Classic (the same @vscode/ripgrep mechanism D-26 documents); keytar is browser-inapplicable; puppeteer is @theia/cli's own dependency whose Chromium-download postinstall is exactly what --ignore-scripts exists to skip."

requirements-completed: [URI-03]

coverage:
  - id: D1
    description: "The app composes exactly 49 @theia/* packages, every one pinned exact in both applications/browser/package.json dependencies and theia/package.json resolutions -- all 1.74.1 except @theia/monaco-editor-core at 1.108.201 -- with none of D-28's 35 excluded names present as a dependency anywhere in the workspace"
    requirement: "URI-03"
    verification:
      - kind: unit
        ref: "node -e (Task 1's plan-specified inline check): counts @theia/* keys in applications/browser dependencies (49), validates every pin against the monaco-editor-core exception, validates resolutions block covers all 49 identically plus @theia/cli -- PASS"
        status: pass
      - kind: unit
        ref: "node -e scan of applications/browser/package.json dependencies+devDependencies against D-28's 35-name exclusion list -- zero hits"
        status: pass
    human_judgment: false
  - id: D2
    description: "yarn install --ignore-scripts followed by the explicit drivelist node-gyp rebuild still produces a tree the app boots from at 49 packages -- the audited install sequence holds -- and the re-run install-script audit is recorded with real numbers (1,058 transitive packages at depth<=3, 7 carrying a script, drivelist the only load-bearing one)"
    verification:
      - kind: integration
        ref: "nix develop .#theia -- yarn install --ignore-scripts (42.30s), node-gyp rebuild in node_modules/drivelist (produces drivelist.node), yarn build (0 errors), yarn --cwd applications/browser start reaching HTTP 200 on :3000 within 3s -- all PASS; scripts/diff-theia-core.sh PASS (zero @theia/* drift)"
        status: pass
      - kind: unit
        ref: "audit script (find node_modules -maxdepth 3 -name package.json, scan .scripts for install/preinstall/postinstall) against the 49-package tree: 1058 package.json files scanned, 7 hits recorded in the plan summary and docs/BUILD.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "SourcererAIFirstPerspectiveContribution no-ops registerPerspectives (the AI-first perspective is never registered/selectable) and SourcererAIConfigurationViewContribution no-ops initializeLayout (the ai-configuration widget no longer forces a main-area tab open on a fresh layout) while openView()/registerCommands stay intact -- both wired via the isBound-guarded rebind idiom"
    requirement: "URI-03"
    verification:
      - kind: e2e
        ref: "WebDriver BiDi against a fresh THEIA_CONFIG_DIR boot: WidgetManager.getWidgets('ai-configuration').length === 0 immediately after fresh-layout init; after executing the 'aiConfiguration:open' command, .length === 1 with id 'ai-configuration' -- both PASS, matching the plan's literal acceptance criteria"
        status: pass
      - kind: e2e
        ref: "WebDriver BiDi: with the ai-features.AiEnable.enableAI preference flipped on (default off, untouched per D-22), commandRegistry.executeCommand('aiChat:toggle') opens the chat view, chatService.sendRequest(session.id, {text:'hello'}) completes with no uncaught exception -- confirms @theia/ai-ide's ChatAgent binding survives both rebinds"
        status: pass
    human_judgment: false
  - id: D4
    description: "VSX_REGISTRY_URL is set explicitly to https://open-vsx.org (not defaulted) and THEIA_CONFIG_DIR is set explicitly with a preceding mkdir -p, both in applications/browser/package.json's start script; no model API key or default model literal appears anywhere in the workspace"
    requirement: "URI-03"
    verification:
      - kind: unit
        ref: "grep -c 'VSX_REGISTRY_URL=https://open-vsx.org' and grep -c 'THEIA_CONFIG_DIR' against applications/browser/package.json, both >=1, same script line contains mkdir -p -- PASS"
        status: pass
      - kind: integration
        ref: "Booting via the start script created ${XDG_CONFIG_HOME:-$HOME/.config}/sourcerer (confirmed via the backend log line 'Configuration directory URI: file:///home/chris/.config/sourcerer') -- PASS"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/BUILD.md's Theia half describes the 49-package reality with real measured numbers (not Phase 1's stale 11-package figures), and the full check suite's end-of-Wave-3 state is recorded so the next wave knows which reds are load-bearing"
    verification:
      - kind: integration
        ref: "bash scripts/diff-theia-core.sh (PASS) and bash scripts/verify-phase-02.sh --build: diff-theia-core PASS, verify-branding PASS, verify-dev-flag-off PASS (green for the wrong reason -- token not registered until Plan 05), verify-uri-roundtrip FAIL as expected (TabUriRegistry not bound until Plan 06) -- exactly the three states the plan's own text predicts"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-21
status: complete
---

# Phase 2 Plan 04: 11->49 Package Expansion and AI First-Boot Neutralization Summary

**The frozen 49-`@theia/*`-package daily-drivable set landed exact-pinned and boots clean; two guarded rebinds stop `@theia/ai-ide`'s AI-first perspective and forced AI-configuration tab from hijacking first boot; `docs/BUILD.md` now tells the truth about the install at this size, including a correction to Phase 1's `theia rebuild:browser` claim.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `theia/package.json`'s `resolutions` block and `theia/applications/browser/package.json`'s `dependencies` both now list all 49 `@theia/*` packages from D-19's frozen set, every one `1.74.1` except `@theia/monaco-editor-core` at `1.108.201`, verified programmatically and confirmed absent of every one of D-28's 35 excluded names.
- Re-ran Phase 1's install-script audit at the new tree size: 1,058 transitive packages (depth ≤ 3) vs. Phase 1's 1,042, with 7 carrying an `install`/`preinstall`/`postinstall` script (`@parcel/watcher`, `drivelist`, `esbuild`, `keytar`, `msgpackr-extract`, `node-pty`, `puppeteer`) vs. Phase 1's 9. `drivelist` remains the only load-bearing one under `--ignore-scripts`; the other six resolve via a platform-gated `optionalDependency` already installed, are browser-inapplicable, or (puppeteer, `@theia/cli`'s own dependency) are exactly what `--ignore-scripts` exists to keep from fetching.
- `SourcererAIFirstPerspectiveContribution` and `SourcererAIConfigurationViewContribution` (`sourcerer-ai-layout-contribution.ts`) neutralize the two D-22 first-boot behaviours via the same `isBound`-guarded rebind idiom Plan 03 established for `AboutDialog`. `AIActivationService` stays untouched (default-off, `ai-ide`'s own preference-gated implementation) — verified live that flipping the `ai-features.AiEnable.enableAI` preference on still lets the chat view open, a session send a request, and nothing throw.
- `applications/browser/package.json`'s `start` script now exports `VSX_REGISTRY_URL=https://open-vsx.org` and `THEIA_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sourcerer"` (with a preceding `mkdir -p`) explicitly rather than relying on Theia's defaults — verified end to end with a fresh config dir boot.
- `docs/BUILD.md`'s Theia half now records the 49-package audit numbers, corrects Phase 1's `theia rebuild:browser` skip-list claim after reading `@theia/application-manager`'s actual `rebuild.js` (the four-name list was never literal command output — the command only does per-module work when reverting an electron-target rebuild, which this project never performs), documents the `@vscode/ripgrep` no-gate-applies mechanism, the no-bundled-VSIX-extensions state, the two `start`-script env vars, and re-measured cold/warm boot timings (23.4s cold / 18.1s warm, up from Phase 1's 70s/11.9s at 11 packages — with the cold figure honestly flagged as not network-cold, since Yarn's package cache was already warm from this session's repeated installs).
- Full end-of-Wave-3 gate run: `scripts/diff-theia-core.sh` PASS, `scripts/verify-phase-02.sh --build` reports `diff-theia-core` PASS, `verify-branding` PASS, `verify-dev-flag-off` PASS (green for the wrong reason — the dev-flag token isn't registered until Plan 05), `verify-uri-roundtrip` FAIL as expected (`TabUriRegistry` not bound until Plan 06) — exactly the three states this plan's own text predicts, recorded so Plan 05/06 don't mistake the URI-roundtrip red for a regression.
- No Firefox process or temp profile was left behind by any headless verification run in this plan (checked via `pgrep` after every BiDi session and after every `theia start`/`verify-phase-02.sh` invocation).

## Task Commits

1. **Task 1: Expand the dependency set from 11 to 49 packages and re-run the install-script audit** - `4760321` (feat)
2. **Task 2: Neutralize the two first-boot AI layout behaviours and pin the registry URL** - `f3aca3b` (feat)
3. **Task 3: Update docs/BUILD.md and gate the expansion against the full check suite** - `a1ac4b7` (docs)

## Files Created/Modified
- `theia/package.json` - `resolutions` extended to all 49 `@theia/*` names plus `@theia/cli`
- `theia/applications/browser/package.json` - `dependencies` extended to 49 `@theia/*` entries, `theia.frontend.config.preferences["security.workspace.trust.enabled"] = false` added, `start` script now sets `VSX_REGISTRY_URL`/`THEIA_CONFIG_DIR` (with `mkdir -p`)
- `theia/yarn.lock` - regenerated for the 38 newly-added `@theia/*` packages and their transitive dependencies
- `theia/extensions/branding/package.json` - `@theia/ai-ide` added as a direct dependency at `1.74.1`
- `theia/extensions/branding/src/browser/sourcerer-ai-layout-contribution.ts` - `SourcererAIFirstPerspectiveContribution`, `SourcererAIConfigurationViewContribution`
- `theia/extensions/branding/src/browser/sourcerer-frontend-module.ts` - wired both new rebinds through the guarded `isBound`/`rebind` idiom
- `docs/BUILD.md` - Theia half rewritten for the 49-package reality: audit numbers, corrected `rebuild:browser` claim, ripgrep mechanism, no-bundled-plugins note, env-var documentation, re-measured timings

## Decisions Made
See `key-decisions` in frontmatter for the three load-bearing notes: the Task 1/Task 2 sequencing of the registry-URL/config-dir edit, the `theia rebuild:browser` correction (verified against source, not assumed), and the install-script-audit load-bearing/not-load-bearing breakdown for the 6 non-`drivelist` hits.

## Deviations from Plan

None — plan executed exactly as written. The registry-URL/config-dir sequencing note above is a commit-boundary clarification, not a deviation: both tasks' acceptance criteria were independently verified before their respective commits, and no code differs from what the plan specified.

## Threat Model Carry-Forward (D-29)

Per the plan's Task 1 `<read_first>` instruction: **`@theia/ai-terminal`'s backend `ShellExecutionServer` calls `spawn(command, [], { shell: true })` with no permission logic — all approval machinery is frontend-only.** This is now live in the tree (the package shipped in Task 1). No mitigation was attempted here, per D-29's explicit instruction — the sidecar's per-launch token gate that guards this does not exist until Phase 4. This entry belongs in `sourcerer/INTERNAL-APIS.md`'s threat section when Phase 4 creates it; recorded here so it is not rediscovered.

## Issues Encountered
None beyond the two source-reading investigations documented in Decisions Made (the `theia rebuild:browser` cache-branch logic, and the `AIActivationService`/`canRun` preference-and-workspace-trust gating needed to construct a real "send a chat message" proof) — both resolved by reading the pinned `1.74.1` source directly rather than assumed.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
The 49-package set is frozen and boots clean, `@theia/userstorage` is present as a direct dependency (D-56, ready for Plan 05's customization layer), `VSX_REGISTRY_URL`/`THEIA_CONFIG_DIR` are both explicit (ready for Plan 05's hot-reload dependency on the config-dir watch and R9's later registry-mirror swap), and every widget type the URI registry (Plan 06) must address is now present in the tree — no package will be added after this point that would silently owe an address. `scripts/verify-uri-roundtrip.mjs`'s 23 non-carve-out rows remain correctly red pending Plan 06's `TabUriRegistry`. No blockers.

## Self-Check: PASSED

All 7 created/modified files confirmed present on disk (verified via `ls`/`git show --stat` above); all three task commits (`4760321`, `f3aca3b`, `a1ac4b7`) confirmed in `git log`.

---
*Phase: 02-sourcerer-theia-extensions*
*Completed: 2026-08-21*
