# Phase 4: Applet Framework - Research

**Researched:** 2026-07-10
**Domain:** Plugin/registry contract for a Tauri+React shell (static TSX module registry, a single `host` API seam, dockview panel-dispatch integration)
**Confidence:** HIGH (the entire phase is additive code over an already-shipped, already-inspected codebase — no new external unknowns)

## Summary

Phase 4 has almost no "unknown ecosystem" risk: every dependency it needs (`@tauri-apps/plugin-store`, `zustand`, `nanoid`, `dockview-core`, React 18) is already installed and already in production use from Phases 1-3, and the real AI backend (Phase 7's sidecar) already exists and is already wired to a working `host.ai()`-shaped Tauri command (`host_ai`). This phase is therefore a **contract/integration phase**, not a library-adoption phase: the research below is almost entirely about the exact seams in the existing codebase the plan must hook into, and about real gaps/pitfalls discovered by reading that code directly (not training-data guesses).

Three integration points carry the most planning risk and are covered in depth: (1) `PanelBody.tsx`'s `makeRenderer`/`init()` currently discards the dockview `GroupPanelPartInitParameters` it's handed, and must be extended to capture the full panel id (`parameters.api.id`) to derive `host.instanceId` and to know what to cancel on `dispose()`; (2) the Phase 7 sidecar's session model is **file-backed only** (Pi's `SessionManager`, no in-memory option) and its mode-toggle state (`active` Set in `sidecar/src/modes.ts`) is a **single global mutable variable for the whole process**, not per-session — both facts materially affect how "stateless one-shot, concurrent, per-instance" (D-04/D-08) actually behaves at the sidecar layer and must be designed around, not assumed away; (3) the rich Wiki/Library demo ports use several inline hex colors (`amber`, `warm`, `red`) that have **no corresponding token** in `src/styles/tokens.css` today — the plan must either add tokens or explicitly keep those as literal, non-tokenized values (UI-SPEC says "ported verbatim... do not re-theme," which supports the latter, but the plan should say so explicitly rather than leave it implicit).

**Primary recommendation:** Build one `src/host/index.ts` (or extend `src/host/ai.ts`) that assembles the full `host` object (`storage`, `ai`, `open`, `instanceId`, `theme`) as a factory `makeHost(instanceId: string)`, feed it into `makeRenderer`'s per-panel mount (via the captured `parameters.api.id`), and keep the registry itself (`registry.ts`) a flat static-import map exactly like the two design-handoff `registry.js` references show — no dynamic loading, no per-applet special-casing beyond the manifest.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Applet registry (key → module) | Frontend (Vite/React static imports) | — | Static ES module imports per CLAUDE.md; no backend involvement |
| Panel dispatch (`makeRenderer`) | Frontend (dockview integration layer, `src/shell/`) | — | dockview owns the panel lifecycle; `PanelBody.tsx` is the seam into React |
| `host.storage` | Frontend (JS `LazyStore` call) | Tauri Rust (generic `tauri-plugin-store`, already registered) | No new Rust code needed — the plugin is file-name-agnostic; a second `LazyStore("applets.json")` "just works" |
| `host.ai()` promise wrapper | Frontend (`src/host/`) | Rust command (`host_ai`) → Node sidecar | Promise/onDelta wrapper is pure frontend; it composes over the already-built Rust→sidecar pipe, no backend changes expected |
| `host.open()` | Frontend (dockview `DockviewApi`) | — | Pure client-side panel focus-or-create logic against the live `dockApiRef` |
| `host.instanceId` | Frontend (dockview panel id) | — | Derived from the panel id dockview already assigns (`${key}:${nanoid()}`) |
| `host.theme` | Frontend (CSS custom properties / `tokens.css`) | — | Read-only token passthrough, no new infrastructure |
| Demo stub content (rich Wiki/Library, templated others) | Frontend (React components) | — | Pure presentational; store reads (corpus/selection) go through the existing `zustand` shell pattern |
| AI seam protocol (event shapes) | Backend (Node sidecar, Rust relay) | — | Already built in Phase 7; Phase 4 must not duplicate or bypass it |

## Standard Stack

### Core

No new libraries. Everything Phase 4 needs is already an installed, version-pinned dependency (verified directly against `package.json`, not assumed):

| Library | Installed Version | Purpose in Phase 4 | Source |
|---------|---------|---------|--------|
| `dockview-core` | 2.0.0 (pinned exact) | Panel dispatch seam (`createComponent`, `GroupPanelPartInitParameters`, `setActivePanel`) that the registry/host wiring hooks into | `[VERIFIED: package.json]` |
| `@tauri-apps/plugin-store` | ^2.4.3 | Second `LazyStore("applets.json")` file for `host.storage` (D-15) — no Rust changes, `tauri_plugin_store::Builder::default()` is already registered generically in `src-tauri/src/lib.rs` | `[VERIFIED: package.json + src-tauri/src/lib.rs]` |
| `zustand` | 5.0.14 | Shared cross-applet UI state (e.g. Wiki/Library "selected entity" pattern, mirroring the handoff's `store.js`) | `[VERIFIED: package.json]` |
| `nanoid` | ^5.1.16 | Already used for panel instance ids (`${key}:${nanoid()}`); reusable for one-shot AI session ids (D-04) | `[VERIFIED: package.json + src/shell/Dock.tsx]` |
| `react` / `react-dom` | 18.2.0 | Applet `App({host})` components; ordinary `.tsx` modules per CLAUDE.md (no React-via-props) | `[VERIFIED: package.json]` |

### Supporting

None new. `@tauri-apps/api` (Channel/invoke) is already used by `src/host/ai.ts` and needs no additions for a promise-wrapper layer built on top of it.

### Alternatives Considered

Not applicable — this phase is scoped by CLAUDE.md/CONTEXT.md to reuse the exact already-adopted stack; no alternative-library research is warranted (D-02/D-15/D-16 in 04-CONTEXT.md already lock the shape).

**Installation:**
```bash
# No new packages. Verify nothing has drifted:
npm ls dockview-core @tauri-apps/plugin-store zustand nanoid react react-dom
```

## Package Legitimacy Audit

**Not applicable this phase.** Phase 4 introduces zero new external packages — every dependency it touches (`dockview-core`, `@tauri-apps/plugin-store`, `zustand`, `nanoid`, `react`) is already installed, already used in shipped Phase 1-3/7 code, and was already gated through the Phase 2 legitimacy check (per `.planning/STATE.md`: "locked deps installed behind approved legitimacy gate"). No `slopcheck`/registry re-verification is needed; there is nothing new to audit.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌───────────────────────────────────────────┐
                        │            registry.ts (static)            │
                        │  import * as Wiki from "./applets/Wiki"    │
                        │  import * as Library from "./applets/..."  │
                        │  export const registry: Record<key, mod>   │
                        └───────────────────┬─────────────────────────┘
                                            │ manifest {key,glyph,code,title,desc}
                                            │ App({host})
                                            ▼
┌──────────────┐   opts.id="Wiki:aB3"  ┌─────────────────────────────┐
│  Dock.tsx     │──────────────────────▶│ makeRenderer(id, key)        │
│ createComponent│  (dockview calls)     │  PanelBody.tsx               │
│ (dockview-core)│                       │  init(parameters) captures   │
└──────┬────────┘                        │  parameters.api.id = "Wiki:aB3"
       │  api.addPanel / setActivePanel   │  → makeHost(instanceId)      │
       │  (host.open focus-or-open)       └───────────┬──────────────────┘
       │                                              │ host = {storage, ai, open, instanceId, theme}
       ▼                                              ▼
┌──────────────┐                          ┌─────────────────────────────┐
│ Rail.tsx /    │                          │ registry[key].App({host})   │
│ Applet Catalog│                          │  (Wiki/Library rich demo,   │
│ picker (D-18) │                          │   or templated PanelBody,  │
└──────────────┘                          │   or a real applet)         │
                                           └───────────┬──────────────────┘
                                                       │
                     ┌─────────────────────────────────┼───────────────────────────┐
                     ▼                                 ▼                           ▼
          ┌─────────────────────┐         ┌─────────────────────┐     ┌──────────────────────┐
          │ host.storage          │         │ host.ai(prompt,opts) │     │ host.open(key)        │
          │ LazyStore("applets    │         │ src/host/ai.ts        │     │ dockApiRef.panels      │
          │  .json"), keyed        │         │  invoke("host_ai",     │     │  .find(key) →          │
          │  sourcerer:<key>:<k>   │         │   sessionId=nanoid(),  │     │  setActivePanel        │
          └─────────────────────┘         │   modes:[])            │     │  OR addAppletToDock    │
                                           │  → Rust host_ai        │     └──────────────────────┘
                                           │  → Node sidecar        │
                                           │  (file-backed session, │
                                           │   global mode Set)     │
                                           └─────────────────────┘
```

### Recommended Project Structure

```
src/
├── shell/
│   ├── registry.ts          # NEW — static key→module map (manifest + App), Phase 4's FWK-01
│   ├── appletDefs.ts         # EXISTING — feeds/merges into registry manifests (Claude's discretion, D-CONTEXT)
│   ├── PanelBody.tsx         # EXTENDED — makeRenderer gains real per-key dispatch via registry, keeps generic fallback
│   ├── Dock.tsx              # EXTENDED — "+" button opens Applet Catalog picker (D-18) instead of key-cycling
│   ├── AppletCatalog.tsx     # NEW — the picker (LayoutsMenu-pattern dropdown)
│   └── AppletCatalog.module.css
├── host/
│   ├── ai.ts                 # EXISTING (Phase 7) — low-level event-listener client, UNCHANGED
│   ├── aiComplete.ts         # NEW — the D-03 promise+onDelta wrapper over ai.ts, one-shot session id gen
│   ├── storage.ts            # NEW — applets.json LazyStore + get/set/remove (D-14/D-15/D-16)
│   ├── instanceState.ts      # NEW — thin surface over workspaceStore's instanceState slot (D-14 per-tab state)
│   ├── theme.ts               # NEW — host.theme token object (reads CSS custom properties or a static map)
│   └── index.ts               # NEW — assembles makeHost(instanceId) from the above four
└── applets/
    ├── Wiki/                  # rich demo port (wiki.js → Wiki.tsx + subcomponents)
    ├── Library/                # rich demo port (library.js → Library.tsx + subcomponents)
    ├── _stub/TemplatedStub.tsx # the one shared templated-stub component (D-10/D-13), still "an applet"
    └── <EachOtherKey>.tsx      # ~11 thin modules exporting manifest + App that render <TemplatedStub .../>
```

### Pattern 1: Static registry, mirroring the two handoff `registry.js` references verbatim

**What:** A flat object/array mapping `manifest.key` → `{ manifest, App }`, built from static ES module imports — exactly the pattern in both design-handoff `registry.js` files, adapted per CLAUDE.md to drop the React-via-props indirection (this is a real bundler now).
**When to use:** Always — FWK-01/FWK-02 require this shape; no dynamic `import()` in v1.
**Example:**
```typescript
// Source: Design sync setup guide/design_handoff_sourcerer_tauri/reference/applets/registry.js
// (adapted: ordinary import, no React-via-props — CLAUDE.md "What NOT to Use")
import * as Wiki from "../applets/Wiki";
import * as Library from "../applets/Library";
// ...one import per applet key, including the ~11 templated-stub modules

export interface AppletManifest {
  key: string;
  glyph: string;
  code: string;
  title: string;
  desc: string;
}
export interface AppletModule {
  manifest: AppletManifest;
  App: (props: { host: Host }) => JSX.Element;
}

export const registry: Record<string, AppletModule> = {
  Wiki, Library, /* ...every key */
};
```

### Pattern 2: Capture the dockview panel id at `init()`, not at `createComponent()`

**What:** `PanelBody.tsx`'s current `makeRenderer(key)` only ever sees the *split* key (`opts.name || opts.id`, `.split(":")[0]`), discarding the nanoid instance suffix, and its `DockContentRenderer.init` is a no-op (`init: () => {}`). dockview's real content-renderer contract passes `init(parameters: GroupPanelPartInitParameters)` where `parameters.api.id` is the **full** panel id (e.g. `"Wiki:aB3xY"`) and `parameters.api` is the live `DockviewPanelApi` (has `.isActive`, events, etc.).
**When to use:** Every real applet mount needs a stable, unique `instanceId` (FWK-04) — this is the only place dockview hands it to you before/at mount time.
**Example:**
```typescript
// Verified against node_modules/dockview-core/dist/esm/panel/types.d.ts (PanelInitParameters)
// and node_modules/dockview-core/dist/esm/dockview/types.d.ts (GroupPanelPartInitParameters)
export function makeRenderer(fullPanelId: string, appletKey: string): DockContentRenderer {
  const element = document.createElement("div");
  element.style.height = "100%";
  let root: Root | null = null;

  return {
    element,
    init: (parameters) => {
      // parameters.api.id === fullPanelId, available here even if the caller
      // only had the createComponent-time id before — prefer parameters.api.id
      // as the single source of truth so a future dockview upgrade that changes
      // createComponent's id-handling doesn't silently break instanceId.
      const instanceId = parameters.api.id;
      const mod = registry[appletKey];
      root = createRoot(element);
      if (mod) {
        const host = makeHost(instanceId);
        root.render(<mod.App host={host} />);
      } else {
        root.render(<PanelBody appletKey={appletKey} />); // unknown-key fallback (D-11, Phase 3 D-06)
      }
    },
    dispose: () => {
      cancelInFlightAi(instanceId); // D-07: auto-cancel on unmount
      root?.unmount();
      root = null;
    },
  };
}
```
Note: `createComponent: (opts) => makeRenderer(opts.id, key)` in `Dock.tsx` must pass the full `opts.id` through (today it discards it) — this is a one-line but load-bearing change.

### Pattern 3: `host.ai()` promise wrapper — one module absorbs sidecar protocol drift

**What:** D-03's contract (`host.ai(prompt, {onDelta?}) → Promise<string>`) does not exist yet; `src/host/ai.ts`'s `ai()` is an event-listener-callback API keyed by `{message, sessionId, modes}`. Build a thin wrapper, not a new sidecar client.
**When to use:** Every applet call to `host.ai()`.
**Example:**
```typescript
// Source: composes over src/host/ai.ts's existing `ai()` (verified in-repo, Phase 7 D-06/D-09)
import { nanoid } from "nanoid";
import { ai as lowLevelAi, type AssistantEvent } from "./ai";

export function aiComplete(
  prompt: string,
  opts?: { onDelta?: (text: string) => void; signal?: AbortSignal },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const sessionId = `oneshot-${nanoid()}`; // D-04: fresh throwaway session per call
    // isValidSessionId in sidecar/src/sessions.ts requires ^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$
    // — nanoid's default alphabet (A-Za-z0-9_-) plus the "oneshot-" prefix satisfies this.

    void lowLevelAi(
      { message: prompt, sessionId, modes: [] }, // D-05: lean, no tools
      (event: AssistantEvent) => {
        if (event.type === "text_delta") {
          text += event.text;
          opts?.onDelta?.(text);
        } else if (event.type === "error") {
          settled = true;
          reject(new Error(event.message)); // D-06: reject, don't resolve empty
        } else if (event.type === "done" && !settled) {
          settled = true;
          resolve(text);
        }
      },
    );
    opts?.signal?.addEventListener("abort", () => {
      settled = true; // D-07: caller-side abandon; see Pitfall below re: sidecar-side cancel
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}
```

### Pattern 4: `host.open()` — focus-or-open against the live `DockviewApi`

**What:** D-17 requires scanning existing panels for a matching key before creating a new one.
**Example:**
```typescript
// Verified: node_modules/dockview-core/dist/esm/dockview/dockviewComponent.d.ts
// exposes `panels: IDockviewPanel[]` and `setActivePanel(panel: IDockviewPanel): void`
export function hostOpen(appletKey: string): void {
  const api = dockApiRef.current;
  if (!api) return;
  const existing = api.panels.find((p) => p.id.split(":")[0] === appletKey);
  if (existing) {
    api.setActivePanel(existing);
  } else {
    addAppletToDock(appletKey); // existing DOCK-01/DOCK-04 helper, unchanged
  }
}
```

### Pattern 5: `host.storage` — second `LazyStore`, same shape as `workspaceStore.ts`

**What:** D-14/D-15/D-16: a dedicated `applets.json` file, keyed `sourcerer:<appletKey>:<key>`, async Promise API, best-effort try/catch (never crash on a bad read).
**Example:**
```typescript
// Pattern mirrors src/persistence/workspaceStore.ts's LazyStore usage — same plugin, new file.
import { LazyStore } from "@tauri-apps/plugin-store";
const store = new LazyStore("applets.json");

export function makeAppletStorage(appletKey: string) {
  const ns = (key: string) => `sourcerer:${appletKey}:${key}`;
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      try {
        const v = await store.get<T>(ns(key));
        return v == null ? fallback : v;
      } catch {
        return fallback; // best-effort persistence pattern, established in workspaceStore.ts
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      await store.set(ns(key), value);
      await store.save();
    },
    async remove(key: string): Promise<void> {
      await store.delete(ns(key));
      await store.save();
    },
  };
}
```

### Anti-Patterns to Avoid

- **Re-deriving the applet key from a raw string split at mount time** instead of reading `parameters.api.id` in `init()` — the split-hack in current `Dock.tsx`/`PanelBody.tsx` was fine for a generic placeholder (no instanceId needed) but is the wrong seam once real `App({host})` components need a stable `host.instanceId`.
- **Bypassing `src/host/ai.ts` from a new wrapper module** — D-03 explicitly requires the raw 8-event sidecar union to stay private to `src/host/`; a new `aiComplete.ts` must import and compose over `ai.ts`, never re-implement `invoke("host_ai", ...)` itself.
- **Treating `setModes([])` as free/no-op** — every `host.ai()` call still runs `setModes(req.modes)` before the turn server-side (see Pitfall 2 below); passing `modes: []` from every applet call is correct per D-05, but a developer might assume modes are scoped per-session when they are process-global.
- **Assuming dockview's `createComponent`'s `opts.id` and the content renderer's `init(parameters).api.id` could differ** — verify in an early plan task that they match (they should, per dockview's architecture) rather than trusting training-data memory of the library.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Applet Catalog picker keyboard/focus/click-outside behavior | A new dropdown component from scratch | Port `LayoutsMenu.tsx`'s exact pattern (`useSyncExternalStore` binding, `rootRef`/`panelRef` click-outside, `WR-06` focus-into-panel-on-open, ArrowUp/Down+Enter) | Already built, already tested (`LayoutsMenu.test.tsx`), pixel/interaction-proven in this exact shell |
| Sidecar event union / streaming plumbing | A second Tauri Channel client for applets | Compose the D-03 promise wrapper over the existing `src/host/ai.ts` `ai()` function | Protocol drift already happened once (Pi 0.74→0.80); one absorbing module is the whole point of D-03 |
| Per-key JSON persistence with corruption safety | A bespoke try/catch-per-key wrapper from first principles | Mirror `workspaceStore.ts`'s established best-effort pattern (try/catch → fallback, never throw) | This exact failure mode (corrupt persisted JSON must never crash the shell) was already researched/hardened in Phase 3 (T-03-01/ASVS V5) |
| Applet-catalog data (glyph/title/desc) | A second source of truth duplicating `appletDefs.ts` | Merge/derive from `appletDefs.ts` into registry manifests (Claude's discretion, no drift) | 04-CONTEXT.md explicitly warns against glyph/title drift between rail and dock |

**Key insight:** Nearly everything Phase 4 needs already has a proven, tested sibling pattern shipped in Phases 1-3/7 in this exact codebase. The highest-value research contribution here is pointing at those siblings precisely, not searching externally.

## Common Pitfalls

### Pitfall 1: File-backed one-shot sessions accumulate JSONL files forever
**What goes wrong:** D-04 says each applet `host.ai()` call runs "in its own throwaway sidecar session." But `sidecar/src/sessions.ts`'s `FileSessionManager.open(sessionId)` always either opens or **creates and persists** a `SessionManager` — there is no in-memory/ephemeral session option left in the sidecar (D-09 of Phase 7 replaced `SessionManager.inMemory()` entirely). Every one-shot applet call therefore writes a small but permanent `.jsonl` file under `%APPDATA%\sourcerer\assistant-sessions\`.
**Why it happens:** Phase 7 was built for the assistant's own long-lived, restart-surviving chat — it was never designed with a "call it and discard it" use case in mind, and Phase 4 introduces that use case for the first time.
**How to avoid:** Decide explicitly in planning whether to (a) accept file accumulation (likely fine at MVP scale — small text files, cheap), (b) add a lightweight sidecar-side cleanup (e.g. delete-after-done for `oneshot-*`-prefixed session ids), or (c) add a genuinely-ephemeral session path to the sidecar (bigger, cross-phase-boundary change). Recommendation: (a) for v1, with a naming convention (`oneshot-<nanoid>`) that makes future cleanup trivial to add — do NOT silently let this surprise a future disk-usage audit.
**Warning signs:** `assistant-sessions/` directory growing unboundedly during dev/demo use of stub applets that exercise `host.ai()`.

### Pitfall 2: Mode state is a single process-global mutable variable, not per-session
**What goes wrong:** `sidecar/src/modes.ts` holds `const active = new Set<string>([])` at module scope — one instance for the entire sidecar process. `index.ts`'s `handleRequest` calls `await setModes(req.modes)` **before** `runPrompt(session, req)` on every single request (assistant turns AND, after Phase 4, applet one-shot calls). Because the sidecar's main loop is `for await (const req of readRequests()) { await handleRequest(req); }` — fully sequential, one request in flight at a time — this happens to be safe today (no request B's `setModes` can race request A's in-flight `runPrompt`, because there is no concurrent execution inside the sidecar). D-08 in 04-CONTEXT.md says applet calls are "concurrent, per-instance... concurrently with other instances and the assistant" — this is true from the *webview/Tauri* side (multiple `host_ai` invocations can be in-flight in Rust simultaneously, each awaiting its own channel), but at the **sidecar** they queue and execute strictly one-at-a-time. A long-running assistant turn will make an applet's `host.ai()` call visibly wait, and vice versa.
**Why it happens:** The global-Set-plus-sequential-loop design was correct and sufficient for Phase 7's single-chat-panel use case; Phase 4 is the first consumer to introduce multiple concurrent *callers*.
**How to avoid:** This is very likely fine for an MVP applet-stub demo (one-shot completions are typically fast, no tools per D-05) — but the plan should NOT promise true parallel/non-blocking AI calls across applets and the assistant. State this as an accepted MVP limitation (sequential queueing at the sidecar) rather than silently letting a task's acceptance criteria imply parallelism the system doesn't have. No sidecar changes appear necessary for Phase 4 — just accurate expectations in the plan.
**Warning signs:** A demo stub's AI-powered row appears to "hang" while the assistant panel is mid-response, or vice versa — this is expected serialization, not a bug, given the current sidecar architecture.

### Pitfall 3: `dispose()`-time cancellation only stops the *frontend* from acting on stale events — it does not stop the sidecar mid-turn
**What goes wrong:** D-07 ("auto-cancel on unmount... closing the tab abandons the call") is achievable at the webview layer (drop the promise, ignore further `onDelta`/resolve), but there is no existing mechanism in `src-tauri/src/commands/ai.rs` or the sidecar protocol to actually abort an in-flight `session.prompt()` call server-side — the Rust command awaits the sidecar's `done` event with a 120s timeout regardless of whether the frontend still cares about the result.
**Why it happens:** Phase 7 built honest-degrade for *failures*, not caller-initiated cancellation — there was no need for it in a single long-lived chat panel.
**How to avoid:** Scope D-07 to frontend-side abandonment only (ignore late events/resolution) for Phase 4 — do not attempt to add a real cancel-in-flight Rust/sidecar command unless a plan task explicitly budgets for it (it would touch `commands/ai.rs`, the sidecar protocol, and `SidecarProcess` — a materially bigger change than "one Promise wrapper"). Document this scope boundary explicitly so a reviewer doesn't expect the sidecar to actually stop working on an abandoned call.
**Warning signs:** A closed tab's abandoned `host.ai()` call still consumes an LLM API call/tokens in the background — acceptable for v1, but worth a one-line code comment so it isn't mistaken for a bug later.

### Pitfall 4: Rich-demo colors have no home in `tokens.css`
**What goes wrong:** `wiki.js`/`library.js` use a `T` object with `amber` (#D8C69C), `amberBg` (#1E1C17), `warm` (#B8A06E), and `red` (#B05A4E) for the Unresolved block, trust chips, and diff view — none of these exist in `src/styles/tokens.css` today (which only has `--color-danger: #C42B1C`, a different red, reserved for window-chrome destructive actions). The UI-SPEC's Color table doesn't mention amber/warm at all.
**Why it happens:** The rich demos were designed in an HTML prototype with their own inline `T` object; `tokens.css` was built from the *shell chrome* UI-SPEC (Phase 1/2), which never needed warning/amber semantics.
**How to avoid:** Decide explicitly during planning: either (a) add 3-4 new custom properties to `tokens.css` (`--color-warn`, `--color-warn-bg`, etc.) and re-point the ported demo code at them, or (b) keep the ported demo's literal hex values as local constants scoped to `Wiki.tsx`/`Library.tsx` only (matching UI-SPEC's "ported verbatim... do not re-theme" instruction). Recommendation: (b) is lower-risk and matches the explicit UI-SPEC instruction — but write it down as a decision, don't leave the token gap silently unexplained.
**Warning signs:** A future applet needing a similar amber/warning treatment reinvents its own hex constants because there's no shared token to reach for.

### Pitfall 5: Two "Applet Catalog" affordances already exist in the codebase, not one
**What goes wrong:** `Dock.tsx`'s "+" tab-bar button (currently cycles `appletDefs` keys) and `Rail.tsx`'s footer "Applet Catalog" row (currently a no-op `console.log` stub, `openCatalog()`) are **two separate existing stubs**, both labeled "Applet Catalog," both explicitly deferred to "Phase 4 scope" in their own code comments. 04-UI-SPEC.md only describes replacing the Dock "+" affordance; it does not mention the Rail footer row.
**Why it happens:** Both were stubbed independently in Phase 2 without a cross-reference to each other.
**How to avoid:** The plan must explicitly decide whether one shared `<AppletCatalog>` component/picker serves both trigger points (recommended — avoids a second, inconsistent picker) or whether the Rail footer row stays a separate future concern. Don't silently ship only the Dock-side fix and leave `Rail.tsx`'s `openCatalog()` a dangling no-op without a decision recorded.
**Warning signs:** A UAT reviewer clicks the Rail's "Applet Catalog" footer row expecting Phase 4's new picker and gets nothing.

### Pitfall 6: `instanceState` per-tab slot has no garbage collection
**What goes wrong:** Phase 3's `WorkspaceRecordV1.instanceState: Record<string, unknown>` is keyed by instanceId and is currently empty/unused. Once Phase 4 (or Phase 5) starts writing into it per D-14, nothing removes an entry when its tab closes — the record can only grow.
**Why it happens:** Phase 3 deliberately left this slot inert ("EMPTY until Phase 5") and never designed its lifecycle.
**How to avoid:** Not necessarily a Phase 4 blocker (the workspace record is small JSON, growth is slow), but the plan should note this as a known, accepted gap rather than silently omitting cleanup — e.g. wire `dispose()` in `makeRenderer` to also delete `instanceState[instanceId]` when a panel closes, if that's cheap to add alongside the AI auto-cancel wiring already happening at the same seam.
**Warning signs:** `workspace.json` growing noticeably larger than the visible open-tab count would suggest, over long-running app usage.

## Code Examples

See Architecture Patterns above — all five code examples are drawn directly from this repository's existing, shipped code (`src/persistence/workspaceStore.ts`, `src/host/ai.ts`, `src/shell/Dock.tsx`, `src/shell/LayoutsMenu.tsx`) plus verified `dockview-core` type declarations (`node_modules/dockview-core/dist/esm/dockview/types.d.ts`, `dockviewComponent.d.ts`), not external/generic snippets.

## State of the Art

Not applicable in the usual sense (no library-version drift risk here — `dockview-core` is pinned exact at 2.0.0 and everything else is already locked). The one relevant "state of the art" fact is internal: Phase 7 already evolved the sidecar's session model once (Pi API drift 0.74→0.80, `getModel` moved to `@earendil-works/pi-ai/compat`) and once again to file-backed sessions (D-09 replacing `SessionManager.inMemory()`) — Phase 4 must build against the **current** (file-backed, global-mode-Set) shape, not the shape described in the original FWK-04 wording ("stubbed v1"), which CONTEXT.md's D-01 already flags as superseded.

**Deprecated/outdated:**
- FWK-04's literal "ai() (single AI seam, stubbed v1)" wording in REQUIREMENTS.md — superseded by 04-CONTEXT.md D-01 (real Pi sidecar backend). The plan should implement against D-01..D-09, not the REQUIREMENTS.md line item's literal words.
- `SessionManager.inMemory()` — no longer used anywhere in the sidecar (D-09 replaced it); do not design Phase 4's one-shot calls assuming an in-memory/ephemeral session path exists today (see Pitfall 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `parameters.api.id` in dockview's `GroupPanelPartInitParameters` equals the same full id string passed as `opts.id`/`opts.name` to `createComponent` (i.e., they don't diverge under any dockview-internal renaming) | Pattern 2 | Low — both are read from `node_modules` type declarations directly (`[VERIFIED: dockview-core types]`), but the *runtime* equality (not just type presence) was not exercised with a live test in this research pass; a plan task should assert this with a quick console.log/unit check early, not assume it silently |
| A2 | nanoid's default alphabet (`A-Za-z0-9_-`) plus an `"oneshot-"` prefix always satisfies `sidecar/src/sessions.ts`'s `SESSION_ID_PATTERN` (`^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$`) | Pattern 3 | Low-Medium — nanoid can generate a string ending or (less likely, since prefix is fixed) starting with `_`/`-`, which the regex still accepts since the pattern only requires the *first and last char* be alnum; the prefix `oneshot-` fixes the first char but the *last* char of the id is nanoid's last character, which CAN be `_` or `-` (nanoid's default alphabet includes both) — this could occasionally produce an invalid session id that the sidecar rejects. Plan should either strip trailing `_`/`-` or append a fixed alnum suffix character to guarantee validity, not assume nanoid output is always pattern-safe |
| A3 | Accepting sequential (non-parallel) AI-call execution at the sidecar (Pitfall 2) satisfies D-08's intent | Pitfall 2 | Medium — if the user's actual intent behind "concurrent" was true parallel execution (not just non-blocking submission), this assumption under-delivers; should be confirmed with the user/planner rather than silently assumed, since 04-CONTEXT.md's own wording is ambiguous between "the host API permits concurrent calls" and "calls execute in parallel" |

## Open Questions

1. **Does the Applet Catalog picker (D-18) also replace Rail.tsx's dormant `openCatalog()` footer stub, or only Dock.tsx's "+" button?**
   - What we know: 04-UI-SPEC.md only specifies the Dock "+" trigger; Rail.tsx has an independent, separately-stubbed "Applet Catalog" footer row with an identical name.
   - What's unclear: whether these should share one `<AppletCatalog>` component (recommended) or remain two separate concerns.
   - Recommendation: Planner should make this an explicit task-level decision (see Pitfall 5), defaulting to "one shared component, two trigger points" absent user pushback.

2. **Should one-shot applet AI-call session files (Pitfall 1) be cleaned up, or is unbounded accumulation acceptable for v1?**
   - What we know: every `host.ai()` call from an applet currently creates a permanent `.jsonl` file (Phase 7's file-backed-only session model).
   - What's unclear: whether this matters at MVP scale, and whether adding cleanup is in-scope for Phase 4 vs. deferred.
   - Recommendation: Accept for v1 with a `oneshot-` naming convention that makes future cleanup trivial; flag explicitly in the plan rather than leaving it implicit.

3. **Do the rich Wiki/Library demo's non-tokenized colors (amber/warm/red) get promoted into `tokens.css`, or stay as local literals?**
   - What we know: UI-SPEC says "ported verbatim... do not re-theme"; no token exists today for these roles.
   - What's unclear: whether a future real Wiki/Library applet (post-v1) would want these as shared tokens.
   - Recommendation: Keep as local literals scoped to the two rich-demo files for Phase 4 (lowest risk, matches UI-SPEC instruction); revisit if/when a third applet needs the same warning palette.

4. **Does `host.instanceId`'s cleanup (removing a closed tab's `instanceState` slot) belong in Phase 4's `dispose()` wiring, or is it out of scope until Phase 5 actually writes real per-instance data?**
   - What we know: Phase 3 left `instanceState` inert; Phase 4/5 is the first consumer.
   - What's unclear: whether adding GC now (cheap, same seam as AI auto-cancel) is worth doing preemptively vs. deferring until there's real data to clean up.
   - Recommendation: Low-cost to add now alongside D-07's `dispose()` wiring since it's the same code location; recommend including it, but not a hard requirement.

## Environment Availability

No new external dependencies. All required infrastructure (Tauri 2 window/IPC, Node sidecar process, `tauri-plugin-store`, `dockview-core`) is already running and verified in Phases 1-3 and 7. The one runtime dependency relevant to any applet's `host.ai()` call — the Node sidecar process (`SidecarProcess::spawn()` in `src-tauri/src/lib.rs`) — already degrades honestly (D-06, Phase 7) if unavailable, and Phase 4's promise wrapper inherits that behavior by construction (rejects the promise) rather than needing its own fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 + `@testing-library/react` ^16.3.2 + jsdom ^29.1.1 |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run src/shell/PanelBody.test.tsx` (or the relevant new test file, once created) |
| Full suite command | `npm test` (vitest, all files) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FWK-01 | Registry maps key → `{manifest, App}`; manifest shape validated | unit | `npx vitest run src/shell/registry.test.ts` | ❌ Wave 0 |
| FWK-02 | Registering a key replaces its stub; a new key appends to `railOrder` | unit/integration | `npx vitest run src/shell/registry.test.ts` (registry replacement) + `npx vitest run src/store/shellStore.test.ts` (D-19 append, extend existing file) | Partial — `shellStore.test.ts` exists, needs new cases |
| FWK-03 | Every unregistered key renders the templated stub with DEMO chip; Wiki/Library render the rich stub | component | `npx vitest run src/shell/PanelBody.test.tsx` (new) | ❌ Wave 0 |
| FWK-04 (storage) | `host.storage.get/set/remove` round-trips via mocked `LazyStore`, namespaced correctly | unit | `npx vitest run src/host/storage.test.ts` | ❌ Wave 0 |
| FWK-04 (ai) | `aiComplete()` resolves on `done`, rejects on `error`, forwards `onDelta`, generates a valid throwaway sessionId | unit | `npx vitest run src/host/aiComplete.test.ts` | ❌ Wave 0 |
| FWK-04 (open) | `hostOpen()` focuses an existing panel instead of creating a duplicate (D-17) | unit | `npx vitest run src/host/open.test.ts` | ❌ Wave 0 |
| FWK-04 (instanceId/theme) | `makeHost(instanceId)` assembles all five members correctly | unit | `npx vitest run src/host/index.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant new/changed test file (`npx vitest run <file>`)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/shell/registry.test.ts` — covers FWK-01/FWK-02 (registry shape + replacement semantics)
- [ ] `src/shell/PanelBody.test.tsx` — covers FWK-03 (stub rendering, DEMO chip, unknown-key fallback continues to work)
- [ ] `src/host/storage.test.ts`, `src/host/aiComplete.test.ts`, `src/host/open.test.ts`, `src/host/index.test.ts` — cover FWK-04's four host members
- [ ] Extend existing `src/store/shellStore.test.ts` with a D-19 "new key appends to railOrder" case rather than creating a new file (mirrors how `shellStore.test.ts` already mocks `workspaceStore`)
- Framework install: none — Vitest/jsdom/@testing-library/react already present and already used by 10 existing test files in this repo.

## Sources

### Primary (HIGH confidence — direct repository inspection)
- `D:\Vibe Coding\Sourcerer\.planning\phases\04-applet-framework\04-CONTEXT.md` — locked decisions D-01..D-19
- `D:\Vibe Coding\Sourcerer\.planning\phases\04-applet-framework\04-UI-SPEC.md` — visual/copy contract
- `D:\Vibe Coding\Sourcerer\src\shell\appletDefs.ts`, `PanelBody.tsx`, `Dock.tsx`, `Rail.tsx`, `LayoutsMenu.tsx` — existing seams
- `D:\Vibe Coding\Sourcerer\src\store\shellStore.ts`, `src\persistence\workspaceStore.ts` — persistence/store patterns
- `D:\Vibe Coding\Sourcerer\src\host\ai.ts` — Phase 7's low-level AI client (the module Phase 4 must compose over, not replace)
- `D:\Vibe Coding\Sourcerer\src-tauri\src\lib.rs`, `src-tauri\src\commands\ai.rs` — Rust command surface, plugin registration
- `D:\Vibe Coding\Sourcerer\sidecar\src\index.ts`, `modes.ts`, `sessions.ts`, `protocol.ts` — sidecar session/mode architecture (source of Pitfalls 1-3)
- `D:\Vibe Coding\Sourcerer\node_modules\dockview-core\dist\esm\dockview\types.d.ts`, `dockviewComponent.d.ts`, `dist\esm\api\panelApi.d.ts` — verified dockview API surface (`setActivePanel`, `panels`, `GroupPanelPartInitParameters`)
- `D:\Vibe Coding\Sourcerer\package.json` — installed dependency versions
- `D:\Vibe Coding\Sourcerer\Design sync setup guide\design_handoff_sourcerer_tauri\reference\applets\README.md`, `_TemplateApplet.js`, `registry.js` — the original authoritative module-contract reference
- `D:\Vibe Coding\Sourcerer\NEW Design sync setup guide\design_handoff_bespoke_rails_shell\wiki.js`, `library.js`, `store.js` — rich demo ports to adapt
- `D:\Vibe Coding\Sourcerer\src\styles\tokens.css` — current token set (source of Pitfall 4)
- `.claude/skills/spike-findings-sourcerer/SKILL.md` — harness constraints (lean prompt, tool-schema cost)
- `D:\Vibe Coding\Sourcerer\.planning\phases\07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a\07-CONTEXT.md` — Phase 7 decisions D-01..D-10

### Secondary (MEDIUM confidence)
None required — no WebSearch/external lookups were needed for this phase; every claim traces to a file read directly in this repository.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, versions read directly from `package.json`
- Architecture: HIGH — every pattern verified against actual shipped code and `dockview-core`'s own `.d.ts` files, not memory
- Pitfalls: HIGH — all six pitfalls trace to specific lines of already-written code (sidecar session/mode model, tokens.css gaps, duplicate stub affordances), not speculation

**Research date:** 2026-07-10
**Valid until:** Stable until the next phase touching `src/host/`, `sidecar/`, or `dockview-core` version — no external time-decay risk since nothing here depends on an evolving external ecosystem.
