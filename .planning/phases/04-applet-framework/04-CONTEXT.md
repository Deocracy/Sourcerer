# Phase 4: Applet Framework - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the **plugin contract** that makes Sourcerer "part demo, part working app":
a static typed registry, the single `host` API seam (`storage` / `ai()` / `open()` /
`instanceId` / `theme`), and a high-fidelity demo stub for **every** unbuilt applet — with
the module signature **finalized before any real applet exists** (Phase 5 Notes consumes it
unchanged). Requirements **FWK-01..04**.

**Explicitly NOT in Phase 4:**
- The Notes applet's real functionality → **Phase 5** (Notes replaces its stub through this
  registry — the proof the loop works).
- The Dashboard Assistant panel surface and Home dashboard → **Phase 6**.
- Any Power Browser engine work, tab hibernation, or assistant↔browser features → future
  applet phases (see Deferred Ideas — deliberately captured, deliberately not designed).
- Assistant↔applet AI cross-awareness → deferred, mechanism **undecided** (no activity log,
  no shared memory built this phase).
- Dynamic/runtime plugin loading — registry is static build-time imports (CLAUDE.md lock).

</domain>

<decisions>
## Implementation Decisions

### host.ai() — the AI seam (FWK-04, supersedes "stubbed v1" wording)
- **D-01: Real Pi sidecar backend, no stub.** Applet `host.ai()` calls route through the
  same Phase 7 sidecar the assistant uses. FWK-04's "stubbed v1" wording predates Phase 7
  pulling the real backend forward — do NOT build a throwaway stub next to a working seam.
- **D-02: ONE applet type.** One manifest (`{key, glyph, code, title, desc}`) + one
  `App({host})` signature + one registry for all 13 applets. Capabilities are **options on
  `host`**, never applet *types*. No type field, no taxonomy.
- **D-03: Contract shape:** `host.ai(prompt, {onDelta?}) → Promise<string>`. Promise
  resolves with the final text; optional `onDelta(text)` callback streams incremental text
  for applets that want a live typing effect. The sidecar's raw event protocol
  (`text_delta`/`tool_start`/…) stays **private to `src/host/`** — one module absorbs
  protocol drift (Pi 0.74→0.80 drift already happened once), never thirteen applets.
- **D-04: Stateless one-shot calls.** No conversation memory between applet calls. Each call
  runs in its own throwaway sidecar session (Phase 7 D-09 lazy per-sessionId pattern).
  Chat-the-applet's conversation needs are its own phase's problem.
- **D-05: Lean, no tools.** Applet calls are plain completions — no Databasise/corpus tools.
  Fast, cheap, predictable. Corpus-aware applet AI arrives when a real applet needs it.
- **D-06: Errors reject the promise** with a typed error message; each applet renders its own
  error UI. Honest-degrade discipline carried from Phase 7: exactly one error, never a hang.
- **D-07: Auto-cancel on unmount.** The host ties each in-flight call to the applet instance;
  closing the tab abandons the call (no orphaned `onDelta` into dead UIs). No manual cancel
  API in v1.
- **D-08: Concurrent, per-instance.** Each applet instance may have one in-flight call,
  concurrently with other instances and the assistant. Sessions are **fully isolated** — no
  applet or assistant sees another's AI activity (cross-awareness deferred, undecided).
- **D-09: Reserved agentic extension seam (named, NOT built).** Chat and Applet Builder may
  later need the full event surface (tool activity, sessions). That arrives as an **additive**
  `host` method in their own phases — nothing in Phase 4's contract may preclude it.

### Demo stubs (FWK-03)
- **D-10: Two-tier stubs.** Port the NEW handoff's **rich interactive demos** for Wiki
  (`wiki.js`: article view, provenance inspector, edit→dry-run→apply→undo, hand-authored
  Ficino corpus) and Library (`library.js`). The other ~11 applets get a **uniform templated
  stub** (glyph tile, code crumb, serif title, demo rows) fed per-applet from one component.
- **D-11: Stubs ARE applets.** Every stub — rich and templated — is an ordinary applet module
  registered in `registry.ts`, consuming `host`/`theme` like a real applet. Dogfoods the
  contract from day one; "replacing a stub" = swapping one module in the registry (FWK-02
  literally). The `PanelBody` generic placeholder remains only as the unknown-key fallback
  (Phase 3 D-06).
- **D-12: Subtle DEMO marker.** Every stub (including rich Wiki/Library) carries a small mono
  "DEMO" chip/eyebrow — keeps the pixel-perfect illusion, stays honest about what's real.
- **D-13 (discretion): Templated stub row content.** Claude decides per applet during
  planning — believable per-applet fake rows where cheap (Kanban cards, News feed items),
  generic where not.

### host.storage (FWK-04)
- **D-14: Applet-scoped shared storage + separate per-instance slot.** `host.storage`
  get/set/remove is shared across ALL instances of an applet (two Notes tabs see the same
  notes). Per-TAB UI state (scroll pos, selection) goes through Phase 3's `instanceId`-keyed
  slot in the workspace record (D-10 of Phase 3) via its own small surface. Two kinds of
  state, two homes.
- **D-15: Dedicated store file.** Applet storage lives in its own plugin-store file (e.g.
  `applets.json`) keyed `sourcerer:<appletKey>:<key>` — NOT folded into `workspace.json`.
  CLAUDE.md "one store file per logical concern"; applet data churn can't bloat or corrupt
  the layout record.
- **D-16: Async Promise API.** `get`/`set`/`remove` return Promises — honest about the disk
  backend; applets await reads at mount (normal React effect pattern). No sync-preload layer.

### Registry ↔ rail/catalog (FWK-01, FWK-02)
- **D-17: `host.open(appletKey)` = focus-or-open.** If the target applet already has an open
  tab, focus it; otherwise open a fresh instance as a new tab in the active group. (The
  rail's own addApplet keeps its always-new-instance behavior — DOCK-04 unchanged.)
- **D-18: Real Applet Catalog picker.** Phase 4 replaces the dock '+' key-cycling hack with a
  real picker fed by the registry (glyph + title + desc per applet, click to open).
- **D-19: New keys append to rail end.** A registered key not present in the saved
  `railOrder` appends at the bottom of the main group (above the pinned footer) —
  deterministic, never disturbs the user's custom order.

### Claude's Discretion (defaulted)
- Templated stub demo-row content per applet (D-13).
- Whether `appletDefs.ts` merges into the registry manifests (one source of truth) or stays
  as a derived map — planner's call; no glyph/title drift either way.
- `host.theme` delivery shape (tokens object vs CSS-var passthrough) — must expose the
  handoff token set; mechanism is implementation detail.
- The per-instance state surface's exact API shape (reads/writes into Phase 3's D-10 slot).
- Catalog picker placement/interaction details within the dock '+' affordance (pixel pass
  can refine via /gsd-ui-phase 4 — roadmap flags "UI hint: yes").
- Manifest `code` field values (the code crumbs) — take from the handoff where specified.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Applet Framework — FWK-01..04 verbatim.
- `.planning/ROADMAP.md` §"Phase 4: Applet Framework" — goal + 3 success criteria.

### The applet contract (module signature source)
- `Design sync setup guide/design_handoff_sourcerer_tauri/reference/applets/README.md`
  (folder name has spaces — navigate manually) — the ORIGINAL authoritative contract:
  `manifest {key, glyph, code, title, desc}` + `App({host})`, the host API table
  (`storage`/`ai`/`open`/`instanceId`/`theme`), theme tokens, stub-replacement semantics.
  Adapt per CLAUDE.md: drop React-via-props (bundled app imports React normally).
- `Design sync setup guide/design_handoff_sourcerer_tauri/reference/applets/_TemplateApplet.js`
  and `registry.js` — the registration pattern to mirror in typed `registry.ts`.
- `CLAUDE.md` (project root) §Stack Patterns — static ES module imports in `registry.ts`;
  NO dynamic plugin loading; applets as ordinary `.tsx` modules.

### Rich demo sources (port these)
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/wiki.js` — the rich Wiki
  demo (article view, provenance, Unresolved block, edit→dry-run→apply→undo, Ficino corpus).
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/library.js` — the rich
  Library demo.
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/store.js` — the shared
  zustand store pattern those demos read (selected entity, corpus, review count).
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/README.md` — tokens/metrics
  for stub chrome fidelity.

### The AI seam (backend already real)
- `src/host/ai.ts` — Phase 7's sidecar event contract (8 event shapes). The applet-facing
  promise wrapper is built HERE; the event union stays private to this module.
- `.planning/phases/07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a/07-CONTEXT.md`
  — sidecar decisions (lazy per-sessionId sessions D-09, honest-degrade D-06, 120s timeout).
- `./.claude/skills/spike-findings-sourcerer/SKILL.md` — harness patterns/landmines (lean
  modes, Pi API drift) informing the promise wrapper.

### Existing code to extend (read before editing)
- `src/shell/appletDefs.ts` — current single source of glyph/title/desc; feeds or merges into
  the registry manifests.
- `src/shell/PanelBody.tsx` (`makeRenderer`) — the dockview dispatch seam; per-key registry
  dispatch is added alongside the generic fallback, not replacing it.
- `src/shell/Dock.tsx` — `addAppletToDock`, the '+' action to replace with the catalog picker,
  and the dockview panel lifecycle the host binds `instanceId`/auto-cancel to.
- `src/shell/Rail.tsx` + `src/store/shellStore.ts` — railOrder merge point for D-19 append.
- `src/persistence/` + `.planning/phases/03-persistence-layouts/03-CONTEXT.md` — the unified
  workspace record (D-09), per-instance slot (D-10), migration seam (D-07) that D-14's
  instance-state surface writes into; `applets.json` follows the same plugin-store patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`appletDefs.ts`**: 13 applet defs already ported verbatim from the handoff — becomes/feeds
  the registry manifests.
- **`PanelBody.tsx` `makeRenderer`**: the exact seam its own comments reserve for "real
  per-applet dispatch (Phase 4/5)" — add registry lookup before the generic fallback.
- **`src/host/ai.ts`**: complete typed sidecar client — the promise wrapper composes over it;
  no Rust/sidecar changes expected for basic one-shots.
- **Phase 3 persistence stack** (`workspaceStore`, migration registry, debounced save): the
  per-instance slot and schema-bump seam D-14 rides on; adding record fields = add a migrator,
  never a breaking change.

### Established Patterns
- **Best-effort try/catch persistence** — parsing persisted state never crashes the shell.
- **Vanilla zustand store + `useStore` selectors** — how stubs read shared shell state (the
  rich Wiki demo reads selected entity/corpus from the store, mirroring handoff `store.js`).
- **Honest-degrade AI errors** (Phase 7 D-06) — exactly one error+done, never a hang; the
  promise wrapper inherits this.
- **CSS Modules + tokens.css** — stub styling follows the shell's token discipline; handoff
  demos' inline `T` color object maps onto existing tokens.

### Integration Points
- `makeRenderer` in `PanelBody.tsx` — registry dispatch entry.
- Dock '+' action in `Dock.tsx` — catalog picker mount.
- `railOrder` merge in `shellStore.ts` restore path — new-key append (D-19).
- `src-tauri` — second plugin-store file registration (`applets.json`).
- Sidecar `host_ai` command — reused as-is with per-call throwaway sessionIds.

</code_context>

<specifics>
## Specific Ideas

- The handoff's rich Wiki demo is "the moat" demo — the edit→dry-run→apply→undo flow with
  provenance is the showcase; port it faithfully, not a simplified sketch.
- "Part demo is a feature, not debt" — stubs should look believable at a glance (hence subtle
  DEMO marker, not a loud placeholder banner).
- One host module absorbs sidecar protocol drift — the user explicitly weighed
  capabilities/drawbacks and chose the promise+onDelta middle ground over exposing events.

</specifics>

<deferred>
## Deferred Ideas

- **Assistant↔applet AI cross-awareness** — mechanism deliberately UNDECIDED (options
  sketched: host-side activity log the assistant can read / assistant tools over applet
  state / shared OMP memory). Design belongs to a future assistant phase. Phase 4 builds
  nothing for it.
- **Agentic host.ai extension** (full event stream, tool visibility, sessions) for Chat and
  Applet Builder — reserved additive seam (D-09), designed in their own phases.
- **Power Browser engine selection** — Lightpanda (Zig, headless CDP, scraping-oriented) vs
  ungoogled-Chromium (full rendering + Google-extension support), headless vs headful, and
  per-tab click-to-redirect between engines. Needs its own research pass/spike at the Power
  Browser phase — the browser landscape will have shifted by then.
- **Power Browser tab lifecycle** — hibernate/sleep/discard for memory; prior art to survey:
  Chromium tab discarding, Auto Tab Discard, CDP Page lifecycle APIs. One engine process
  backing many Sourcerer tabs is applet-internal and the contract doesn't prevent it.
- **Assistant↔browser interplay** — assistant pre-loads tabs for a work session, observes
  browsing, pulls notes into another tab. Lands on the deferred cross-awareness design.
- **KeyPass autofill security boundary** — assistant can *trigger* password fill but can
  never *read* the secret (vault-process capability-handle design). KeyPass phase.
- **Pane geometry/visibility host capability** — a future ADDITIVE `host` surface telling an
  applet its pane's screen rect + visibility events, so Power Browser can position a native
  webview over its pane. Recorded so nobody freezes an "every applet body is pure DOM"
  assumption into the contract. NOT built in Phase 4.

</deferred>

---

*Phase: 4-applet-framework*
*Context gathered: 2026-07-09*
