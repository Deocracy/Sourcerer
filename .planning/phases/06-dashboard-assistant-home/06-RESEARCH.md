# Phase 6: Dashboard Assistant & Home - Research

**Researched:** 2026-07-14
**Domain:** React/Tauri desktop shell — bespoke pointer-drag resize UI, dnd-kit sortable card grid, client-side text-pattern parsing over a streaming AI seam
**Confidence:** HIGH

## Summary

Phase 6 is a UI-assembly phase, not a new-subsystem phase: nearly every hard architectural
problem (the AI seam, the storage seam, the bespoke-pointer-resize pattern, the dnd-kit
library choice) was already decided and proven in Phases 4/7/2. The work here is porting two
already-fully-specified references — `Sourcerer Bespoke Rails.dc.html` (assistant) and
`home-cards.js` (Home) — from their `sc-if`/prototype-store idiom into real React/Zustand/TSX,
while growing Phase 7's minimal `AssistantPanel.tsx` rather than replacing it.

The one genuinely new piece of engineering is ASST-02's proposal detection: since Phase 7's
sidecar never emits a "proposal" event type, the panel must pattern-match the streamed
`text_delta` accumulation client-side and decide, once `done` fires, whether the final text
contains a demarcated proposal block to render as a `proposal-quote`. This needs a stable,
narrow marker convention (see Pattern 3 below) — free-text NLP-style detection is not
warranted and not what D-02 asks for.

The second is that `asstWidth`/`assistantOpen` do NOT yet exist on `shellStore.ts` (verified
by source read) — this phase adds that slice from scratch, following the `railMode`/`railWidth`
slice as its template exactly (same file, same `scheduleWorkspaceSave()` persistence hook,
same synchronous-seed-then-hydrate lifecycle).

**Primary recommendation:** Grow `AssistantPanel.tsx` in place (session list + resize + proposal
rendering added to the existing component tree, not a rewrite); add `@dnd-kit/core` +
`@dnd-kit/sortable` + `@dnd-kit/utilities` (all `[OK]` per slopcheck, current npm majors newer
than the handoff's pinned esm.sh imports — verify peer ranges below) for Home; extend
`shellStore.ts` with an `asstWidth`/`assistantOpen`/home-cards slice; reuse `railSnap.ts`'s
"pure function returns a mode from a raw px width" pattern for the assistant's own
close/open/full-screen thresholds (concrete px values are recoverable from the handoff's own
`startRightResize` logic — see Pattern 2).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assistant message streaming (ASST-01) | API/Backend (sidecar via Tauri command) | Browser/Client (React state) | `host.ai()` Channel relay already owns turn state; panel only renders it |
| Multi-session list + seeded transcripts (ASST-01) | Browser/Client | — | Session IDs are real (sidecar-backed) but the *list* (which sessions show, seed content) is pure client UI state |
| Proposal parsing (ASST-02) | Browser/Client | — | D-02 locks this as client-side text parsing; no backend involvement by design |
| Assistant resize/snap (ASST-03) | Browser/Client | — | Bespoke pointer events, same tier as `useRailDrag.ts` |
| Home visibility toggle (HOME-01) | Browser/Client | — | Pure shell-store boolean + overlay render, no persistence beyond existing workspace store |
| Home card layout persistence (HOME-02) | Browser/Client | Storage (tauri-plugin-store via host.storage) | Section membership/order need a durable write path; card *content* stays static client data |
| ＋MAKE CARD cross-surface action (D-06) | Browser/Client | — | Shell-level store action, not an applet-boundary crossing — does not touch `host` API |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 [VERIFIED: npm registry] | DndContext, PointerSensor, collision detection for Home card drag | Locked by CLAUDE.md/CONTEXT.md D-05/HOME-02 as the only sanctioned drag library for Home; peer range `react/react-dom >=16.8.0` — compatible with pinned React 18.2.0 |
| `@dnd-kit/sortable` | 10.0.0 [VERIFIED: npm registry] | SortableContext, useSortable, arrayMove, rectSortingStrategy | Same lock; peer-requires `@dnd-kit/core ^6.3.0` — 6.3.1 satisfies this |
| `@dnd-kit/utilities` | 3.2.2 [VERIFIED: npm registry] | `CSS.Transform.toString` for card transform styling | `@dnd-kit/sortable`'s own dependency (`^3.2.2`) — install explicitly since the port imports `CSS` directly, matching `home-cards.js`'s own import |

**Version note:** the handoff's `home-cards.js` pins older esm.sh versions (`@dnd-kit/core@6.1.0`,
`@dnd-kit/sortable@8.0.0`, `@dnd-kit/utilities@3.2.2`). Current npm majors are newer
(`sortable` jumped 8→10). The public API surface used by `home-cards.js` (`DndContext`,
`DragOverlay`, `PointerSensor`, `useSensor(s)`, `closestCenter`, `SortableContext`,
`useSortable`, `arrayMove`, `rectSortingStrategy`, `CSS.Transform.toString`) is stable across
these majors per the dnd-kit changelog convention (no breaking renames of these exports through
6.x→10.x) — but **do not assume this without smoke-testing the port**: pin the exact versions
above and verify `useSortable()`'s returned shape (`attributes`, `listeners`, `setNodeRef`,
`transform`, `transition`, `isDragging`) still matches 1:1 once installed, since that shape is
consumed directly by `SortableCard`/`CardFrame` in the port.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` (already installed, `^5.1.16`) | existing | Message/turn `id` generation in the growing thread state | Already used by `AssistantPanel.tsx` — no new dependency |
| `customAlphabet` (nanoid, already installed) | existing | New real sessionId minting for multi-session (ASST-01) | Reuse `newSessionId` factory already defined in `AssistantPanel.tsx` (CR-01 alphanumeric-only landmine already solved there) — do not reinvent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dnd-kit | react-beautiful-dnd / react-dnd | Both are heavier and less actively maintained (`react-beautiful-dnd` is in maintenance mode); moot anyway since dnd-kit is a locked project decision (CLAUDE.md), not open for reconsideration this phase |
| Client-side proposal marker parsing | A real sidecar-emitted `proposal` event | D-02 explicitly defers this; a real event type is architecturally cleaner (no brittle text parsing) but is out of scope — Phase 7's `AssistantEvent` union is 8 fixed shapes and changing it is an explicit non-goal this phase |

**Installation:**
```bash
npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2
```

**Version verification:** confirmed live via `npm view <pkg> version` on 2026-07-14 (see table
above). `npm view @dnd-kit/sortable peerDependencies` returned
`{ react: '>=16.8.0', '@dnd-kit/core': '^6.3.0' }` — compatible with the pinned `@dnd-kit/core@6.3.1`
and React 18.2.0.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@dnd-kit/core` | npm | mature (clauderic/dnd-kit, multi-year) | high (widely adopted DnD library) | github.com/clauderic/dnd-kit | [OK] | Approved |
| `@dnd-kit/sortable` | npm | mature, same monorepo | high | github.com/clauderic/dnd-kit | [OK] | Approved |
| `@dnd-kit/utilities` | npm | mature, same monorepo | high | github.com/clauderic/dnd-kit | [OK] | Approved |

Ran `slopcheck install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` on 2026-07-14 — all
three scanned `[OK]` against the live npm registry before the (intentionally aborted, not
executed against this repo) install step. `npm view` confirmed matching `peerDependencies` /
`dependencies` graphs (`@dnd-kit/sortable` depends on `@dnd-kit/utilities@^3.2.2` and
`tslib@^2.0.0`, peer-requires `@dnd-kit/core@^6.3.0`). All three packages' `repository.url`
resolves to the same well-known `github.com/clauderic/dnd-kit` monorepo — not a slopsquat
target, and this is also the exact library CLAUDE.md already locked in as a project decision
(not a novel choice made during this research pass).

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
User keystroke/click
        │
        ▼
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ AssistantPanel.tsx (grown)   │        │ Home.tsx (new, HOME-01/02)   │
│                              │        │                              │
│ composer ⌘↵ ──► host.ai() ───┼───┐    │ DndContext                   │
│                              │   │    │  └─ SortableContext × 4 secs │
│ session chips ──► loadSession│   │    │      └─ SortableCard (drag)  │
│  (real: reopen JSONL)        │   │    │           │                  │
│  (seed: canned, no send)     │   │    │           ▼                  │
│                              │   │    │      onDragEnd → shellStore  │
│ streamed text_delta ─────────┼───┼──► │      home-cards slice ──────┼──► host.storage
│  └─ accumulate → on `done`,  │   │    │      (persist section+order) │      (D-05)
│     scan for proposal marker │   │    └──────────────────────────────┘
│     → render proposal-quote  │   │             ▲
│     block (y/d/n)            │   │             │ ＋MAKE CARD (D-06)
│                              │   │             │ mints card from
│ [y] approve ──► accept ──────┼───┴─────────────┘ accepted proposal /
│                              │      shell-level action    last message
│ resize grip (pointerdown/    │
│  move/up + setPointerCapture)│
│  ──► snapWidthToAsstMode()   │
│  ──► shellStore.asstWidth /  │
│      assistantOpen           │
└───────────┬──────────────────┘
            │
            ▼
    Tauri `host_ai` command (Channel<AssistantEvent>)
            │
            ▼
    Pi sidecar (Phase 7, UNCHANGED) — 8 AssistantEvent shapes
```

A reader can trace ASST-01 (composer → sidecar → streamed reply → thread) and the D-06
cross-surface link (proposal accept → ＋MAKE CARD → Home card mint → persisted layout) end to
end via the arrows above.

### Recommended Project Structure
```
src/
├── assistant/
│   ├── AssistantPanel.tsx       # grown, not replaced: + session list, resize, proposals
│   ├── AssistantPanel.module.css
│   ├── sessionSeeds.ts          # NEW — seeded read-only demo transcripts (D-01)
│   ├── proposalParse.ts         # NEW — client-side marker parser (D-02), pure function, unit-testable
│   ├── useAssistantResize.ts    # NEW — mirrors useRailDrag.ts's pointer-capture pattern for ASST-03
│   └── assistantSnap.ts         # NEW — mirrors railSnap.ts: pure fn(raw px) -> {mode, width}
├── shell/
│   ├── DiviChip.tsx             # EDIT — replace no-op toggleDivi with shellStore action (D-04)
│   ├── LogoCluster.tsx          # EDIT — replace no-op openHome with shellStore action (D-04)
│   └── Home.tsx                 # NEW — dockview-overlay-mounted metro dashboard (HOME-01)
├── home/
│   ├── cardDefs.ts               # NEW — ported from home-cards.js `cardDefs` registry (static data)
│   ├── HomeCard.tsx              # NEW — CardFrame/CardBody port (visual variants)
│   ├── SortableCard.tsx          # NEW — useSortable wrapper port
│   └── homeCards.storage.ts      # NEW — host.storage read/write for section membership+order
└── store/
    └── shellStore.ts             # EDIT — add asstWidth/assistantOpen slice + home-cards session-only cache
```

### Pattern 1: Grow, don't replace, the Phase 7 panel
**What:** `AssistantPanel.tsx` already owns `sessionId` minting/persistence, the `host.ai()`
event switch, and the composer. Phase 6 adds: a `sessions: SessionEntry[]` array (mix of real +
seed sessions), an `activeSessionId` selector, resize state/handlers, and post-`done` proposal
scanning — all as additions to the existing component's state and JSX, not a new component tree.
**When to use:** Any time this phase's plan touches the assistant — check `AssistantPanel.tsx`'s
current shape first (read the file) before writing a task that assumes a blank slate.
**Example:**
```typescript
// Source: existing src/assistant/AssistantPanel.tsx (Phase 7) — this phase extends the
// `case "done":` branch to also invoke the new proposal parser once text is final.
case "done":
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId || m.status === "error") return m;
      const proposal = parseProposal(m.text); // NEW (D-02)
      return { ...m, status: "done", proposal };
    }),
  );
  setSending(false);
  break;
```

### Pattern 2: Assistant resize/snap thresholds, recovered from the handoff's own logic
**What:** The handoff's `startRightResize`/`startRightPull` (`Sourcerer Bespoke Rails.dc.html`
lines ~514–575) define concrete, already-tuned thresholds — use these as the planner's default
rather than inventing new ones (CONTEXT.md leaves exact px "planner's discretion", but these
values are the design's own precedent, same class as the rail's `CLOSE_AT`/`COMPACT_AT`):
- `HIDDEN_W = 6` (closed strip width) — matches `--asst-closed-w: 6px` already declared in UI-SPEC.
- Close threshold: dragged width `< 180px` → snap closed (`toggleRightRail`/`assistantOpen=false`).
- Full-screen threshold: raw drag distance from the host's right edge `> FULL_AT (620px)` → ghost
  cue appears (**"LET GO TO SNAP"**), release snaps to full screen.
- Default width on reopen from closed: `280px` (matches `--asst-width-default: 280px` in UI-SPEC).
- Width is computed as `hostRect.right - ev.clientX` (measuring from the panel's own right host
  edge, not `navLeft` like the rail) — because the assistant is the *right*-hand panel, drag
  direction is inverted relative to the left rail's `useRailDrag.ts`. Do not copy `useRailDrag.ts`'s
  `ev.clientX - navLeft` formula verbatim; mirror it (`hostRect.right - ev.clientX`).
**When to use:** ASST-03 resize implementation (`assistantSnap.ts`/`useAssistantResize.ts`).
**Example:**
```typescript
// Source: NEW Design sync setup guide/design_handoff_bespoke_rails_shell/Sourcerer Bespoke Rails.dc.html (lines 514-542)
// Mirrors railSnap.ts's pure-function shape but with the mirrored (right-edge) formula and
// the assistant's own 3-state model (closed / open / full) instead of the rail's 3-state
// (hidden/compact/expanded).
export type AsstSnap =
  | { mode: "closed" }
  | { mode: "open"; width: number }
  | { mode: "full" };

const HIDDEN_W = 6;
const CLOSE_AT = 180;
const FULL_AT = 620; // raw drag distance from the host's right edge

export function snapWidthToAsstMode(raw: number, hostWidth: number): AsstSnap {
  if (raw > FULL_AT) return { mode: "full" };
  const clamped = Math.max(HIDDEN_W, Math.min(hostWidth - 160, raw));
  if (clamped < CLOSE_AT) return { mode: "closed" };
  return { mode: "open", width: clamped };
}
```

### Pattern 3: Client-side proposal marker convention (ASST-02, D-02)
**What:** Since there is no sidecar-emitted proposal event, the panel must decide from the final
accumulated assistant text whether a proposal is present. The handoff's own reference thread
text is unstructured prose ("Proposal — updates § Poliziano · role at Careggi: ...") — that is
UI-copy for the *seeded demo transcript*, not a machine-parseable contract for *real* streamed
replies. For real sessions, define an explicit, narrow marker the sidecar's system prompt (or a
lightweight client-side regex over common LLM output conventions) can reliably produce — e.g. a
fenced block `<<<PROPOSAL: target="§ Poliziano"' >>> ... <<<END>>>` or a Markdown blockquote
with a recognizable leading token. **Do not attempt general-purpose NLP-style "is this a
proposal" classification** — that is unbounded scope creep past a client-side parser and was
explicitly not what D-02 asked for.
**When to use:** `proposalParse.ts` — a pure, synchronous function `(text: string) => Proposal | null`,
unit-tested directly with fixture strings (both seeded demo text and synthetic marker text),
independent of any streaming/async concerns.
**Recommendation for the planner:** since Phase 7's sidecar system prompt is out of scope to
change this phase (CONTEXT.md: "Phase 6 does NOT add" a new event shape — silent on system-prompt
wording), the safest MVP is to parse a simple, low-collision Markdown convention already common in
LLM output — e.g. a blockquote (`> `) immediately preceded by a line starting with `Proposal —`
or `Proposal:` — rather than inventing a custom fenced-block syntax the model was never asked to
produce. Flag this as an **Open Question** below since it is genuinely underdetermined without
either a live model prompt or a defined test fixture.

### Pattern 4: dnd-kit Home port — replace localStorage with host.storage, keep everything else
**What:** `home-cards.js`'s `Home` component is already a complete, working dnd-kit
implementation (`DndContext` + 4×`SortableContext` + `DragOverlay` + FLIP-via-transform). The
only architectural change required is swapping its `useEffect(() => localStorage.setItem(...))`
persistence for an async `host.storage.set()` call (D-05), and its `useState(() => JSON.parse(localStorage.getItem(...)))`
initial load for an async `host.storage.get()` resolved before first paint (or an optimistic
`DEFAULT_SECTIONS` render that gets replaced once the async load resolves — plan should pick one
and note the flash-of-default-content tradeoff).
**When to use:** `home/cardDefs.ts` + `home/HomeCard.tsx` + `home/SortableCard.tsx` — port
`cardDefs`, `CardBody`, `CardFrame`, `SortableCard`, `OverlayCard`, `SectionHeader`, `Home`
functions near-verbatim from `home-cards.js`, converting `React.createElement`/`h(...)` calls to
JSX per CLAUDE.md's "drop the React-via-props indirection if using a bundler" directive, and
`import ... from 'https://esm.sh/...'` to normal npm imports.
**Example:**
```typescript
// Source: NEW Design sync setup guide/design_handoff_bespoke_rails_shell/home-cards.js (lines 270-281)
// BEFORE (prototype, localStorage):
// const [cards, setCards] = React.useState(() => {
//   try { const saved = JSON.parse(localStorage.getItem(STORE_KEY)); if (saved?.pins) return saved; } catch {}
//   return DEFAULT_SECTIONS;
// });
// React.useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cards)); } catch {} }, [cards]);

// AFTER (host.storage, D-05):
const [cards, setCards] = useState(DEFAULT_SECTIONS);
useEffect(() => {
  void host.storage.get<SectionMap>("home-cards-v1", DEFAULT_SECTIONS).then(setCards);
}, []);
useEffect(() => {
  void host.storage.set("home-cards-v1", cards); // best-effort, never throws (WR-01 contract)
}, [cards]);
```

### Anti-Patterns to Avoid
- **Re-mounting or duplicating `AssistantPanel.tsx`:** `AppShell.tsx` already renders it as a
  flex sibling of `Dock`; do not add a second mount point or a wrapper that shadows the existing
  one (memory: `phase02-phase07-ownership-boundary` — "AppShell already mounts AssistantPanel —
  don't re-mount").
- **Calling `invoke()` directly from Home or the assistant panel for anything AI-related:** the
  boundary test (Phase 4/7) enforces that `invoke` for AI only appears under `src/host/`; Home
  never touches AI at all (its ＋MAKE CARD consumes the *already-resolved* proposal/message text
  from shell-level state, it does not call the sidecar itself).
- **Adding a `proposal` event to `AssistantEvent`:** explicitly out of scope (D-02); would touch
  `src/host/ai.ts`, `sidecar/src/protocol.ts`, and the Rust relay — three files this phase must
  not edit.
- **Using `useRailDrag.ts`'s exact formula unmodified for the assistant:** the direction is
  mirrored (right-edge vs left-edge) — see Pattern 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Home card drag/sort/FLIP | A bespoke pointer-drag reorder system for cards | `@dnd-kit/core` + `@dnd-kit/sortable` (already the design's own choice) | dnd-kit's `useSortable` already provides transform/transition-based FLIP, collision detection (`closestCenter`), cross-container dragging (`onDragOver` moving items between `SortableContext`s), and a11y keyboard support — reimplementing any of this bespoke would be strictly worse and contradicts the locked library decision |
| Proposal accept/reject undo | A custom reversible-action/command-pattern system | Plain local state (`proposalResolved: 'approved' \| 'rejected' \| null`) per the handoff's own `approve`/`reject` handlers | D-02/UI-SPEC explicitly frame reject as non-destructive and needing no confirm — this is intentionally simple, not a hidden undo-stack requirement |

**Key insight:** almost nothing in this phase needs new infrastructure — the two "don't
hand-roll" risks are inflating dnd-kit usage beyond what the reference already demonstrates, or
inflating proposal parsing into a general text-classification system. Stay literal to the ported
references.

## Common Pitfalls

### Pitfall 1: Treating `AssistantPanel.tsx`'s host object as the applet `host` API
**What goes wrong:** `src/host/index.ts`'s `makeHost()` (5-member `Host` interface: `storage`,
`ai`, `open`, `instanceId`, `theme`) is the **applet-facing** stub seam (FWK-04, still using the
one-shot `aiComplete()` wrapper). `AssistantPanel.tsx` imports `host` from `src/host/ai.ts`
directly — a *different*, shell-level object (`{ ai, setModes, loadSession }`) that talks to the
*real* Phase 7 sidecar with real multi-turn sessions.
**Why it happens:** Both are named `host` and both live under `src/host/`, inviting confusion
about which one Phase 6 code should import.
**How to avoid:** Home and the Dashboard Assistant are shell-level surfaces, not applets — they
should import from `src/host/ai.ts` (assistant) and `src/host/storage.ts`'s `makeAppletStorage`
factory or a dedicated shell-scoped storage helper (Home), never `makeHost()`/the `Host` type.
**Warning signs:** A task description that says "use `host.ai()`" without specifying which
`host` — verify against the file it names before writing code.

### Pitfall 2: Session-list state model ambiguity (Zustand vs local) causing a rework mid-phase
**What goes wrong:** CONTEXT.md leaves "Zustand slice vs extended local state" as planner's
discretion, but ＋MAKE CARD (D-06) needs the *assistant's* accepted-proposal/last-message text to
reach *Home's* card-mint action — a cross-component reach that local `useState` inside
`AssistantPanel.tsx` cannot satisfy without prop-drilling through `AppShell`.
**Why it happens:** Phase 7 deliberately kept everything local since no cross-surface consumer
existed yet; Phase 6 introduces the first one.
**How to avoid:** Decide this once, up front in planning: put at minimum the "last resolved
proposal / last assistant message" surface in `shellStore.ts` (even if the full message thread
stays local to `AssistantPanel.tsx`), so Home's mint action reads from the store, not from a prop
passed down from `AppShell`. This keeps 90% of session-list state local while giving D-06 a real
seam.
**Warning signs:** A plan that has Home import from `src/assistant/*` directly, or `AssistantPanel.tsx`
import from `src/home/*` directly — either direction is a sideways coupling that should route
through `shellStore.ts` instead.

### Pitfall 3: `home.storage` write races during rapid drag-and-drop
**What goes wrong:** `home-cards.js`'s `onDragOver` fires on every hover-over-a-new-target during
a drag (not just on drop), which is fine for `setState` inside React but would fire an async
`host.storage.set()` write on every intermediate hover frame if wired naively — many rapid,
overlapping disk writes.
**Why it happens:** The reference's `useEffect(() => localStorage.setItem(...), [cards])` runs
synchronously and cheaply for `localStorage`; the same effect dependency wired to
`host.storage.set()` (an async IPC + disk write) is far more expensive per call.
**How to avoid:** Debounce the persistence write (mirror `scheduleWorkspaceSave`'s existing
debounce pattern in `src/persistence/workspaceStore.ts`) rather than firing a `host.storage.set()`
on every `cards` state change; only the *final* `onDragEnd` state matters for durability.
**Warning signs:** Rapid card drags causing visible jank, or `applets.json`'s LazyStore `.save()`
being called dozens of times per drag gesture.

### Pitfall 4: `DiviChip`/`LogoCluster` wiring collides with Phase 2's `railApplet === "Home"` convention
**What goes wrong:** `DiviChip.tsx`'s `active` styling currently reads
`useShellStore((s) => s.railApplet === "Home")` — a Phase 2 placeholder that assumed "Home" would
be a rail-selected applet key. Phase 6 introduces a *real* Home overlay driven by a new
`diviOpen`/`homeOpen` boolean (per D-04 and the handoff's own `diviOpen` state), which is a
different concept than `railApplet`.
**Why it happens:** The Phase 2 stub anticipated the wiring shape incorrectly (reasonable at the
time — Home didn't exist as a real surface yet).
**How to avoid:** Decide and use one boolean (`homeOpen` or similarly named, in `shellStore.ts`)
as the single source of truth for Home's overlay visibility; update `DiviChip`'s active-state
selector to read that boolean instead of `railApplet === "Home"` once it exists, rather than
maintaining two parallel "is Home showing" signals that can drift out of sync.
**Warning signs:** DiviChip renders as active/inactive out of sync with whether the Home overlay
is actually visible.

## Code Examples

### Reusing the rail's pointer-capture pattern for the assistant grip
```typescript
// Source: src/shell/useRailDrag.ts (existing, Phase 2) — the pattern to mirror in
// src/assistant/useAssistantResize.ts. Key structural elements to replicate:
// - `target.setPointerCapture(pointerId)` on pointerdown, not window-level mouse listeners
// - live snap state during drag (`liveSnap`/here `liveAsstSnap`) for the "LET GO TO SNAP" cue
// - final snap computed again on pointerup (not read from the last live value, in case the
//   move handler under-samples a fast flick) — mirrors handleUp's own re-computation
const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const target = e.currentTarget;
  target.setPointerCapture(e.pointerId);
  const hostRect = panelHostRef.current?.getBoundingClientRect();
  const hostRight = hostRect ? hostRect.right : window.innerWidth;

  const handleMove = (ev: PointerEvent) => {
    const raw = hostRight - ev.clientX;
    setLiveSnap(snapWidthToAsstMode(raw, hostRect?.width ?? window.innerWidth));
  };
  const handleUp = (ev: PointerEvent) => {
    target.releasePointerCapture(e.pointerId);
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
    setLiveSnap(null);
    const raw = hostRight - ev.clientX;
    const snap = snapWidthToAsstMode(raw, hostRect?.width ?? window.innerWidth);
    applySnapToShellStore(snap); // sets asstWidth / assistantOpen / fullscreen flag
  };
  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
}, []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single-session `AssistantPanel` (Phase 7) | Multi-session panel with real + seeded sessions | This phase (ASST-01) | `sessionId` becomes an array-backed selection instead of a single `useRef` |
| `localStorage['sourcerer-home-cards-v2']` (reference prototype) | `host.storage` (tauri-plugin-store, applet-scoped) | This phase (D-05) | Card layout survives the same way all other Phase 3/4 persisted state does — one durable pattern shell-wide |

**Deprecated/outdated:** none — this phase does not remove any existing capability, only adds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The proposal marker convention (Pattern 3) — no live sidecar system-prompt or fixture exists to confirm what real streamed text will actually look like | Architecture Patterns / Pattern 3 | If the real model's output doesn't match whatever convention the planner picks, ASST-02's y/d/n UI will never trigger for real sessions (only for seeded demo transcripts) — needs a defined test fixture or a live smoke test against Phase 7's sidecar before considering ASST-02 done |
| A2 | dnd-kit's public API surface (`useSortable`'s returned shape, `DndContext`/`SortableContext` props) used by `home-cards.js` is unchanged across the 6.1.0→6.3.1 (core) and 8.0.0→10.0.0 (sortable) version gaps | Standard Stack | If a breaking rename occurred between those majors, the ported `home-cards.js` code will fail to compile/run as-is and needs adaptation — verify with a quick build/smoke test immediately after `npm install`, before writing the full Home port task |
| A3 | `--asst-*` px values in 06-UI-SPEC.md (280 default, 6 closed) match the handoff's own `startRightResize` constants — confirmed by direct read of both sources in this research pass, so this is actually [CITED] not [ASSUMED], but flagged here because the *additional* thresholds this research derived (180px close, 620px full-zone) are NOT independently present in 06-UI-SPEC.md — UI-SPEC explicitly leaves them to planner discretion | Pattern 2 | If the planner picks different thresholds than the ones recovered here, the visual "feel" of the resize will diverge from the handoff's own tuned prototype without anyone having decided that on purpose |

## Open Questions

1. **What exact text convention will the Phase 7 sidecar's real model output use to signal a proposal?**
   - What we know: The handoff's UI renders a fixed demo proposal string; Phase 7's system
     prompt (outside this phase's scope to change) was not written with any proposal-marker
     convention in mind.
   - What's unclear: Whether relying on a generic Markdown blockquote heuristic will produce
     false positives/negatives against real model output the sidecar streams.
   - Recommendation: Ship ASST-02 fully functional against the **seeded demo transcripts**
     (guaranteed, since their text is authored) and treat the marker-detection over *real*
     streamed replies as a best-effort heuristic — document this limitation in the phase's
     verification notes rather than blocking the phase on a guarantee this research cannot
     provide without a live model call.

2. **Does the Home overlay need to coexist with dockview's own panels, or fully replace the view while open?**
   - What we know: The handoff renders Home as `position:absolute; inset:0; z-index:55` layered
     *over* the `dockview-theme-abyss` div (both are siblings inside the same relative-positioned
     container) — dockview keeps running underneath, just visually hidden.
   - What's unclear: Whether Phase 6 should literally mirror "layer over, dockview still mounted"
     (matches D-04's "Rendered as a dock panel / overlay" wording) or whether a simpler
     conditional-render (`{homeOpen && <Home />}` replacing the Dock's render slot) is
     acceptable and cheaper.
   - Recommendation: Prefer the overlay-over-mounted-dockview approach (absolute-positioned sibling,
     toggled via CSS/conditional render but not unmounting Dock) since it matches the handoff
     exactly and avoids any dockview re-initialization cost when toggling Home on/off repeatedly.

## Environment Availability

No new external tool/service dependencies for this phase — `@dnd-kit/*` are plain npm packages
(no native/system components), the AI harness is already running (Phase 7 shipped), and
`tauri-plugin-store` is already wired (Phase 3/4). Skipping the full table since there is nothing
new to probe.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment), `@vitejs/plugin-react` — confirmed via `vitest.config.ts` |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run src/assistant src/home src/shell/DiviChip.test.tsx src/shell/LogoCluster.test.tsx` (once new test files exist) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASST-01 | Session list renders real+seeded sessions; sending ⌘↵ streams a reply | unit/component | `npx vitest run src/assistant/AssistantPanel.test.tsx` | Exists (Phase 7) — extend, don't replace |
| ASST-02 | Proposal text renders as serif-italic block; y/d/n act on focused proposal | unit | `npx vitest run src/assistant/proposalParse.test.ts` | ❌ Wave 0 |
| ASST-03 | Resize grip drag closes/opens/full-screens per thresholds | unit | `npx vitest run src/assistant/assistantSnap.test.ts` | ❌ Wave 0 (mirrors existing `railSnap.test.ts`) |
| HOME-01 | Home renders on empty dock + summonable via DiviChip/LogoCluster | component | `npx vitest run src/shell/Home.test.tsx` | ❌ Wave 0 |
| HOME-02 | Cards drag between sections, order persists via host.storage | component | `npx vitest run src/home/Home.dnd.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed test file(s)>`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/assistant/proposalParse.test.ts` — covers ASST-02 (pure function, no DOM needed)
- [ ] `src/assistant/assistantSnap.test.ts` — covers ASST-03 (pure function, mirrors `railSnap.test.ts`'s existing structure exactly)
- [ ] `src/shell/Home.test.tsx` — covers HOME-01 (overlay open/close, DiviChip/LogoCluster wiring)
- [ ] `src/home/Home.dnd.test.tsx` — covers HOME-02 (dnd-kit interactions are notoriously hard to
      unit-test with pointer events in jsdom; consider testing the `onDragEnd`/section-membership
      reducer logic as a pure function separately from the dnd-kit-wired component, mirroring how
      `railSnap.ts` is unit-tested independently of `useRailDrag.ts`)
- [ ] Framework install: none — Vitest already configured project-wide.

## Sources

### Primary (HIGH confidence)
- `src/assistant/AssistantPanel.tsx`, `src/host/ai.ts`, `src/host/index.ts`, `src/host/aiComplete.ts`, `src/host/storage.ts` — direct source read, Phase 7/4 shipped code
- `src/store/shellStore.ts`, `src/shell/railSnap.ts`, `src/shell/useRailDrag.ts`, `src/shell/DiviChip.tsx`, `src/shell/LogoCluster.tsx`, `src/App.tsx`, `src/app/AppShell.tsx` — direct source read
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/home-cards.js` (full file) and `Sourcerer Bespoke Rails.dc.html` (title bar, right-rail/assistant section lines 1-100, 160-400, 419-575) — direct source read, the design source of truth
- `.planning/phases/06-dashboard-assistant-home/06-CONTEXT.md` and `06-UI-SPEC.md` — direct source read, locked decisions
- npm registry (`npm view @dnd-kit/core version`, `npm view @dnd-kit/sortable version`, `npm view @dnd-kit/sortable peerDependencies`, `npm view @dnd-kit/*/dependencies`, `repository.url`) — live queries, 2026-07-14
- `slopcheck install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` — live run, 2026-07-14, all 3 `[OK]`

### Secondary (MEDIUM confidence)
- none used this pass — all findings traced to primary sources above

### Tertiary (LOW confidence)
- Assumption that dnd-kit's public API is unchanged across the major version gap (A2) — not
  independently verified against the dnd-kit changelog in this pass; flagged for a post-install
  smoke test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — dnd-kit versions and peer ranges directly verified via `npm view`; slopcheck clean
- Architecture: HIGH — every pattern traced to an existing shipped file or the design handoff's own source, not invented
- Pitfalls: HIGH — all four are concrete, source-traced conflicts (host/host naming collision, state-model cross-surface need, debounce gap, stale DiviChip selector), not speculative

**Research date:** 2026-07-14
**Valid until:** 30 days (stable internal codebase + a locked, mature external library; the only fast-moving risk is A1's dependency on live sidecar model behavior, which isn't a "staleness" concern so much as an untestable-without-live-run gap)
