# Phase 6: Dashboard Assistant & Home - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 6-dashboard-assistant-home
**Areas discussed:** Assistant sessions, Assistant proposals, Home visibility, Home card state, ＋MAKE CARD

---

## Assistant sessions (ASST-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Real sessions + demo seeds | New/active = real Pi sessions (live streamed, reopened JSONL); list also seeded with read-only staged transcripts | ✓ |
| Fully real, no seeds | Every row is a real Pi session; sparse on first launch | |
| Demo switcher, one real | List is staged transcripts; only active session reaches the harness | |

**User's choice:** Real sessions + demo seeds
**Notes:** Matches "part demo, part working app." Grows Phase 7's single-session panel to multi-session.

---

## Assistant proposals (ASST-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side pattern match | Parse streamed reply for proposal marker; render as quote blocks; y/d/n resolve locally; accept feeds ＋MAKE CARD | ✓ |
| Scripted demo | Pure UI affordance on seeded sessions / canned trigger; visual-only | |
| Real seam event | Add proposal event to host.ai() + sidecar | |

**User's choice:** Client-side pattern match
**Notes:** No seam/sidecar change — Phase 7 seam consumed unchanged. Accept (y) is the natural feed into ＋MAKE CARD.

---

## Home visibility (HOME-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Empty-dock state + summonable | Renders on empty dock AND re-summonable via DiviChip/LogoCluster stubs | ✓ |
| Empty-dock only | Purely the empty-workspace state; stubs route back to empty dock | |

**User's choice:** Empty-dock state + summonable
**Notes:** Wires the existing `toggleDivi` / `openHome` console-stub handlers.

---

## Home card state (HOME-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Persist via host.storage | Section membership + order survive restart via async host.storage seam | ✓ |
| Reset to demo layout | Curated demo arrangement each launch; drags ephemeral | |

**User's choice:** Persist via host.storage
**Notes:** Reference uses `localStorage 'sourcerer-home-cards-v2'`; replace with applet-scoped host.storage. Card content stays demo `cardDefs`.

---

## ＋MAKE CARD (assistant → Home)

| Option | Description | Selected |
|--------|-------------|----------|
| Derived from proposal/convo | Card title/foot from accepted proposal or last assistant message | ✓ |
| Canned demo card | Preset placeholder card | |

**User's choice:** Derived from proposal/convo
**Notes:** Ties ASST-02 y/d/n accept to Home. Cross-surface wiring via shell-level store/action (Home is a shell surface, not an applet — does not touch deferred assistant↔applet cross-awareness).

---

## Claude's Discretion

- Model picker in assistant header: wire to real Phase 7 config/`host.setModes` if cheap, else demo picker.
- FLIP animation detail, snap thresholds/px, seed-transcript content, minted-card target section.
- Whether multi-session list uses a Zustand slice or extends local panel state (Phase 7 left open).

## Deferred Ideas

- Real proposal events on the AI seam (client-side match ships now).
- Home cards backed by live Databasise/applet data (stay curated demo cardDefs).
- Assistant↔applet AI cross-awareness / shared activity log (Phase 4 deferral, unchanged).
- mnemopi durable memory, Notes/Coding/Memory assistant modes (Phase 7 deferrals).
