---
phase: quick-260714-mjk-rail-toggle-match
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/shell/RailToggleButtons.tsx, src/shell/RailToggleButtons.module.css]
autonomous: true
requirements: [MATCH-01]
must_haves:
  truths:
    - "MATCH-01: LEFT toggle renders as a single growing fill-bar (outline rect + one fill rect) matching the right toggle's fill-bar language, not two independently-lit rects"
    - "MATCH-01: Neither toggle's fill or icon color is ever the accent green — both use currentColor driven by a neutral fg/faint color, matching the reference"
    - "MATCH-01: Existing click-wiring tests (RailToggleButtons.test.tsx) still pass unmodified"
  artifacts:
    - path: "src/shell/RailToggleButtons.tsx"
      provides: "left toggle single fill-bar SVG (leftColW-driven), right toggle fill using currentColor, per-button neutral color state"
    - path: "src/shell/RailToggleButtons.module.css"
      provides: "color modifier classes for left/right toggle buttons (or equivalent inline var(--color-fg)/var(--color-faint) mapping)"
  key_links:
    - from: "src/shell/RailToggleButtons.tsx"
      to: "src/store/shellStore.ts (railMode, assistantOpen, assistantFull)"
      via: "useShellStore selectors already in place"
      pattern: "railMode|assistantOpen|assistantFull"
---

<objective>
Rewrite `RailToggleButtons.tsx`'s two title-bar SVG icons to visually match the design reference's fill-bar language and neutral (never-accent) coloring, per the confirmed diff against `design-sync-setup-guide/design_handoff_bespoke_rails_shell/Sourcerer Bespoke Rails.dc.html`.

Purpose: piece 1 of an incremental "match the design reference" pass — fixes the left toggle's outdated two-rect "split panel" metaphor and both toggles' incorrect accent-green fill color.
Output: Updated `src/shell/RailToggleButtons.tsx` and `src/shell/RailToggleButtons.module.css`. No click-wiring changes; `RailToggleButtons.test.tsx` passes unmodified.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md

<interfaces>
Current src/shell/RailToggleButtons.tsx (full file, 67 lines) — the component to rewrite. Key facts extracted:
- Imports `shellStore, useShellStore` from `../store/shellStore` and `styles` from `./RailToggleButtons.module.css`.
- Reads three store fields via selectors: `railMode` ("expanded" | "compact" | "hidden"), `assistantOpen` (boolean), `assistantFull` (boolean).
- LEFT button: `onClick={() => shellStore.getState().cycleRailMode()}` — DO NOT CHANGE.
- RIGHT button: `onClick={() => shellStore.getState().cycleAssistant()}` — DO NOT CHANGE.
- Both SVGs are `viewBox="0 0 16 12"`, 16x12.
- RIGHT toggle's existing fill geometry (already correct per reference, only color needs fixing):
  `<rect x="0.5" y="0.5" width="15" height="11" fill="none" stroke="var(--color-line-2)" />` (outline)
  `<rect x={assistantFull ? 0.5 : 11.5} y="0.5" width={assistantFull ? 15 : assistantOpen ? 4 : 0} height="11" fill="var(--color-accent)" />` (fill bar) — change `fill="var(--color-accent)"` to `fill="currentColor"`.

Current src/shell/RailToggleButtons.module.css (full file, 31 lines):
```css
.toggles { display: flex; align-items: center; gap: var(--space-xs); height: 100%; -webkit-app-region: no-drag; }
.toggle { display: flex; align-items: center; justify-content: center; width: var(--icon-btn-w); height: var(--icon-btn-h); padding: 0; margin: 0; border: none; border-radius: var(--radius); background: transparent; cursor: pointer; }
.toggle:hover { background: var(--color-panel); }
```

Established token names confirmed in use elsewhere in this codebase (src/shell/Rail.module.css): `var(--color-fg)`, `var(--color-faint)`, `var(--color-accent)`, `var(--color-panel)`, `var(--color-line)`. Reuse `--color-fg` / `--color-faint` — do not invent new tokens.

Reference spec (from design_handoff_bespoke_rails_shell .dc.html, already diffed by the user):
- LEFT toggle shape: outline rect `x=0.5 y=0.5 w=15 h=11 fill=none stroke=currentColor` + one fill rect `x=0.5 y=0.5 width={leftColW} height=11 fill=currentColor`, where `leftColW` = 6 when `railMode==='expanded'`, 3 when `railMode==='compact'`, 0 when `railMode==='hidden'`.
- LEFT button color: `var(--color-faint)` when `railMode === 'hidden'`, else `var(--color-fg)`.
- RIGHT button color: `var(--color-fg)` when `(assistantOpen || assistantFull)`, else `var(--color-faint)`.
- Both outline strokes use `currentColor` too (reference: `leftToggleFg`/`rightToggleFg` drive the whole icon's color, not just the fill rect) — replace `stroke="var(--color-line-2)"` with `stroke="currentColor"` on both SVGs' outline rects for consistency with the reference's single-color-per-state icon language.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rewrite RailToggleButtons.tsx icons to fill-bar shape + neutral currentColor</name>
  <files>src/shell/RailToggleButtons.tsx, src/shell/RailToggleButtons.module.css</files>
  <action>
In src/shell/RailToggleButtons.module.css: add two modifier classes appended after `.toggle:hover`, e.g. `.toggleDim { color: var(--color-faint); }` and `.toggleLit { color: var(--color-fg); }` (name them however fits, but keep them simple color-only modifiers composed alongside `.toggle`).

In src/shell/RailToggleButtons.tsx:
1. Compute `leftColW` from `railMode`: 6 when "expanded", 3 when "compact", 0 when "hidden" (a small local const or inline ternary chain, matching the reference's `leftColW` derivation).
2. Replace the LEFT button's `className` to compose `styles.toggle` with `styles.toggleDim` when `railMode === "hidden"` else `styles.toggleLit` (e.g. via a template literal or array-join — follow whatever composition style is simplest given no existing classnames helper is imported in this file; do not add a new dependency for this).
3. Replace the LEFT button's SVG contents with exactly two rects: an outline rect (`x=0.5 y=0.5 width=15 height=11 fill=none stroke=currentColor`) and one fill rect (`x=0.5 y=0.5 width={leftColW} height=11 fill=currentColor`). Remove the old two-separate-rect (widths 6 and 7) markup entirely.
4. Replace the RIGHT button's `className` to compose `styles.toggle` with `styles.toggleLit` when `(assistantOpen || assistantFull)` else `styles.toggleDim`.
5. In the RIGHT button's SVG: change the outline rect's `stroke="var(--color-line-2)"` to `stroke="currentColor"`, and change the fill rect's `fill="var(--color-accent)"` to `fill="currentColor"`. Keep the existing `x={assistantFull ? 0.5 : 11.5}` / `width={assistantFull ? 15 : assistantOpen ? 4 : 0}` geometry unchanged.
6. Do not touch either button's `onClick` handler or `aria-label`.
7. Update the file's top JSDoc comment block only if it references the now-removed two-rect left icon or the accent-fill right icon, so the comment stays accurate (brief edit, not a rewrite of the whole comment).
  </action>
  <verify>
    <automated>cd "D:\Vibe Coding\Sourcerer" && npx vitest run src/shell/RailToggleButtons.test.tsx</automated>
  </verify>
  <done>RailToggleButtons.test.tsx's 3 existing assertions pass unmodified; left toggle SVG has exactly 2 rects (outline + one leftColW-sized fill rect) with no reference to var(--color-accent) anywhere in the file; right toggle's fill rect uses fill="currentColor" instead of var(--color-accent); both buttons' className resolves color via --color-fg/--color-faint per the railMode/assistantOpen/assistantFull state rules above.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None | Pure presentational SVG/CSS change in a local component; no new trust boundary, no external input, no IPC. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-260714-01 | N/A | RailToggleButtons.tsx | accept | Pure visual/CSS-token change with no data flow, no new dependency, no IPC surface — no applicable STRIDE threat. |
</threat_model>

<verification>
Run `npx vitest run src/shell/RailToggleButtons.test.tsx` from `D:\Vibe Coding\Sourcerer` — all 3 tests pass. Manually confirm no occurrence of `var(--color-accent)` remains in `src/shell/RailToggleButtons.tsx` (grep check).
</verification>

<success_criteria>
- Left toggle icon is a single fill-bar (outline + one fill rect sized by leftColW) matching the right toggle's existing fill-bar pattern.
- Neither toggle ever renders accent green; both use currentColor driven by --color-fg/--color-faint per the reference's state rules.
- `RailToggleButtons.test.tsx` passes unmodified.
- `Rail.tsx` / `Rail.module.css` untouched.
</success_criteria>

<output>
Create `.planning/quick/260714-mjk-rail-toggle-match/260714-mjk-SUMMARY.md` when done
</output>
