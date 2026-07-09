# Phase 3: Persistence & Layouts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 3-persistence-layouts
**Areas discussed:** LAYOUTS menu UX, Corrupt/stale fallback UX, Schema/migration policy, Storage unification scope

---

## LAYOUTS menu UX

### Menu placement (first pass)
User asked whether the answer could come from the design handoff. Finding: the
`bespoke_rails_shell` handoff specs the full title bar but contains **no LAYOUTS menu** and
no named-layouts concept — net-new. Re-asked with that established.

| Option | Description | Selected |
|--------|-------------|----------|
| Title-bar dropdown | `LAYOUTS ▾` in the title-bar right cluster; dropdown of saved layouts + Save current + Reset; /gsd-ui-phase pixel-specs it | ✓ |
| Lock behavior, defer placement | Decide behavior now, leave chrome placement to the UI pass | |
| Corpus-area menu | Attach to the corpus label/switcher area | |

**User's choice:** Title-bar dropdown (recommended)

### Layout scope

| Option | Description | Selected |
|--------|-------------|----------|
| Whole workspace | Dock tree + tabs/instances + rail order/pins/mode/width + widths | ✓ |
| Dock tree only | Just the center dock arrangement | |

**User's choice:** Whole workspace

### "Reset to single pane" target
User asked what "reset to single pane" means — clarified it as a one-click "start over"
that collapses the current arrangement to a default baseline without touching saved layouts.

| Option | Description | Selected |
|--------|-------------|----------|
| Single Wiki pane | One Wiki panel | |
| Empty → Home | Blank dock tree → Home empty-state | |
| Wiki + Library | Restore the current two-panel default | ✓ |

**User's choice:** Wiki + Library — makes reset target and corrupt-fallback default the same baseline.

---

## Corrupt/stale fallback UX

### Reset notice

| Option | Description | Selected |
|--------|-------------|----------|
| Silent reset | Fall back to default with no message; console warning only | |
| Minimal one-time notice | Small non-blocking dismissible inline notice; net-new element | ✓ |

**User's choice:** Minimal one-time notice
**Notes:** Flagged that the shell has no toast system — this is one self-contained element, not shared infra.

### Missing applet key

| Option | Description | Selected |
|--------|-------------|----------|
| Generic placeholder, keep pane | Reuse Phase-2 PanelBody placeholder; pane survives | ✓ |
| Drop the pane | Prune unknown-key panel from the tree | |

**User's choice:** Generic placeholder, keep pane (recommended)

---

## Schema/migration policy

### Migration policy

| Option | Description | Selected |
|--------|-------------|----------|
| Discard → default | schemaVersion + empty migration seam; discard-to-default on unmigratable/failed | ✓ |
| Best-effort field-preserving | Salvage recognizable fields on mismatch | |

**User's choice:** Discard → default (recommended)

### Backup

| Option | Description | Selected |
|--------|-------------|----------|
| One rolling .bak | Copy prior state to a single last-known-good before destructive reset | ✓ |
| No backup | Discard outright | |

**User's choice:** One rolling .bak (recommended)

---

## Storage unification scope

### Storage shape

| Option | Description | Selected |
|--------|-------------|----------|
| One unified record | Adopt plugin-store; one versioned whole-workspace record; abandon localStorage scaffolds | ✓ |
| Two keys in plugin-store | Keep rail/dock split within plugin-store | |
| Stay on localStorage | Not recommended; can't flush-on-close from Rust | |

**User's choice:** One unified record (recommended)

### Per-instance state

| Option | Description | Selected |
|--------|-------------|----------|
| Build empty slot now | instanceId-keyed slot in v1 schema, empty until Phase 5 | ✓ |
| Defer entirely | Add later with a version bump | |

**User's choice:** Build empty slot now (recommended)

---

## Claude's Discretion

- plugin-store file name(s)/dir, Rust-vs-JS split for flush-on-close, debounce interval (300ms seed), migrator runner internals, window-close event binding.
- Whether rail state writes via zustand's path or folds into the unified write — record is unified, mechanism is planner's call.

## Deferred Ideas

- General toast/notification system (out of scope; corrupt-reset notice is self-contained).
- Layout backup history / undo (D-08 keeps one rolling .bak only).
- Import/export named layouts between machines.
- Per-corpus default layouts (later applet-phase concern).
