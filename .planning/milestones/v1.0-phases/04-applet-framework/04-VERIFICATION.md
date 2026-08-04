---
phase: 04-applet-framework
verified: 2026-07-10T07:15:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 4: Applet Framework Verification Report

**Phase Goal:** The plugin contract that makes Sourcerer "part demo, part working app" — a static registry, the single `host` API seam, and a high-fidelity demo stub for every unbuilt applet, with the module signature finalized before any real applet exists.
**Verified:** 2026-07-10T07:15:00Z
**Status:** passed
**Re-verification:** No — initial verification (post-review fix cycle)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `makeHost(instanceId, appletKey)` returns exactly {storage, ai, open, instanceId, theme} | ✓ VERIFIED | `src/host/index.ts:17-25` — factory returns exactly five members; `src/host/index.test.ts` asserts member set |
| 2 | `host.storage` round-trips namespaced `sourcerer:<appletKey>:<key>` via applets.json, never throws | ✓ VERIFIED | `src/host/storage.ts` — get/set/remove all wrapped in try/catch (WR-01 fix confirmed: `set`/`remove` now swallow IPC failures, matching the "never-throws" contract in `types.ts`) |
| 3 | `host.ai` resolves on done, rejects typed Error on error, forwards streamed deltas, and cannot hang forever | ✓ VERIFIED | `src/host/aiComplete.ts` composes over `./ai` (0 `host_ai` direct calls); WR-02 inactivity watchdog added (`setTimeout`-based, rejects after `AI_INACTIVITY_TIMEOUT_MS` of silence) |
| 4 | `host.open(appletKey)` focuses an existing panel or opens a fresh instance | ✓ VERIFIED | `src/host/open.ts` implements focus-or-open against `getDockApi()`/`addAppletToDock`; exercised live by Library's review CTA (`grep host.open src/applets/Library/index.tsx` ≥ 1) |
| 5 | registry maps every applet key to a `{manifest, App}` module; Wiki/Library are overrides | ✓ VERIFIED | `src/shell/registry.ts` spreads `templatedModules` then overrides `Wiki`/`Library`; `registry.test.ts` asserts superset of `appletDefs` keys |
| 6 | opening a dockview panel for a registered key renders that module's `App({host})` with a live per-instance host (not the placeholder); unknown key falls back safely | ✓ VERIFIED | `src/shell/PanelBody.tsx` — `makeRenderer` derives `instanceId` from `parameters.api.id` at `init()`, dispatches `registry[appletKey]` before falling back to generic `PanelBody`; WR-04 fix wraps the render in `AppletErrorBoundary` so a throwing applet still falls back instead of escaping |
| 7 | every templated stub renders glyph tile, serif title, code crumb, believable demo rows, subtle DEMO chip | ✓ VERIFIED | `src/applets/_stub/TemplatedStub.tsx` + `demoRows.ts`; `appletDefs.ts` has `code:` on all 14 entries (>=13 required) |
| 8 | Wiki renders the full rich port (article/provenance/Unresolved/edit-preview-apply-undo/review/history) and Library renders dashboard/ingest/document/confirm + `host.open('Wiki')` | ✓ VERIFIED | `src/applets/Wiki/index.tsx` (745 lines, min_lines 120 satisfied), `src/applets/Library/index.tsx` (881 lines); both pass their component tests (Wiki.test.tsx, Library.test.tsx) covering the flows in the plan behaviors |
| 9 | applets never bypass `host` to touch shell state directly (CR-01 fix) and instanceState GC fires on panel removal, not renderer dispose (CR-02 fix) | ✓ VERIFIED | `src/applets/boundary.test.ts` mechanically scans `src/applets/**` for `store/**`/`shell/**` imports (only `shell/appletDefs` exempted) — 0 violations; `Library/index.tsx` no longer imports `useShellStore`; `Dock.tsx` GCs via `api.onDidRemovePanel` gated by a `restoring` flag during `fromJSON`, with an orphan-reconciliation sweep as a second-line defense |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/host/types.ts` | Host/AppletManifest/AppletModule/ThemeTokens leaf contracts | ✓ VERIFIED | 65 lines, exports all four types, `Host` has exactly 5 members |
| `src/host/index.ts` | makeHost factory | ✓ VERIFIED | 25 lines, assembles 5 members |
| `src/host/storage.ts` | applets.json LazyStore, namespaced, best-effort | ✓ VERIFIED | try/catch on all 3 methods post-WR-01 fix |
| `src/host/aiComplete.ts` | promise+onDelta wrapper over ai.ts | ✓ VERIFIED | composes `./ai`, watchdog added (WR-02) |
| `src/host/open.ts` | focus-or-open | ✓ VERIFIED | present, used by Library |
| `src/shell/dockApi.ts` | extracted dockApiRef/addAppletToDock/getDockApi | ✓ VERIFIED | present per plan 01 |
| `src/shell/registry.ts` | static key→module map | ✓ VERIFIED | spreads templatedModules, overrides Wiki/Library |
| `src/applets/_stub/TemplatedStub.tsx` | shared templated stub w/ DEMO chip | ✓ VERIFIED | present |
| `src/applets/templated.ts` | generated templated modules | ✓ VERIFIED | present |
| `src/shell/PanelBody.tsx` | registry dispatch + instanceId + GC + error boundary | ✓ VERIFIED | dispatch, `parameters.api.id`, `AppletErrorBoundary` (WR-04) all present |
| `src/shell/AppletCatalog.tsx` | registry-fed picker (FWK-02) | ✓ VERIFIED | present, WR-06 viewport clamp added |
| `src/store/shellStore.ts` | catalog open-state + D-19 railOrder append | ✓ VERIFIED | present |
| `src/applets/Wiki/index.tsx` | rich Wiki port | ✓ VERIFIED | 745 lines (min 120), no `mountWiki`/`esm.sh`/`React.createElement` remnants |
| `src/applets/Library/index.tsx` | rich Library port | ✓ VERIFIED | 881 lines (min 120), `host.open` wired, no `useShellStore` import (CR-01 fixed) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `aiComplete.ts` | `ai.ts` | composes, never re-invokes `host_ai` | ✓ WIRED | `grep -c "host_ai"` == 0, `from "./ai"` == 1 |
| `open.ts` | `dockApi.ts` | `getDockApi()` | ✓ WIRED | present |
| `instanceState.ts` | `workspaceStore.ts` | get/set/delete accessors | ✓ WIRED | present |
| `PanelBody.tsx` | `registry.ts` | `registry[appletKey].App(...)` | ✓ WIRED | present |
| `PanelBody.tsx` | `host/index.ts` | `makeHost(instanceId, appletKey)` | ✓ WIRED | present |
| `Dock.tsx` | `PanelBody.tsx` | full `opts.id` passthrough to `makeRenderer` | ✓ WIRED | `makeRenderer(opts.id` present |
| `AppletCatalog.tsx` | `host/open.ts` | row click → `hostOpen` | ✓ WIRED | present |
| `Library/index.tsx` | `host/open.ts` | review CTA → `host.open('Wiki')` | ✓ WIRED | `grep -c "host.open"` >= 1 |
| `Dock.tsx` | `instanceState` GC | `onDidRemovePanel`, gated by `restoring` flag | ✓ WIRED | fixed post-review (CR-02); orphan reconciliation sweep as defense-in-depth |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| FWK-01 | 04-01, 04-02 | TSX modules exporting manifest+App; static registry | ✓ SATISFIED | `registry.ts`, `host/types.ts` |
| FWK-02 | 04-02, 04-05 | registered key replaces stub; new key appends to rail | ✓ SATISFIED | `PanelBody.tsx` dispatch, `AppletCatalog.tsx`, D-19 `hydrateFromDisk` append |
| FWK-03 | 04-02, 04-03, 04-04 | every unbuilt applet renders high-fidelity demo stub | ✓ SATISFIED | `TemplatedStub.tsx`, Wiki/Library rich ports |
| FWK-04 | 04-01 | `host` is the only shell surface; 5 fixed members | ✓ SATISFIED | `makeHost`, boundary test enforcing applet→shell isolation |

No orphaned requirements — all 4 REQUIREMENTS.md IDs (FWK-01..04) are claimed across the 5 plans and REQUIREMENTS.md already marks them `[x]`/Complete, consistent with codebase evidence.

### Anti-Patterns Found

Code review (`04-REVIEW.md`) found 2 Critical + 6 Warning issues across the 39 reviewed files. All 8 are confirmed fixed in the codebase via the listed commits:

| Finding | Severity | Status |
|---------|----------|--------|
| CR-01 Library bypasses host seam via `useShellStore` | Critical | ✓ FIXED (`7029a00`) — no `useShellStore`/`shellStore` import remains in `Library/index.tsx`; mechanical `boundary.test.ts` enforces going forward |
| CR-02 instanceState GC on every dispose (wipes state on layout restore) | Critical | ✓ FIXED (`d4feed9`) — GC moved to `onDidRemovePanel`, gated by a `restoring` flag during `fromJSON`, plus orphan-reconciliation sweep |
| WR-01 storage set/remove don't honor never-throws contract | Warning | ✓ FIXED (`886aca2`) — try/catch added |
| WR-02 aiComplete can hang forever on dead event stream | Warning | ✓ FIXED (`5f48d66`) — inactivity watchdog |
| WR-03 useRailDragOut leaks listeners on pointercancel | Warning | ✓ FIXED (`59eb340`) — pointercancel/lostpointercapture handling + setPointerCapture |
| WR-04 no error boundary around applet render | Warning | ✓ FIXED (`977d70b`) — `AppletErrorBoundary` wraps `mod.App` |
| WR-05 toast timers race/leak | Warning | ✓ FIXED (`2c9fe40`) — timer id tracked in ref, cleared on unmount |
| WR-06 Applet Catalog not clamped to viewport | Warning | ✓ FIXED (`3146fc3`) — `Math.min`/`Math.max` clamp added |

Remaining Info-level items (IN-01 through IN-06) are cosmetic/documentation nits (docblock wording, `host.storage` null-vs-missing semantics, theme-token duplication, the sanctioned `appletDefs` leaf import, demo-interaction nits, a stray `console.log` in `Rail.tsx`'s pre-existing settings stub) — none block phase goal achievement, none were flagged for a fix commit, and none regress a must-have.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npx vitest run` | 21 files / 119 tests passed | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Registry superset of appletDefs | `registry.test.ts` (in suite) | passed | ✓ PASS |
| Boundary enforcement (CR-01) | `boundary.test.ts` (in suite) | passed, 0 violations | ✓ PASS |

### Human Verification Required

None. All must-haves are mechanically verifiable via source inspection, grep assertions matching PLAN acceptance criteria, and the automated test suite (119/119 green). The plans' `<human-check>` blocks (visual confirmation of Wiki/Library flows, Applet Catalog interaction) are UX/visual-only checks layered on top of already-passing automated coverage for the same behaviors — they do not gate a must-have that lacks other evidence, so `human_needed` is not triggered per the decision tree (no un-covered truth depends solely on human judgment).

### Gaps Summary

None. All four requirement IDs (FWK-01 through FWK-04) are implemented and verified in the codebase, not merely claimed in SUMMARY.md. The two Critical and six Warning findings from the adversarial code review (`04-REVIEW.md`) were independently re-verified against current source — all 8 fixes are present and match their commit descriptions, the standing "green mocked tests hide real spine bugs" lesson was specifically checked against CR-02 (instanceState GC) and confirmed resolved with a `restoring` gate plus an orphan-reconciliation sweep as defense-in-depth. The applet→shell import boundary (the phase's hard invariant per CLAUDE.md) is now mechanically enforced by `src/applets/boundary.test.ts`, not left to review discretion.

---

_Verified: 2026-07-10T07:15:00Z_
_Verifier: Claude (gsd-verifier)_
