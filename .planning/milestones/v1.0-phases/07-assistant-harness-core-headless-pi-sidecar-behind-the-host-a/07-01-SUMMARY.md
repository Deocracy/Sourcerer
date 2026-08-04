---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
plan: 01
subsystem: ai
tags: [pi-coding-agent, node, typescript, cerebras, mode-registry, stdio-protocol]

# Dependency graph
requires: []
provides:
  - "sidecar/ Node package embedding @earendil-works/pi-coding-agent headless"
  - "Lean D-10 baseline prompt (~135 tok) via DefaultResourceLoader (noContextFiles:true)"
  - "Mode registry (D-02/D-04): research live, notes/coding/memory empty seam"
  - "Newline-delimited JSON stdio protocol (protocol.ts) shared with 07-03/07-04"
  - "buildSession() export for test/future-plan reuse without a live turn"
affects: [07-02, 07-03, 07-04]

# Tech tracking
tech-stack:
  added:
    - "@earendil-works/pi-coding-agent ^0.80.3"
    - "@earendil-works/pi-ai ^0.80.3"
    - "typebox ^1.1.38 (bare-name TypeBox package, sinclairzx81, resolved via pi-ai)"
    - "Node --experimental-strip-types (runs .ts sources directly, no build step)"
  patterns:
    - "DefaultResourceLoader must be explicitly reload()-ed before passing to createAgentSession when caller-constructed (not the SDK's implicit internal loader path)"
    - "Mode toggle: session.reload() BEFORE session.setActiveToolsByName() (spike 003 order gate)"
    - "modes.ts binds to the session via bindSession() rather than importing index.ts, avoiding a circular import"

key-files:
  created:
    - sidecar/package.json
    - sidecar/tsconfig.json
    - sidecar/.env.example
    - sidecar/.gitignore
    - sidecar/src/protocol.ts
    - sidecar/src/modes.ts
    - sidecar/src/index.ts
    - sidecar/test/harness.test.mjs
  modified: []

key-decisions:
  - "Task 1 packages approved by orchestrator pre-execution: @earendil-works/pi-coding-agent ^0.80.3, @earendil-works/pi-ai ^0.80.3 (current npm latest; spike docs cited ^0.74.2 as the version tested), and typebox ^1.1.38 (bare name, not @sinclair/typebox) since pi-ai already depends on and re-exports the bare `typebox` package from the same author (sinclairzx81) and the spike source literally imports `from \"typebox\"`."
  - "getModel/pi-ai API drift since spikes (0.74.2 -> 0.80.3): top-level `@earendil-works/pi-ai` no longer exports `getModel` (only `createModels()`/`Models.getModel()`). Used the documented `@earendil-works/pi-ai/compat` deprecated-but-functional subpath export instead, matching the JSDoc example still embedded in pi-coding-agent's sdk.d.ts."
  - "Runtime executes TypeScript sources directly via `node --experimental-strip-types` (Node 22.13 does not strip types unflagged); tsconfig.json is type-check-only (noEmit:true, allowImportingTsExtensions:true) rather than a build step producing dist/."

requirements-completed: [D-02, D-04, D-08, D-10]

# Metrics
duration: ~70min
completed: 2026-07-08
---

# Phase 07 Plan 01: Headless Pi Sidecar Scaffold Summary

**Node sidecar embedding Pi (`@earendil-works/pi-coding-agent` 0.80.3) headless behind a lean ~135-token DefaultResourceLoader-routed prompt, with a live research-mode tool-gating seam and an NDJSON stdio protocol streaming text_delta/done events.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 4 (Task 1 checkpoint pre-approved by orchestrator; Tasks 2-4 executed)
- **Files modified:** 9 (8 created + package-lock.json)

## Accomplishments
- `sidecar/` scaffolded as a private ES-module Node package with the three human-approved dependencies pinned exactly.
- Headless Pi embed (`buildSession()` in `src/index.ts`) proven to compose a **540-character (~135 token) lean prompt** through `DefaultResourceLoader` with `noContextFiles:true` — confirmed empirically to contain zero trace of the repo's CLAUDE.md content, versus Pi's own out-of-box default template (~1663 chars) when the resource loader isn't reloaded.
- Mode registry (`src/modes.ts`) with all four D-02/D-04 modes real (research live with its 4 D-03 tool names; notes/coding/memory as a genuine empty-tool seam), toggling `activeToolNames()` deterministically via `setModes()` with the reload-before-narrow order gate verified against a real session (not just a mock).
- NDJSON stdio protocol (`src/protocol.ts`) matching the plan's canonical `<interfaces>` contract exactly, with a defensive line reader that never throws on malformed input and a round-trip-safe `writeEvent`/`readRequests` pair (embedded newlines survive JSON escaping).
- `test/harness.test.mjs`: 6 offline assertions, all green with `CEREBRAS_API_KEY=dummy` (no network) — the automated gate the plan flagged as missing (Nyquist).

## Task Commits

1. **Task 1: Package legitimacy gate** — pre-approved by orchestrator before this executor ran (see Key Decisions / User Setup below); no code commit for this task.
2. **Task 2 + 3: Scaffold sidecar + headless embed + mode registry** - `97d4cb1` (feat) — delivered together because `index.ts` and `modes.ts` are mutually dependent at first boot (index.ts imports composePrompt/activeToolNames/setModes/bindSession from modes.ts; splitting into two commits would leave an intermediate non-compiling state).
3. **Task 4: Harness test scaffold** - `a86fc68` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `sidecar/package.json` - private ESM package, pins `@earendil-works/pi-coding-agent@^0.80.3`, `@earendil-works/pi-ai@^0.80.3`, `typebox@^1.1.38`; `start`/`test` scripts pass `--experimental-strip-types`
- `sidecar/tsconfig.json` - NodeNext, strict, type-check-only (`noEmit:true`, `allowImportingTsExtensions:true`) since runtime executes `.ts` sources directly
- `sidecar/.env.example` - documents `CEREBRAS_API_KEY`, `PI_PROVIDER=cerebras`, `PI_MODEL=gpt-oss-120b` (D-08)
- `sidecar/.gitignore` - excludes `node_modules/`, `.env`, `.pi-agent/`, `dist/`, `sessions/`
- `sidecar/src/protocol.ts` - canonical request/event TS types, `writeEvent()`, defensive `readRequests()` async generator
- `sidecar/src/modes.ts` - `MODES` registry (research/notes/coding/memory), `composePrompt()`, `activeToolNames()`, `bindSession()`, `setModes()` with reload-before-narrow ordering; `allModeTools` empty placeholder for 07-02
- `sidecar/src/index.ts` - `buildSession()` (DefaultResourceLoader + createAgentSession headless embed), stdio loop (`main()`), Pi `AgentSessionEvent` → protocol event mapping, per-turn try/catch → `error`+`done`
- `sidecar/test/harness.test.mjs` - 6 offline assertions (prompt-lean, mode registry shape, active-set seed, toggle behavior, protocol round-trip, malformed-input resilience)

## Decisions Made
- **Task 1 packages (human-approved by orchestrator, recorded here per instruction):** `@earendil-works/pi-coding-agent` pinned `^0.80.3`, `@earendil-works/pi-ai` pinned `^0.80.3` (current npm latest at execution time; spike docs referenced `^0.74.2`, the version originally spiked against — legitimacy and publisher unchanged, `earendil-works` org, MIT, github.com/earendil-works/pi). TypeBox: resolved to the bare-name `typebox` package (v1.1.38, author sinclairzx81) rather than `@sinclair/typebox`, because `@earendil-works/pi-ai`'s own `package.json` already depends on `typebox@1.1.38` and the spike source's `from "typebox"` import matches this package directly — pinning it explicitly (rather than relying on hoisting) for reproducibility. None are the dead `@mariozechner/*` scope.
- **API drift handling:** `getModel` is no longer exported from the top-level `@earendil-works/pi-ai` entry point in 0.80.3 (replaced by `createModels()` / `Models.getModel()` for new code). Used `@earendil-works/pi-ai/compat`'s deprecated-but-still-functional `getModel` re-export instead — it is the exact function the pi-coding-agent SDK's own JSDoc example still references, and it resolves `cerebras/gpt-oss-120b` correctly (verified at the shell before writing any TS).
- **DefaultResourceLoader must be explicitly `reload()`-ed** when the caller constructs and passes its own instance (unlike the SDK's default internal path, which calls `reload()` for you). This was not called out in the spike docs and surfaced only via runtime inspection of `sdk.js`/`resource-loader.js` — without it, `getSystemPrompt()` stays `undefined` and the session silently falls back to Pi's out-of-box "expert coding assistant" template, defeating D-10 entirely. This is the single most important landmine this plan found beyond what the spikes documented.
- **Runtime TS execution via `--experimental-strip-types`** rather than a compiled `dist/` build step, since Node 22.13 (the installed version) requires the explicit flag for `.ts` file extensions. `tsconfig.json` is retained as a type-check-only artifact (`npx tsc --noEmit`), not a build pipeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@earendil-works/pi-ai` no longer exports `getModel` at its top-level entry (API drift 0.74.2 -> 0.80.3)**
- **Found during:** Task 2 (headless embed construction)
- **Issue:** The plan/spike docs' example `import { getModel } from "@earendil-works/pi-ai"` throws `undefined is not a function` against the installed 0.80.3 package — the function moved behind the deprecated `/compat` subpath as the package migrates to a `createModels()`-based API.
- **Fix:** Import `getModel` (and `KnownProvider`) from `@earendil-works/pi-ai/compat` instead. Verified at the shell that `getModel("cerebras","gpt-oss-120b")` still resolves correctly (api: `openai-completions`, matches the spike's documented baseline).
- **Files modified:** sidecar/src/index.ts
- **Verification:** `node --experimental-strip-types -e "..."` shell probe confirmed model resolution before writing the TS import; `npx tsc --noEmit` passes.
- **Committed in:** 97d4cb1 (Task 2/3 commit)

**2. [Rule 1 - Bug] `DefaultResourceLoader` silently never applied `systemPromptOverride` because it wasn't `reload()`-ed**
- **Found during:** Task 2 (verifying the D-10 lean-prompt acceptance criterion)
- **Issue:** The composed session's `systemPrompt` was Pi's out-of-box ~1663-char "expert coding assistant" template, not the intended ~135-token lean prompt — `createAgentSession` only calls `resourceLoader.reload()` on a loader it constructs internally, not on a caller-supplied instance (confirmed by reading `sdk.js`/`resource-loader.js` source directly).
- **Fix:** Added an explicit `await resourceLoader.reload();` in `buildSession()` before `createAgentSession()`, matching the SDK's own "Full control" JSDoc example (which the spike excerpts omitted).
- **Files modified:** sidecar/src/index.ts
- **Verification:** Re-ran the shell probe; composed prompt is now 540 chars (~135 tok), contains the research-mode fragment and no CLAUDE.md text; codified as the first `harness.test.mjs` assertion.
- **Committed in:** 97d4cb1 (Task 2/3 commit)

**3. [Rule 3 - Blocking] Node 22.13 requires `--experimental-strip-types` to execute `.ts` files directly (no unflagged type stripping at this Node version)**
- **Found during:** Task 2 (first attempt to run `node --test test/harness.test.mjs` per the plan's literal verify command)
- **Issue:** Plain `node --test test/harness.test.mjs` (and even a trivial `node foo.ts`) throws `ERR_UNKNOWN_FILE_EXTENSION` for `.ts` on this environment's Node v22.13.1 — unflagged TS execution requires a later Node line.
- **Fix:** Added `--experimental-strip-types` to both the `start` and `test` npm scripts; the plan's literal automated verify commands (`node --test test/harness.test.mjs`) should be read as `npm test` / `node --experimental-strip-types --test test/harness.test.mjs` in this environment. `tsconfig.json` set to `noEmit:true` + `allowImportingTsExtensions:true` (type-check only, matching the fact there is no separate compiled-JS runtime path).
- **Files modified:** sidecar/package.json, sidecar/tsconfig.json
- **Verification:** `CEREBRAS_API_KEY=dummy npm test` — 6/6 pass.
- **Committed in:** 97d4cb1 (Task 2/3 commit), a86fc68 (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking/Rule 3, 1 bug/Rule 1)
**Impact on plan:** All three were necessary for the sidecar to actually boot and satisfy D-10's lean-prompt requirement (deviation #2 in particular — without it, the whole point of the plan would have silently failed while looking like it worked, since the session still boots and streams fine with the wrong, much larger prompt). No scope creep; Databasise tool definitions and file-backed sessions remain untouched, deferred to 07-02 exactly as scoped.

## Issues Encountered
- npm printed `EBADENGINE` warnings for both `@earendil-works/pi-ai@0.80.3` and `@earendil-works/pi-coding-agent@0.80.3` (declared `engines.node: >=22.19.0`, installed Node is `22.13.1`). Install and all runtime/test behavior succeeded despite the warning — no functional issue observed in this plan's scope. Flagging for awareness in case a later plan (07-02/07-03) hits an engine-gated code path; not treated as a blocker here since everything tested green.

## User Setup Required

None new required to complete this plan (Tasks 2-4 verify with `CEREBRAS_API_KEY=dummy`, no live key needed). Per the plan's `user_setup` block, a **real** `CEREBRAS_API_KEY` in `sidecar/.env` (copied from Databasise's `runtime/.env` `LLM_BINDING_API_KEY`, or the Cerebras dashboard) is still needed before any *live* streamed turn can be exercised — that's expected to happen in a later plan (07-04, wiring the rail chat panel) or when a human wants to manually smoke-test `node sidecar/src/index.ts` end-to-end with a real key.

## Next Phase Readiness
- `buildSession()`, `composePrompt()`/`activeToolNames()`/`setModes()`, and the NDJSON protocol types are all stable, tested exports ready for 07-02 (Databasise tool definitions + file-backed sessions) to build on without touching this plan's files beyond `allModeTools` and the `SessionManager.inMemory()` swap.
- The stdio `<interfaces>` contract (protocol.ts) is locked and matches the plan's canonical spec exactly — 07-03 (Rust relay) and 07-04 (frontend Channel types) can code against it without drift.
- No blockers. One open item worth a proactive glance in 07-02/07-03: the pi packages' `engines.node >=22.19.0` requirement versus this machine's installed `22.13.1` — currently a non-blocking npm warning, but worth a quick Node upgrade check if a future plan hits an engine-gated runtime feature.

---
*Phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a*
*Completed: 2026-07-08*
