# Research Synthesis: Sourcerer v4.0

**Researched:** 2026-08-19
**Synthesized from:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Confidence:** HIGH (all layers validated against live primary sources)

## Executive Summary

Sourcerer v4.0 is technically well-scoped and achievable with existing, proven patterns. The product is a branded Firefox-ESR fork hosting an Eclipse Theia IDE sidecar as the sole GUI — no custom chrome, no tab strip, no Electron fallback. The technology stack (Firefox ESR 153.1.0, Theia v1.74.1, Node 22.x, Yarn Classic) is current, upstream is actively maintained, and every major architectural decision has real-world precedent in comparable products (Zen, Floorp, code-server, VS Code Server).

The core technical risk is **not** the stack or architecture — both are de-risked. The risks are **process discipline**: staying within v4.0's explicit "no GUI work" boundary (scope creep temptation is high), keeping the Firefox patch set small and rebaseable, preventing Theia backend orphaning, and maintaining a Theia API allowlist. These require conscious, ongoing attention, not one-time decisions.

The build infrastructure follows existing patterns: two isolated Nix dev shells, artifact builds for fast iteration, and GitHub Actions CI rebasing the patch stack on every ESR release with loud conflict failures. The decoupled-build strategy (Theia boots standalone in any browser via `yarn watch`) is both a testing advantage and scope-protection tool.

## Key Findings

### Stack (HIGH Confidence)
- **Firefox ESR 153.1.0esr** — Current ESR line (became current 2026-07-21). Predecessor EOL 2026-09-29.
- **Eclipse Theia v1.74.1** — Latest tagged release (2026-08-06). No newer tag.
- **Node.js >=22** (floor), **24 recommended** — Pin `nodejs_22` for support tail.
- **Yarn Classic 1.x** — Confirmed by Theia's reference app; not framework's internal build.
- **Build strategy:** Artifact builds with `--enable-artifact-builds` (minutes, not hours).
- **CI pattern:** Zen Browser's `surfer` + GitHub Actions `sync-upstream.yml` automates ESR rebase.
- **NixOS-specific:** `mach bootstrap` doesn't work on Nix. Use `nix develop` with `inputsFrom` Firefox instead.

### Features (MEDIUM-HIGH Confidence)

**Table-stakes (cannot ship without):**
Firefox-side rebrand (MOZ_APP_NAME, branding/, profile rename), Theia-side rebrand (extension-based), sidecar spawn/health-check/restart/kill, token auth on loopback, port collision handling, full-window Theia (shell untouched), @sourcerer/customize inert seam, Navigatable URIs per widget.

**Nice-to-have:** Branded error states, diagnostics page, overlapped startup, typeable URIs, dev-build indicator.

**Anti-features (explicitly out of scope):** Custom chrome (R5+), Electron, self-hosted registry, patching Theia/Gecko.

**Dependencies:** Sidecar spawn/port/token atomic. Theia-side branding independent and parallelizable.

### Architecture (HIGH Confidence)

**System:** Firefox fork hosting one persistent `<browser>` element (Gecko process), rendering Theia backend (Node, 127.0.0.1, token-auth, health-supervised).

**Key components:** `sourcerer.xhtml` (single-`<browser>` main window), `TheiaService.sys.mjs` (supervisor), `SourcererAPI.sys.mjs` (anti-corruption layer, sole Firefox-internals touchpoint), `theia/` (independent npm workspace, `applications/browser` target), `@sourcerer/*` extensions.

**Build order:** 0) Nix flake, 1) Theia standalone, 2) Theia extensions, 3) Firefox branded, 4) sourcerer.xhtml gut + SourcererAPI, 5) TheiaService integration, 6) hardening.

**Critical mechanisms:** Health-check-gated activation (don't set browser src until backend ready). Process-group kill (not just PID). Custom XHTML with `hidechrome`/`chromemargin` (not `--kiosk`, keyboard-hostile).

### Pitfalls (MEDIUM Confidence)

**Critical (v4.0 boot phase):**
1. `mach bootstrap` fails on NixOS → use `nix develop`
2. cbindgen/rustc FFI drift → pin both, re-verify every rebase
3. Artifact-build ceiling → document boundaries, enforce in review
4. Theia backend unauth'd; CVE-2026-61891 may not enforce token on HTTP → enforce loopback, verify ≥1.73.1
5. Orphaned child processes → launch in process group, kill group, cleanup on startup
6. No Theia API stability tier → maintain `INTERNAL-APIS.md` allowlist, diff against `doc/Migration.md`
7. Native module ABI mismatch → pin one Node version across all contexts, explicit `rebuild:browser`
8. Patch drift → prefer `sourcerer/` overlays, automate rebase CI
9. ESR major transitions (post-v4.0) → separate scheduled work, full re-test
10. Scope creep into GUI → enforce "Out of Scope" as hard gate

## Implications for Roadmap

**Six phases addressing dependency layers:**

**Phase 0: Build Infrastructure** (1–2 weeks, blocks all)
Nix flake with two shells, validate stock Firefox and standalone Theia build.

**Phase 1: Theia Sidecar Standalone** (2–3 weeks, parallel with 2–3)
Bootstrap workspace, build `applications/browser`, prove decoupled-build hypothesis.

**Phase 2: Theia-Side Extensions** (3–4 weeks, parallel, depends on Phase 1)
`@sourcerer/product` (R1 branding), `@sourcerer/customize` (R4a seam), `@sourcerer/navigatable` (R4b URIs).

**Phase 3: Firefox Fork Branded** (2–3 weeks, parallel with 1–2)
Vendor upstream, artifact build stock ESR, apply branding (name, icons, profile), validate against unmodified UI.

**Phase 4: sourcerer.xhtml Gut + SourcererAPI** (1–2 weeks, depends on Phase 3)
Replace browser.xhtml, stand up anti-corruption layer, initialize `INTERNAL-APIS.md`.

**Phase 5: TheiaService Integration** (2–3 weeks, depends on Phases 1 AND 4)
Spawn via Subprocess.sys.mjs, health-check loop, gate browser activation, token auth, end-to-end wiring.

**Phase 6: Crash/Shutdown Hardening** (1–2 weeks, depends on Phase 5)
Process-group supervision, SIGTERM→SIGKILL, cleanup check, restart-with-backoff, crash recovery. **v4.0 complete here.**

## Confidence Assessment

| Layer | Confidence | Gaps |
|-------|-----------|------|
| **Stack** | HIGH | Nixpkgs Firefox-toolchain attributes not independently verified (validate with nixos MCP before flake write) |
| **Features** | MEDIUM-HIGH | Per-widget URI semantics deferred to implementation (intentional, LOW risk) |
| **Architecture** | HIGH | Scaling from single to multi-`<browser>` requires Phase-5 discipline (MEDIUM confidence on enforcement) |
| **Pitfalls** | MEDIUM | Some flagged for future milestones (ESR major). Recovery strategies are best-practices. |
| **Roadmap** | MEDIUM-HIGH | Phase durations ±50% (solo-developer assumed). Parallelization via decoupled builds confirmed. |

## Roadmapper Checklist

- [ ] Validate nixpkgs attributes against nixos MCP before Phase 0
- [ ] Sequence phases: 0 blocks all; 1,2,3 parallel after 0; 4 after 3; 5 after both 1&4; 6 after 5
- [ ] Lock v4.0 scope: "Out of Scope" is hard gate; scope urge → roadmap backlog
- [ ] CI rebase automation: Phase 0 skeleton; Phase 3 produces patches
- [ ] Budget hardening distinctly: Phase 5 integration, Phase 6 robustness
- [ ] Phase 2: Start `INTERNAL-APIS.md`, review every `@theia/*` import
- [ ] Phase 4: Verify `SourcererAPI` is sole Firefox-internals importer
- [ ] Phase 5: Supervisor doesn't hard-code "exactly one `<browser>`"
- [ ] Phase 6 acceptance: SIGKILL → zero orphaned processes

## Sources

- Synthesized from `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (each carries its own inline source citations and confidence tags).
