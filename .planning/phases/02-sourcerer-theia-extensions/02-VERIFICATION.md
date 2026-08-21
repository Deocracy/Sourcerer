---
phase: 02-sourcerer-theia-extensions
verified: 2026-08-21T03:10:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: Sourcerer Theia Extensions Verification Report

**Phase Goal:** The standalone Theia app is Sourcerer-branded, exposes an
inert customization seam, and gives every tab a URL — entirely via
`@sourcerer/*` extensions with Theia core untouched.
**Verified:** 2026-08-21T03:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP §"Phase 2" success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening the app shows Sourcerer identity in welcome widget, About dialog, window/tab title, favicon — no "Theia"/"Eclipse" in user-visible chrome | ✓ VERIFIED | `sourcerer-about-dialog.tsx` overrides `render()` entirely (no `renderHeader()`/`renderExtensions()` call — both identity-leaking base renderers are dropped, not restyled, per D-35). `sourcerer-welcome-widget.tsx` shows name/version/repo link only, no Theia/Eclipse string. `applicationName: "Sourcerer"` set in `applications/browser/package.json`. Favicon injected via `SourcererFaviconContribution`. Live re-run of `scripts/verify-branding.mjs` (part of `verify-phase-02.sh`) PASSED: title, favicon, welcome, and about surfaces all confirmed live in the running page, not by source inspection. |
| 2 | Diffing the workspace against the pinned Theia release shows zero changes inside `@theia/*`; branding arrives entirely by DI rebind | ✓ VERIFIED | `scripts/diff-theia-core.sh` re-run live in **full mode** (stage 2, fresh-resolve `diff -rq` against a clean `yarn install --frozen-lockfile` of the same manifests in a temp dir — not `--quick`/stage-1-only). Result: `PASS -- zero changes inside @theia/*`. All three upstream-bug workarounds (output `open()` discarding channel, `AbstractViewContribution.openView()` return value, AI-chat `isExtractable` race) live exclusively in `theia/extensions/*/src/browser/*` files, confirmed by grep — none touch `theia/node_modules/@theia`. |
| 3 | User CSS restyles the app; empty file renders identically to stock; dev flag off ⇒ no privileged JS binding at runtime | ✓ VERIFIED | `customize-frontend-module.ts` reads `FrontendApplicationConfigProvider.get()['sourcererPrivilegedJs']` inside the `ContainerModule` callback and skips `bind(SourcererPrivilegedJs)`/`bind(CustomizePrivilegedJsContribution)` entirely when false — the binding is never registered, not runtime-guarded (D-62). `applications/browser/package.json` ships `"sourcererPrivilegedJs": false`. Live re-run of `scripts/verify-dev-flag-off.mjs` (default mode, asserting `window.theia.container.isBound(Symbol.for('SourcererPrivilegedJs')) === false` evaluated in the running page against the `lib/`-served build) PASSED. The script has a working positive control (`--expect-bound`) per D-64/RESEARCH Assumptions Log A1, avoiding both vacuous-pass modes (src-gen vs lib; grep vs live-page eval). `scripts/verify-customize-inert.mjs` (pixel-comparison proof, part of the same driver run) also PASSED. |
| 4 | Copying a URI off a settings/terminal/AI-chat tab and passing to `OpenerService.open()` opens/focuses that exact tab; no shipped widget reports an empty resource URI | ✓ VERIFIED | Live re-run of `scripts/verify-uri-roundtrip.mjs` iterated the full FactoryId table: **23/23 rows PASS**, including `view:chat-view-widget`, `view:ai-configuration`, `view:ai-sessions-widget`, `settings:`, `terminal:`, and the four documented D-51 carve-outs (`output`, `editor-preview`, `vscode-notebook-cell`, `webview`), each explicitly asserted rather than silently skipped. `terminal-naming-contribution.ts`'s `SourcererTerminalWidget implements Navigatable` with `getResourceUri()` returning `terminal:<id>`, and deliberately omits a `saveable` property so `Saveable.isSource` fails the Save-As gate's first test (D-52) — verified live per the code comment, not merely inferred. |
| 5 | Per-scheme semantics documented and URIs typeable by hand | ✓ VERIFIED | `docs/URI-SCHEMES.md` (252 lines) documents every scheme (`view:`, `settings:`, `terminal:`, `output:`, `preference:`, `vscode-extension:`, `webview:`), the four lenient-parse spellings, the opaque canonical form, and all four D-51 degradation cases with rationale. `docs/CUSTOMIZE.md` (89 lines) documents the CSS/JS layer. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `theia/extensions/branding/` | Welcome widget, About dialog, favicon, title | ✓ VERIFIED | All present, compiled to `lib/`, wired into `sourcerer-frontend-module.ts` |
| `theia/extensions/customize/` | CSS layer + gated privileged JS layer | ✓ VERIFIED | Present, compiled, D-62 gate implemented exactly as specified |
| `theia/extensions/tab-uris/` | Registry, `view:`/`settings:`/`terminal:` handlers, existing-scheme coverage | ✓ VERIFIED | Present, compiled, 23/23 URI round-trip rows pass |
| `scripts/diff-theia-core.sh`, `verify-branding.mjs`, `verify-customize-inert.mjs`, `verify-dev-flag-off.mjs`, `verify-uri-roundtrip.mjs`, `verify-phase-02.sh` | Wave-0 verification harness | ✓ VERIFIED | All five checks independently re-executed live in this verification pass; all PASS |
| `docs/URI-SCHEMES.md`, `docs/CUSTOMIZE.md` | Per-scheme and customization docs | ✓ VERIFIED | Present, complete, cover all schemes and carve-outs |
| `logo/` | Vector mark, tracked in git | ✓ VERIFIED | `git ls-files logo/` returns all 3 files |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `theia/applications/browser/package.json` dependencies | `theia/extensions/*` | direct workspace dependency (D-31) | ✓ WIRED | `@sourcerer/branding`, `@sourcerer/customize`, `@sourcerer/tab-uris` all present as direct deps in `dependencies` |
| `theia/package.json` `workspaces` | `extensions/*` | glob | ✓ WIRED | Confirmed via successful `theia build` and live app boot with all three extension bundles loaded |
| `@sourcerer/customize` | `@sourcerer/tab-uris` `TabUriRegistry` | `isBound`-guarded optional injection | ✓ WIRED | `customize-frontend-module.ts` guards with `ctx.container.isBound(TabUriRegistry)` |
| `sourcerer-frontend-module.ts` `rebind(AboutDialog)` | `SourcererAboutDialog` | `isBound`-guarded rebind | ✓ WIRED | Confirmed live via `verify-branding.mjs`'s about-dialog check |

### Package Composition Audit (D-19, D-28)

- 49 direct `@theia/*` dependencies in `applications/browser/package.json`, all pinned exact: `1.74.1` except `@theia/monaco-editor-core` at `1.108.201`. Programmatic check found zero mispins.
- `resolutions` block in `theia/package.json` covers all 49 names plus `@theia/cli` (50 entries), zero mispins.
- Every package on D-28's exclusion list (`mini-browser`, `ai-mcp-server`, `metrics`, `toolbar`, `secondary-window`, `terminal-manager`, `memory-inspector`, `getting-started`, etc. — 27 names checked) confirmed absent from the dependency tree.
- `@types/react@18.3.31` / `@types/react-dom@18.3.7` present as exact-pinned devDependencies in `theia/package.json` (type-only, not runtime deps).

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented|placeholder` across all phase-02 files under `theia/extensions/*`, `scripts/*`, `docs/*` (excluding pre-existing `docs/PRODUCT-REQUIREMENTS.md` / `docs/research/earlier-project-brief.md`, which predate this phase) returned zero hits.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| BRAND-05 | 02-01, 02-03 | Theia-side branding via DI rebind, no core patch | ✓ SATISFIED | Truth 1, 2 above |
| CUST-01 | 02-05 | Runtime user CSS layer, empty by default = zero visual change | ✓ SATISFIED | Truth 3 above, pixel-comparison proof |
| CUST-02 | 02-01, 02-02, 02-05 | Privileged JS layer gated by dev flag, absent binding when off | ✓ SATISFIED | Truth 3 above, live positive+negative control |
| URI-01 | 02-02, 02-06 | Settings widget addressable under `settings:` | ✓ SATISFIED | Truth 4, `settings:` row PASS |
| URI-02 | 02-07 | Terminal implements `Navigatable` under `terminal:` | ✓ SATISFIED | Truth 4, `terminal-naming-contribution.ts` |
| URI-03 | 02-02, 02-04, 02-06 | Every other non-document widget type has an address | ✓ SATISFIED | Truth 4, 23/23 round-trip rows including AI chat/config/sessions |
| URI-04 | 02-07 | URIs typeable/copy-pasteable, per-scheme semantics documented | ✓ SATISFIED | Truth 5, `docs/URI-SCHEMES.md` |

No orphaned requirements — all 7 phase-02 requirement IDs from ROADMAP appear in plan frontmatter and are accounted for above. REQUIREMENTS.md checkbox state for BRAND-05/CUST-02 (previously marked prematurely complete after plan 01 and reverted in commit `39a3fee`) was re-derived independently from code and live behavior in this verification, not trusted from the checkbox.

### Behavioral Spot-Checks / Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Full phase gate | `nix develop .#theia --command bash scripts/verify-phase-02.sh` (no `--build`; confirmed build artifacts newer than newest source file) | `diff-theia-core: PASS`, `verify-branding: PASS`, `verify-customize-inert: PASS`, `verify-dev-flag-off: PASS`, `verify-uri-roundtrip: PASS (23/23 rows)` | PASS |
| `diff-theia-core.sh` full mode (not `--quick`) | `bash scripts/diff-theia-core.sh` (invoked by driver without `--quick`) | Stage 2 fresh-resolve `diff -rq` against temp `yarn install --frozen-lockfile`: zero differences | PASS |

This verification independently re-ran the entire live gate rather than trusting the orchestrator's prior run or the SUMMARY.md pass claims.

### Human Verification Required

None. All must-haves are mechanically verifiable and were verified live against a running, `theia build`-artifact-served app driven by the project's own headless-Firefox/BiDi harness — not by source inspection alone.

### Gaps Summary

No gaps found. All 7 requirement IDs, all 5 ROADMAP success criteria, all `must_haves.truths`/`artifacts`/`key_links` across the 7 plans, and the accepted-limitation decisions (D-65, D-66, D-51 carve-outs, D-38 amendment) check out against the actual codebase and a live, independently re-executed verification run.

---

*Verified: 2026-08-21T03:10:00Z*
*Verifier: Claude (gsd-verifier)*
