# Phase 6: Dashboard Assistant & Home - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the shell's **two remaining first-class surfaces**, built to pixel-perfect
fidelity against the bespoke-rails handoff:

1. **Dashboard Assistant** (ASST-01/02/03) — the persistent right-hand panel: header, session
   list, message thread, composer (⌘↵ send); proposals as serif-italic quote blocks with
   y/d/n keyboard actions; resize grip with snap-to-close + expand-to-fullscreen ("LET GO TO
   SNAP" cue).
2. **Home dashboard** (HOME-01/02) — the metro card grid with PINNED / FRESH / LIVING /
   ARCHIVE sections; drag cards between sections with FLIP animation; assistant "＋MAKE CARD"
   mints a card.

**Reality correction (supersedes ROADMAP wording):** ROADMAP says this phase builds "against
the **stubbed** AI seam." That is stale. **Phase 7 already shipped the real Pi-sidecar harness
+ `host.ai()` streaming** and a *minimal* `AssistantPanel.tsx` (one session, local state, no
Zustand, `thinking_delta` suppressed). Phase 7 explicitly parked the full session-list /
proposals / resize-snap UI here. **Phase 6 GROWS that real panel — it does not build a new
stub.** Replies are live-streamed from the real harness.

**Explicitly NOT in Phase 6:**
- New AI event shapes on the `host.ai()` seam or sidecar changes → proposals are handled
  client-side (D-02); the Phase 7 seam is consumed unchanged.
- Real Home card *data* wired to Databasise/applets → cards are the curated demo `cardDefs`
  (deferred cross-surface data awareness stays deferred per Phase 4).
- Assistant↔applet AI cross-awareness / shared activity log → still deferred (Phase 4).
- Bundled sidecar / packaging → milestone-wide packaging deferral.

</domain>

<decisions>
## Implementation Decisions

### Assistant sessions (ASST-01)
- **D-01: Real sessions + demo seeds.** New/active sessions are REAL Pi sessions (real
  `sessionId`, live streamed replies via `host.ai()`, reopened JSONL history — grows Phase 7's
  `loadOrMintSessionId` from single-session to multi-session). The session list is ALSO seeded
  with a couple of **read-only staged transcripts** (the handoff's "Casey · human" etc.) so the
  panel looks lived-in on first launch. Matches "part demo, part working app." Selecting a real
  session reopens its live thread; selecting a seed shows its canned transcript (no live send).

### Assistant proposals (ASST-02)
- **D-02: Client-side pattern match — no seam change.** The Phase 7 harness does not emit
  "proposal" events, and Phase 6 does NOT add one. Instead, parse the streamed assistant reply
  client-side for a proposal marker/format and render matching spans as serif-italic quote
  blocks; y/d/n resolve **locally**. Accepting a proposal is the natural feed into ＋MAKE CARD
  (D-06). Seeded demo sessions may carry a pre-rendered proposal to showcase the affordance.

### Assistant resize (ASST-03)
- **D-03: Reuse the bespoke rail pointer pattern.** Assistant resize grip, snap-to-close, and
  expand-to-fullscreen reuse the existing bespoke pointer-drag approach from the left rail
  (`railSnap.ts` / `useRailDrag.ts` / `pointerdown/move/up` + `setPointerCapture`) — NOT a DnD
  lib (CLAUDE.md: rail/assistant stay bespoke). Width persists via the shell store
  (`asstWidth` / `assistantOpen` slice). "LET GO TO SNAP" cue per the handoff dc.html.

### Home visibility (HOME-01)
- **D-04: Empty-dock state AND summonable.** Home renders when the dock is empty *and* can be
  re-summoned anytime over a populated workspace by wiring the existing `DiviChip` `toggleDivi`
  and `LogoCluster` `openHome` stubs (currently console no-ops). Rendered as a dock panel /
  overlay. More app-like than empty-only.

### Home card state (HOME-02)
- **D-05: Persist rearrangements via host.storage.** Section membership (PINNED/FRESH/LIVING/
  ARCHIVE) and within-section order survive restart, routed through `host.storage` / the shell
  store (the reference `home-cards.js` uses `localStorage 'sourcerer-home-cards-v2'` — replace
  with the async `host.storage` seam, applet-scoped per Phase 4 D-14/15/16). Drag is real
  state, not a demo toy. Card *content* is still the curated demo `cardDefs`.

### ＋MAKE CARD (assistant → Home)
- **D-06: Minted card derived from the accepted proposal / last message.** The assistant's
  ＋MAKE CARD action mints a card whose title/foot come from the accepted proposal (D-02) or the
  last assistant message — tying the ASST-02 y/d/n accept flow to Home. Cross-surface wiring
  goes through a shell-level store/action (Home is a shell surface, not an applet, so this does
  NOT touch the deferred assistant↔applet cross-awareness mechanism). New card lands in FRESH
  (or PINNED — planner's call) and persists per D-05.

### Claude's Discretion
- Model picker in the assistant header (handoff dc.html shows a model search/picker): wire to
  the real Phase 7 config/`host.setModes` if cheap, else render as a demo picker — planner's
  call. Not a founder-facing decision.
- FLIP animation implementation detail, exact snap thresholds/px, seed-transcript content, and
  which section receives a minted card — all standard-approach, planner's discretion.
- Whether multi-session list introduces a Zustand slice or extends local panel state — Phase 7
  left this open ("no Zustand exists yet"); planner decides based on the cross-surface needs of
  D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (pixel-perfect targets)
- `design-sync-setup-guide/design_handoff_bespoke_rails_shell/home-cards.js` — the metro
  Home reference: dnd-kit `@dnd-kit/core` + `@dnd-kit/sortable`, the `cardDefs` registry, FLIP,
  section layout. Port this for HOME-01/02.
- `design-sync-setup-guide/design_handoff_bespoke_rails_shell/Sourcerer Bespoke Rails.dc.html`
  — the assistant panel reference: session list, thread, serif-italic proposal block + y/d/n,
  "LET GO TO SNAP" resize cue (line ~90), model picker, composer. Port for ASST-01/02/03.
- `design-sync-setup-guide/design_handoff_bespoke_rails_shell/README.md` — handoff overview.

### The real AI seam (consume unchanged — do NOT extend)
- `src/assistant/AssistantPanel.tsx` — the minimal Phase 7 panel this phase GROWS (session
  minting, `host.ai()` streaming wiring, `customAlphabet` sessionId contract, CR-01 landmine).
- `src/host/ai.ts` — `host.ai()` / `host.setModes()` promise wrapper + `AssistantEvent` union
  (8 event shapes). Proposals are client-side (D-02) — no new event shape here.
- `.planning/phases/07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a/07-CONTEXT.md`
  — Phase 7 decisions: lazy per-sessionId sessions (D-09), honest-degrade (D-06), 120s timeout,
  session persistence. The "Full multi-session switcher UI … — Phase 6" deferral is THIS phase.
- `./.claude/skills/spike-findings-sourcerer/SKILL.md` — harness patterns/landmines (lean
  modes, Pi API drift). Load via `Skill("spike-findings-sourcerer")`.

### Existing shell code to extend (read before editing)
- `src/shell/railSnap.ts`, `src/shell/useRailDrag.ts`, `src/shell/useRailDragOut.ts` — the
  bespoke pointer-resize pattern to reuse for ASST-03 (D-03).
- `src/shell/DiviChip.tsx`, `src/shell/LogoCluster.tsx` — the `toggleDivi` / `openHome` stubs to
  wire for Home visibility (D-04).
- `src/store/shellStore.ts` — shell store (`asstWidth`, `assistantOpen`, add Home-card slice).
- `src/host/storage` seam + Phase 4 `04-CONTEXT.md` D-14/15/16 — async applet-scoped storage for
  D-05 card persistence.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ASST-01/02/03, HOME-01/02 (§ Dashboard Assistant, § Home).
- `.planning/ROADMAP.md` § Phase 6 — success criteria (note the stale "stubbed" wording,
  corrected above).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AssistantPanel.tsx` (Phase 7): live `host.ai()` streaming, sessionId mint/persist, message
  thread + composer — the growth base for ASST-01.
- Bespoke rail resize (`railSnap.ts` / `useRailDrag.ts`): the pointer-capture + snap pattern to
  reuse for the assistant grip (ASST-03).
- `home-cards.js`: complete dnd-kit sortable Home implementation to port (React-via-props →
  normal imports per CLAUDE.md).
- `DiviChip` / `LogoCluster` openHome/toggleDivi stubs: hit targets already wired to a no-op;
  just replace the handler.

### Established Patterns
- Bespoke pointer events (`pointerdown/move/up` + `setPointerCapture`) for rail/assistant;
  dnd-kit for card sorting (CLAUDE.md lock).
- `host.storage` is async, applet-scoped, `sourcerer:<appletKey>:<key>` (Phase 4).
- Applets/surfaces reach AI ONLY through `host.ai()` — never `invoke` (Phase 4/7 boundary test
  enforces host-only seam).

### Integration Points
- Assistant → Home cross-surface action (＋MAKE CARD, D-06) via a shell-level store/action.
- Home visibility toggle → shell store + dock empty-state (D-04).
- Card layout persistence → `host.storage` (D-05).
- Assistant width/open → existing `asstWidth` / `assistantOpen` shell-store slice (D-03).

</code_context>

<specifics>
## Specific Ideas

- Seed the session list with the handoff's demo transcripts ("Casey · human", etc.) for a
  lived-in first launch (D-01).
- Proposal accept (y) should be the trigger that offers/feeds ＋MAKE CARD (D-02 → D-06).
- "LET GO TO SNAP" mono-caps cue during resize drag, per dc.html line ~90.

</specifics>

<deferred>
## Deferred Ideas

- **Real proposal events on the AI seam** — client-side pattern match ships now (D-02); a real
  sidecar-emitted proposal event is a future seam extension if ever needed.
- **Home cards backed by live Databasise/applet data** — cards stay curated demo `cardDefs`;
  live card data lands with the deferred assistant↔applet cross-awareness design.
- **Assistant↔applet AI cross-awareness / shared activity log** — still deferred (Phase 4);
  ＋MAKE CARD stays shell-level and does not open this.
- **mnemopi durable memory, Notes/Coding/Memory assistant modes** — Phase 7 deferrals, unchanged.

None of the above surfaced as scope creep — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-dashboard-assistant-home*
*Context gathered: 2026-07-14*
