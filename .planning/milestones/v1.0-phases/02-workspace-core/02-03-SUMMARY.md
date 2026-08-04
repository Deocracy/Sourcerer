# 02-03 SUMMARY — Chrome Rework human-verify (D-03)

**Plan:** 02-03 (workspace-core) · checkpoint:human-verify · `autonomous: false`
**Result:** ✅ PASSED (with two regressions caught + fixed during verification; DPI deferred)
**Verified:** 2026-07-08 on a real Tauri window + cross-checked in-browser (chrome-devtools).

## What was verified
- **40px title bar** — wordmark "Sourcerer", DIVI chip, "— Default" corpus label, two rail-toggle SVG buttons, min/max/close all render left→right. Bar height measured exactly 40px.
- **Floating rounded window** — 10px-radius card, 1px border, drop shadow, 20px transparent inset margin (desktop shows through the `transparent:true` window). Card rect inset 20px on all sides.
- **Drag isolation** — exactly one `data-tauri-drag-region` element (the empty spacer); DIVI chip and all window-control buttons carry no drag attribute.
- **Rail-toggle** — clicking cycles the store value (rail body itself is plan 02-04; only the store change is in scope here). User-confirmed visually.

## Regressions caught by this checkpoint (the reason it exists) + fixes
1. **Opaque black box instead of a floating card.** The Chrome Rework painted the opaque `--window-backdrop` radial gradient across the entire transparent OS window, so `transparent:true` did nothing and the corners were a hard rectangle. **Fix** (`fix(02-03): make floating window actually float`): body + 20px `.backdrop` margin made transparent; radial gradient moved onto the rounded `.card`. Now the desktop shows through the margin and the shadow floats over it.
2. **Window controls pushed inward / title bar not full-width.** A parallel phase (Phase 07, `07-04`) had mounted `AssistantPanel` as a full-height sibling column next to the shell, confining the title bar to the main column. **Fix** (`fix(02-03): full-width title bar; assistant into body row`): restructured to the handoff card grid (`40px / 1fr`) — TitleBar is now a full-width row with controls at the card's top-right corner; the body is a flex row of `[main workspace | right-rail AssistantPanel]`. `AppShell` now owns the card interior layout. tsc clean, 15/15 tests pass.

## Deferred / follow-ups
- **DPI 100/125/150% crispness** — NOT scale-tested this session; deferred to the consolidated human-verify in 02-06. Maps to the open Phase-1 blocker "Confirm PerMonitorV2 DPI awareness so 1px borders hold at 125%/150%".
- **`window.shellStore` not exposed** — the plan's "inspect via console `shellStore.getState().railMode`" affordance doesn't work (store isn't global). Minor; visual toggle confirmed instead. Consider exposing in dev builds.

## Cross-phase note
Phase 07 and Phase 02 were both committing shell-layout edits to `master`, which caused regression #2. Phase 07 was paused; an ownership boundary was handed off (Phase 02 owns `App.tsx`/`AppShell.*`/`src/shell/*`/`tokens.css`/window config; Phase 07 owns `src/assistant/**` + `host.ai()` seam + sidecar). `AppShell` mounts `<AssistantPanel />` in the right-rail slot — Phase 07 must not re-mount it in `App.tsx`.

## Self-Check: PASSED
- Chrome Rework verified on a real window; both regressions fixed and committed; tsc + tests green.
