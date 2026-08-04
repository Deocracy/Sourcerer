# Phase 07: Assistant Harness Core - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 13 (new/modified, extracted from CONTEXT.md D-01..D-10, DISCUSSION-LOG.md, and the spike-findings skill's build-out list)
**Analogs found:** 2 / 13 (weak/partial) — **this phase is almost entirely greenfield.**

## Codebase Reality Check (read this first)

The repo currently contains **only Phase 1's chrome**: `src/shell/{TitleBar,WindowControls,LogoCluster}.tsx`, `src/app/AppShell.tsx`, `src/fonts.ts`, `src/styles/tokens.css`, and a bare `src-tauri/` scaffold (`Cargo.toml` has only `tauri`, `tauri-plugin-opener`, `serde`/`serde_json`; `lib.rs` registers zero commands; `main.rs` is the stock entrypoint). Confirmed via direct file listing:

- No `#[tauri::command]` exists anywhere in `src-tauri/src/` — no Rust command layer to imitate, no existing `ai_complete`/`host.ai()` proxy.
- No `invoke(...)` call exists anywhere in `src/` — no frontend IPC pattern to imitate yet.
- No applet registry, no rail, no Zustand store, no dockview wiring in `src/` (Phase 2/6 work referenced in project memory has not landed in this tree as of this mapping).
- `package.json` has no `zustand`, no `@tauri-apps/plugin-store`, no Node sidecar tooling, no `@earendil-works/pi-*` packages.

**Consequence for the planner:** for the Rust command layer, the Node sidecar, the mode registry, the Pi embed, the Databasise tool adapter, and the streaming Channel wiring, there is **no in-repo analog** — use the spike-findings reference docs (quoted below) as the primary source of copy-ready code, not a codebase file. The only real in-repo analogs are for (a) Tauri capability/permission declarations and (b) component/test file conventions for the minimal rail chat panel's shell-level styling and IPC-mock test pattern.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/commands/ai.rs` (or similar — the `host_ai` Tauri command) | controller (Tauri command) | streaming (Channel) | *(none in-repo)* | no analog — see spike ref |
| `src-tauri/src/sidecar.rs` (Node process spawn/own) | service (process manager) | event-driven | *(none in-repo)* | no analog — see spike ref |
| `src-tauri/src/lib.rs` (register `host_ai` command + sidecar startup hook) | config/bootstrap | request-response | `src-tauri/src/lib.rs` (itself, current stub) | exact (file being extended, not replaced) |
| `src-tauri/capabilities/default.json` (add IPC/channel permissions for the new command) | config | n/a | `src-tauri/capabilities/default.json` (existing) | exact — extend, same pattern |
| `sidecar/src/index.ts` (or `assistant/index.ts` — Node entrypoint, Pi embed) | service | streaming | *(none in-repo)* | no analog — see `harness-embedding.md` |
| `sidecar/src/modes.ts` (mode registry + active-key Set + `setModes()`) | service/config | event-driven | *(none in-repo)* | no analog — see `harness-embedding.md` §2-3 |
| `sidecar/src/tools/databasise.ts` (auto-generate Pi tools from `/openapi.json`) | service (tool adapter) | request-response | *(none in-repo)* | no analog — see `databasise-tools.md` |
| `sidecar/src/sessions.ts` (file-backed `SessionManager`, JSONL per conversation) | service (persistence) | file-I/O | *(none in-repo)* | no analog — see spike parked-007 note in CONTEXT.md D-09 |
| `sidecar/.env` | config | n/a | *(none in-repo — first `.env` in the project)* | no analog |
| `src/host/ai.ts` (typed `host.ai()` wrapper around `invoke` + `Channel`) | utility (host API seam) | streaming | *(none in-repo)* | no analog — must be authored fresh per CLAUDE.md "host.ai() is the only AI seam" |
| `src/assistant/AssistantPanel.tsx` (minimal rail chat: composer + message list) | component | streaming | `src/shell/TitleBar.tsx` / `src/app/AppShell.tsx` | role-match only (both are shell-level React components with CSS Modules) — no chat/streaming analog exists |
| `src/assistant/AssistantPanel.module.css` | config (styles) | n/a | `src/shell/TitleBar.module.css`, `src/styles/tokens.css` | role-match — token/CSS-module convention transfers directly |
| `src/assistant/AssistantPanel.test.tsx` (IPC-mock test for streamed replies) | test | event-driven | `src/shell/WindowControls.test.tsx` | role-match — IPC-mock test harness pattern transfers directly |

## Pattern Assignments

### `src-tauri/capabilities/default.json` (config)

**Analog:** itself (existing file, extend don't replace) — `D:\Vibe Coding\Sourcerer\src-tauri\capabilities\default.json`

Current full contents (14 lines):
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "opener:default"
  ]
}
```
**Pattern to copy:** append new permission strings to the existing `permissions` array in the same flat-string style (e.g. whatever permission identifier the new `host_ai` custom command requires — custom Tauri commands registered via `invoke_handler` don't need a capability entry unless they touch a plugin; if a Store/FS plugin is added for session persistence, its `plugin-name:default` string goes here following this exact convention).

### `src-tauri/src/lib.rs` (bootstrap)

**Analog:** itself — `D:\Vibe Coding\Sourcerer\src-tauri\src\lib.rs`

Full current contents (8 lines):
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
**Pattern to copy:** this is the ONLY place commands get registered project-wide — the planner's Rust plan must add `.invoke_handler(tauri::generate_handler![host_ai, ...])` and a sidecar-spawn call (e.g. inside `.setup(|app| {...})`) to this exact `Builder` chain. There is no existing `invoke_handler` call anywhere to pattern-match against — the spike-findings skill and Tauri 2 official docs (`Calling Rust from the Frontend`, cited in CONTEXT.md canonical_refs) are the primary source for the command-registration shape, not this codebase.

### `sidecar/*` (Node Pi embed, mode registry, Databasise tool adapter, sessions) — NO CODEBASE ANALOG

**Source of truth:** `.claude/skills/spike-findings-sourcerer/references/harness-embedding.md`, `.claude/skills/spike-findings-sourcerer/references/databasise-tools.md` (both already fully read into this mapping; excerpts below are copy-ready per CONTEXT.md D-02/D-03/D-10).

**Pi embed core pattern** (`harness-embedding.md` lines 21-42):
```js
import { createAgentSession, DefaultResourceLoader, SessionManager, defineTool } from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

const agentDir = path.join(cwd, ".pi-agent");
const resourceLoader = new DefaultResourceLoader({
  cwd, agentDir,
  systemPrompt: composePrompt(),
  noExtensions: true, noSkills: true, noPromptTemplates: true,
  noThemes: true, noContextFiles: true,   // kills CLAUDE.md/AGENTS.md auto-inject
});

const { session } = await createAgentSession({
  cwd, agentDir,
  model: getModel("cerebras", "gpt-oss-120b"),
  noTools: "builtin",
  customTools: [ ...allModeTools ],
  sessionManager: SessionManager.inMemory(),   // D-09: swap for file-backed variant
  resourceLoader,
});
session.setActiveToolsByName(activeToolNames());
```
**Landmine (must honor in plan):** `systemPrompt`/`noContextFiles` MUST route through `DefaultResourceLoader`, not bare `createAgentSession` options — silently ignored otherwise (spike 005). `noTools: "all"` kills `customTools` too — use `noTools: "builtin"`.

**Mode registry pattern** (`harness-embedding.md` lines 44-66, D-02):
```js
const MODES = {
  notes:    { label: "Notes",    prompt: "...", tools: ["save_note","list_notes"] },
  research: { label: "Research", prompt: "...", tools: ["wiki_resolve","kb_query"] },
  coding:   { label: "Coding",   prompt: "...", tools: ["read","grep"] },
};
const active = new Set(["research"]);   // Phase 7: research is the one live mode
const composePrompt   = () => [BASE_PROMPT, ...[...active].map(k => MODES[k].prompt), `Today: ${today}`].join("\n\n");
const activeToolNames = () => [...active].flatMap(k => MODES[k].tools);

async function setModes(keys) {
  active.clear(); for (const k of keys) if (MODES[k]) active.add(k);
  await session.reload();                          // 1. reload FIRST
  session.setActiveToolsByName(activeToolNames());  // 2. THEN narrow tools
}
```
Register `notes`/`coding`/`memory` entries with empty `tools: []` per D-04 (empty seam, not omitted keys) so the toggle plumbing is real even though unwired.

**Databasise tool adapter pattern** (`databasise-tools.md` lines 22-58, D-03):
```js
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const DB_BASE = "http://127.0.0.1:9621";
const spec = await (await fetch(`${DB_BASE}/openapi.json`)).json();

function toolFromOp(name, method, apiPath) {
  const op = spec.paths[apiPath]?.[method];
  const props = {}, bodyProps = new Set();
  for (const p of op.parameters || []) if (p.in === "query") props[p.name] = paramSchemaToTypebox(p);
  const ref = op.requestBody?.content?.["application/json"]?.schema;
  const bodySchema = ref?.$ref ? spec.components.schemas[ref.$ref.split("/").pop()] : ref;
  for (const [k, v] of Object.entries(bodySchema?.properties || {})) {
    if (k === "query" || k === "mode") {
      bodyProps.add(k);
      const base = Type.String({ description: (v.description||"").slice(0,200) });
      props[k] = bodySchema.required?.includes(k) ? base : Type.Optional(base);
    }
  }
  return defineTool({
    name, label: name,
    description: `${op.summary || apiPath} (Databasise ${method.toUpperCase()} ${apiPath})`.slice(0,300),
    parameters: Type.Object(props),
    async execute(_id, params) {
      const qp = new URLSearchParams(), body = {};
      for (const [k, v] of Object.entries(params||{})) {
        if (v === undefined) continue;
        if (bodyProps.has(k)) body[k] = v; else qp.set(k, String(v));
      }
      const url = `${DB_BASE}${apiPath}${qp.size ? "?"+qp : ""}`;
      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers: { "content-type": "application/json" },
        body: bodyProps.size && Object.keys(body).length ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(240000),
      });
      const text = await res.text();
      return { content: [{ type: "text", text: `HTTP ${res.status}\n${text.slice(0,4000)}` }] };
    },
  });
}
```
Whitelist: `POST /wiki/resolve` (query `canonical_id`,`as_of`) → `wiki_resolve`; `GET /wiki/unresolved` → `wiki_unresolved`; `GET /wiki/unplaced` → `wiki_unplaced`; `POST /query` (body `query`,`mode`) → `kb_query`. Per D-06, wrap the initial `fetch` and every tool `execute` in a try/catch that returns an honest "wiki unavailable" text result rather than throwing — Databasise is assume-running, not managed.

**Session persistence (D-09, file-backed, folds parked spike 007):** no existing code pattern in either the codebase or spike references (spike 007 was parked, not run) — swap `SessionManager.inMemory()` for a JSONL-file-backed implementation; the planner should treat this as a small custom `SessionManager`-shaped class (list files in a session dir on boot, append turns to the active session's `.jsonl`, load on session switch), not a library.

**Error handling / degrade pattern (D-06):** no codebase precedent — establish the honest-failure convention fresh in the Databasise tool adapter (see `execute()` above) and propagate the same "backend unreachable, plain chat continues" contract up through `host.ai()` so the assistant panel never hard-fails a turn because a tool call failed.

### `src/host/ai.ts` (host.ai() seam, Channel-based streaming) — NO CODEBASE ANALOG

No `invoke()` call and no `Channel` usage exists anywhere in `src/` today. CLAUDE.md constraint: "Applets never bypass the `host` API; `host.ai()` is the only AI seam" — this file is the first real implementation of that contract (Phase 1-6 only referenced it conceptually). Author it against Tauri 2's official Channel API (`@tauri-apps/api/core` `Channel` class) per the canonical ref in CONTEXT.md (`Calling Rust from the Frontend` / `Calling the Frontend from Rust` docs) — there is no in-repo pattern to imitate; do not invent one from `WindowControls.tsx`'s plain `invoke()`-only call shape (window control commands are fire-and-forget, not streaming, so they are not a good template for the Channel wiring, only for the `invoke` import path).

**What IS reusable from `WindowControls.tsx`-style code:** the plain `invoke` import path, e.g.
```ts
import { invoke } from "@tauri-apps/api/core";
```
(inferred from `WindowControls.test.tsx`'s `mockIPC`/`mockWindows` usage of `@tauri-apps/api/mocks`, which mirrors `@tauri-apps/api/core`'s real API — see below).

### `src/assistant/AssistantPanel.tsx` + `.module.css` (component, styles)

**Analog:** `src/shell/TitleBar.tsx` (`D:\Vibe Coding\Sourcerer\src\shell\TitleBar.tsx`, role-match only — plain functional component + CSS Module, no chat-specific logic to borrow) and `src/styles/tokens.css` (design tokens — reuse `var(--...)` custom properties for all colors/spacing/type per CLAUDE.md's "0 border-radius inside," IBM Plex, green accent `#86A38C` constraints).

**Core component pattern to copy** (`src/shell/TitleBar.tsx` full file, 21 lines):
```tsx
import { LogoCluster } from "./LogoCluster";
import { WindowControls } from "./WindowControls";
import styles from "./TitleBar.module.css";

export function TitleBar() {
  return (
    <div className={styles.titleBar}>
      <LogoCluster />
      <div className={styles.spacer} data-tauri-drag-region />
      <WindowControls />
    </div>
  );
}
```
Copy the shape: plain function component, named export, `styles` from a co-located `.module.css`, no state library dependency (there is none in the repo yet) — for the message list/composer, local `useState`/`useEffect` is the only available state mechanism (no Zustand store exists to hook into for chat state as of this mapping; the planner may choose to keep AssistantPanel's chat state local per CONTEXT.md's "Claude's Discretion: minimal rail chat UI shape").

### `src/assistant/AssistantPanel.test.tsx` (test)

**Analog:** `src/shell/WindowControls.test.tsx` (`D:\Vibe Coding\Sourcerer\src\shell\WindowControls.test.tsx`, exact IPC-mock harness match)

**IPC-mock test pattern to copy** (lines 1-29):
```tsx
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { mockIPC, mockWindows, clearMocks } from "@tauri-apps/api/mocks";

import { WindowControls } from "./WindowControls";

function captureIpc(): string[] {
  const commands: string[] = [];
  mockWindows("main");
  mockIPC((cmd) => {
    commands.push(cmd);
    return undefined;
  });
  return commands;
}

beforeEach(() => {
  clearMocks();
});

afterEach(() => {
  cleanup();
  clearMocks();
});
```
And the assertion pattern (lines 31-58) — `render(...)`, `fireEvent`, `waitFor(() => expect(commands.some(c => c.includes(...))).toBe(true))`. For `AssistantPanel.test.tsx`, the `mockIPC` handler will need to return a value/stream shape simulating the `host_ai` Channel response rather than `undefined` — Tauri 2's `mockIPC` supports returning arbitrary payloads per command name; consult the official mocks docs since no existing test in this repo mocks a Channel-based (streaming) command.

## Shared Patterns

### CSS Modules + design tokens
**Source:** `src/styles/tokens.css`, `src/shell/TitleBar.module.css`
**Apply to:** `AssistantPanel.module.css` and any other new UI file this phase
Use `var(--...)` tokens exclusively; no hardcoded hex/px values, per CLAUDE.md's pixel-fidelity constraint (green accent `#86A38C`/hover `#A3BCA8`, 0 border-radius inside, IBM Plex scale).

### Tauri capability additions
**Source:** `src-tauri/capabilities/default.json`
**Apply to:** any new Tauri permission needed by the sidecar-spawn or session-persistence plugin (if a Store/FS plugin is added for D-09)
Append flat permission-identifier strings to the existing `permissions` array; don't create a second capability file for one window.

### IPC/Channel mock testing
**Source:** `src/shell/WindowControls.test.tsx`
**Apply to:** `AssistantPanel.test.tsx` and any test touching `host.ai()`
Reuse `mockIPC`/`mockWindows`/`clearMocks` from `@tauri-apps/api/mocks`; extend the pattern for streamed/Channel responses since no existing test covers that shape.

### Honest-degrade error contract (D-06)
**Source:** spike-findings `databasise-tools.md` (no codebase precedent)
**Apply to:** Databasise tool adapter `execute()`, the `host_ai` Rust command, and `AssistantPanel`'s turn-handling — every layer must treat "Databasise unreachable" as a normal text result, never an unhandled throw that kills the chat turn.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src-tauri/src/commands/ai.rs` (`host_ai` Tauri command) | controller | streaming | No Rust command exists in the repo at all; use Tauri 2 official Channel-command docs + spike findings |
| `src-tauri/src/sidecar.rs` (Node process spawn/own) | service | event-driven | No process-spawning code exists in `src-tauri/`; author fresh per CONTEXT.md discretion ("spawn `node` from Rust on startup is fine") |
| `sidecar/src/index.ts`, `modes.ts`, `tools/databasise.ts`, `sessions.ts` | service | streaming / event-driven / request-response / file-I/O | First Node runtime and first Pi embed in the project; spike-findings reference docs are the sole source of proven code (already excerpted above) |
| `sidecar/.env` | config | n/a | First `.env` file in the project (D-08) |
| `src/host/ai.ts` | utility | streaming | `host.ai()` seam has never been implemented, only referenced conceptually in CLAUDE.md/UI-SPEC docs |

## Metadata

**Analog search scope:** `src/`, `src-tauri/src/`, `src-tauri/capabilities/`, `package.json`, `src-tauri/Cargo.toml` (full repo tree at time of mapping — confirmed via direct `find`/Read, not assumed from memory)
**Files scanned:** 13 source files + 2 config files (repo currently has no `sidecar/`, `assistant/`, or `host/` directories at all)
**Pattern extraction date:** 2026-07-07
**Primary non-codebase sources used (spike-findings skill, fully read):** `harness-embedding.md`, `databasise-tools.md`, `omp-components.md` (memory/mnemopi excerpted for planner awareness only — out of scope this phase per D-05)
