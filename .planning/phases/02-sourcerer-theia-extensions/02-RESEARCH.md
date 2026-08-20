# Phase 2: Sourcerer Theia Extensions - Research

**Researched:** 2026-08-20
**Domain:** Eclipse Theia 1.74.1 extension composition, DI rebind mechanics, URI/OpenHandler subsystem
**Confidence:** HIGH

> ## ⚠ SUPERSEDED IN PART — read this before §6, §"Package Legitimacy Audit", §"Environment Availability", or §"Validation Architecture"
>
> **CONTEXT.md decision D-69 (2026-08-20) replaces every Playwright-based
> mechanism in this document.** The headless harness is the Firefox this repo
> already builds — `objdir/dist/bin/firefox` (153.1.0esr) — driven in
> `--headless` mode via `--screenshot` and WebDriver BiDi over Node 24's
> global `WebSocket`. **No npm test dependency is added.**
>
> Specifically superseded here:
> - **§6's** `import { chromium } from 'playwright'` script shape → use the
>   BiDi driver shape transcribed in D-69. §6's *substantive* finding survives
>   unchanged and is still authoritative: the DI token **must** be created with
>   `Symbol.for('SourcererPrivilegedJs')`, never a bare `Symbol()`, or it is
>   unretrievable from an out-of-bundle evaluation context. That constraint
>   applies identically under BiDi `script.evaluate`.
> - **§"Package Legitimacy Audit"** — the `[SUS]` rows for `playwright` and
>   `@playwright/test` are moot; neither package is installed. The audit's
>   other rows stand. (`@modelcontextprotocol/sdk` remains transitively forced
>   by `@theia/ai-mcp` per D-19 and was never a choice.)
> - **§"Environment Availability"** — the `playwright` "missing dependency"
>   row is void. The replacement is already present and was built by Phase 1.
> - **§"Validation Architecture"** — superseded by `02-VALIDATION.md`, which
>   was rewritten against D-69.
> - **§"Alternatives Considered"** — the "Playwright vs puppeteer" row is moot;
>   neither is used.
>
> D-69 verified all six required assertion shapes live on this host before the
> switch: `--screenshot` capture, `document.title`, `link[rel=icon]` type, the
> `/Theia|Eclipse/i` body check, and `container.isBound(Symbol.for(...))` in
> both the `true` and `false` branches.
>
> Everything else in this document — the FactoryId table (§4), the API
> signatures (§3), the install/build procedure (§1), the extension package
> shape (§2), and §5's criterion-2 diff mechanism — is unaffected and remains
> authoritative.

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md for this phase carries 50 already-verified decisions (D-19 through
D-68), each checked against the pinned Theia v1.74.1 source tree with file
paths and line numbers. **This research does not re-derive any of them.**
Full text is at
`.planning/phases/02-sourcerer-theia-extensions/02-CONTEXT.md` — the planner
must read that file directly; what follows is the condensed index plus every
place this research's own source verification **confirmed, refined, or
contradicted** a specific claim.

### Locked Decisions (verbatim topic index — see CONTEXT.md for full text)

- **Package composition (D-19 to D-29):** exactly 49 `@theia/*` packages at
  exact `1.74.1` (except `@theia/monaco-editor-core` at `1.108.201`), with a
  documented exclusion list and reasons (`mini-browser`, `ai-mcp-server`,
  `metrics`/`plugin-metrics`/`telemetry`, `toolbar`, `secondary-window`,
  `terminal-manager`, `memory-inspector`, `preview`, `ai-vercel-ai`,
  `external-terminal`/`remote`/`remote-wsl`/`dev-container`, `electron`,
  `collaboration`, `ai-registry`, `ai-scanoss`/`scanoss`, `ai-llamafile`,
  `ai-copilot`, `ai-codex`, `ai-claude-code` (deferred), `ai-google`/`ai-ollama`/`ai-hugging-face`,
  `ai-history`/`ai-tool-sketchpad`, `scm-extra`/`property-view`/`plugin-ext-headless`/`plugin-dev`).
- **`@sourcerer/*` package layout (D-30 to D-32):** three packages —
  `branding`, `customize`, `tab-uris` — added to a new `extensions/*`
  workspace glob, each a **direct dependency** of
  `applications/browser/package.json`. No Lerna (D-08 holds).
- **Branding (D-33 to D-37):** own welcome `ReactWidget`
  (not a `GettingStartedWidget` subclass), `applicationName` config field,
  `rebind(AboutDialog)` overriding `render()` entirely, injected favicon
  `<link>` from a `FrontendApplicationContribution`. BRAND-06 is Phase 3, not
  this phase.
- **URI model (D-38 to D-53):** registry-first (`WidgetManager.getDescription`),
  not `Navigatable`-first; `Navigatable` implemented only on Terminal.
  Opaque `scheme:path` form, lenient parse / canonical emit, path is identity
  only (no query/fragment/JSON), no dots in the final path segment. Seven
  schemes (`view:`, `settings:`, `terminal:` new; `output:`, `preference:`,
  `vscode-extension:` existing; `webview:` session-scoped). Bare `OpenHandler`
  not `WidgetOpenHandler`; `canHandle` returns 1000/0; open-vs-focus is free
  via `WidgetManager.getOrCreateWidget`'s own dedup. Terminal identity is
  `t<n>` via a `TerminalFrontendContribution` rebind. Coverage boundary is
  every widget that owns a shell tab, containers not parts. Save-As gate
  interacts with any `getResourceUri` addition. Acceptance test is a
  round-trip assertion, not "a widget appeared."
- **Customization layer (D-54 to D-67):** CSS at
  `$THEIA_CONFIG_DIR/customize.css` via `user-storage:/user/customize.css`,
  injected as a bare `<style>` in `onStart`, hot-reloaded off
  `FileService.onDidFilesChange` with debounce and scheme-filtering, never
  auto-created. JS layer gated by a build-time `theia.frontend.config.sourcererPrivilegedJs`
  boolean read inside the `ContainerModule` callback; rejected alternatives
  (query param, URL hash, backend env var) documented with reasons. Honest
  caveat: the DI container is always exposed on `window.theia.container`, in
  every build — the flag decides only whether Sourcerer auto-executes a
  user-supplied JS file at startup, not whether a page already running script
  could reach the container.
- **Verification (D-68):** criterion 2 (zero changes inside `@theia/*`) is a
  checked-in, re-runnable script — a checksum/diff comparison against a
  freshly-resolved install.

### Claude's Discretion (from CONTEXT.md — leanings, not constraints)

- Brand copy: name only ("Sourcerer") + version + link set; no invented
  marketing copy; ask before writing user-facing text beyond the product name.
- Logo treatment: recolored SVG in welcome widget and About dialog; blue
  circular badge reserved for a future packaged app icon (Phase 3).
- `view:` path spelling for the welcome widget: whatever the `WidgetFactory`
  id is, per D-43's "path is the factory id verbatim" rule. **This research's
  factoryId table below is where that id must come from once
  `@sourcerer/branding` picks one — recommend `welcome` to match D-43's own
  example spelling, but it is not yet a fact because the widget doesn't exist
  yet.**
- Secondary windows: leaning is out of scope (`@theia/secondary-window`
  excluded, D-28).
- Default `theia.frontend.config` beyond `applicationName`: keep minimal,
  push debatable defaults to `settings.json` instead of baking them.

### Deferred Ideas (OUT OF SCOPE for this phase)

`@sourcerer/browser-bridge`, chrome-side URL bar, Firefox-side branding
(Phase 3), `sourcerer.xhtml`/`SourcererAPI.sys.mjs`/`TheiaService.sys.mjs`
(Phase 4), `sourcerer/INTERNAL-APIS.md` (Phase 4), self-hosted Open VSX
registry (R9), Sourcerer's own AI layer (R8), `@theia/ai-claude-code`
(deferred pending R8's SDK pin), addressing `ViewContainerPart` sub-views,
a `WebviewPanelSerializer`, hot-flipping the CUST-02 dev flag without a
rebuild.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-05 | Theia-side branding via `@sourcerer/*` DI rebind, no core patch | Extension package shape (§2), `AboutDialog`/`ReactWidget` API surface (§3), theia-ide in-tree precedent read line-by-line (§2, §3) — flags that the precedent itself does **not** scrub `renderExtensions()`, which criterion 1 requires Sourcerer to do beyond what the precedent shows |
| CUST-01 | Runtime user CSS layer, empty-by-default | `URI.resolve()` and `FileService.read()` signatures confirmed (§3); D-54–D-61 mechanics already fully cited in CONTEXT.md, not re-derived |
| CUST-02 | Privileged JS layer gated by build-time dev flag | `FrontendApplicationContribution` lifecycle confirmed (§3); the one **unresolved executable gap** — how to retrieve the DI token from a Playwright `page.evaluate()` context for the D-64 proof — is closed in §6 (`Symbol.for` requirement) |
| URI-01 | Settings widget has a `settings:` address | `PreferencesWidget.ID = 'settings_widget'` verified byte-exact at `preference-widget.tsx:39` (§4) |
| URI-02 | Terminal `Navigatable` under `terminal:` | `TerminalFrontendContribution.newTerminal`, `TerminalWidgetFactoryOptions`, `nextTerminalCreationToken`, and the full binding list reached by one rebind — all confirmed against source, D-47 upheld and the binding list is larger than D-47 stated (§4) |
| URI-03 | Every other non-document widget has an address | Full factoryId table for all 49-package `view:` targets, source-verified line-by-line, **5 discrepancies from D-43's table found and corrected** (§4) |
| URI-04 | URIs typeable, per-scheme semantics documented | `OpenHandler`/`OpenerService`/`Prioritizeable.isValid`/`WidgetManager.toKey` mechanics confirmed exact (§3, §4); D-50's plugin-view-container round-trip formula confirmed correct with the exact reconstruction code (§4) |

</phase_requirements>

## Summary

CONTEXT.md already answers "what" for this phase in exhaustive, source-cited
detail. This research answers "how to execute it" in six places CONTEXT.md
states as intent but not as procedure: the install/build sequence for going
from 11 to 49 `@theia/*` packages, the physical shape of a `@sourcerer/*`
extension package, the exact API signatures the planner writes tasks against,
an authoritative factoryId table for URI-03 (with corrections), a concrete
mechanism for D-68's diff-against-stock proof, and a concrete mechanism for
D-64's dev-flag-off proof. Every claim below was checked against the pinned
`/home/chris/Vibe Coding/TheiaIDE/sources/theia` tree (v1.74.1) or the actual
npm registry this session — not carried over from training data.

Two premises in CONTEXT.md needed correction after direct verification.
First, **`@vscode/ripgrep@1.18.0` no longer has a postinstall download** —
the "point it at nixpkgs `rg` instead of letting it download" framing in D-26
described an older version of the package; the current mechanism is a set of
12 `optionalDependencies` platform packages gated by `os`/`cpu` fields, and
Yarn Classic already skips the 11 that don't match the host — there is no
script to intercept via `--ignore-scripts`. If avoiding the prebuilt binary
blob itself (not just avoiding a live network fetch) is still the actual
goal, the fix is a post-install file swap or a runtime path override, not an
install-script gate — see §1. Second, **five of D-43's `view:` factoryId
strings do not match the source**, and one shipped widget (`ai-sessions-widget`
from `@theia/ai-ide`) is missing from D-43's table entirely — see §4's
corrected table, which is this research's single most load-bearing
deliverable.

**Primary recommendation:** treat §4's factoryId table as the literal
transcription source for `@sourcerer/tab-uris`'s static map — do not
re-derive it from D-43, which has known-wrong entries.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branding (welcome widget, About dialog, title, favicon) | Frontend (browser-target Theia app) | — | All four surfaces are rendered client-side by Theia's own frontend container; no backend or CDN involvement. `@sourcerer/branding`'s `ContainerModule` is a frontend-only DI module. |
| Customization CSS/JS layer | Frontend (read) + Filesystem (source of truth) | Backend (file watch proxy) | The file lives on disk (`$THEIA_CONFIG_DIR/customize.css`), but injection, hot-reload subscription, and script execution all happen in the frontend container. The backend's role is limited to being the `DiskFileSystemProvider` the frontend's `FileService` already proxies through — no new backend code. |
| URI registry (`@sourcerer/tab-uris`) | Frontend | — | `WidgetManager`, `OpenerService`, and every widget factory this phase addresses are frontend-only constructs. No backend RPC is introduced. |
| Package composition / build | Build tooling (Yarn workspace, `theia-cli`) | — | Not a runtime tier — this is the `theia/` npm workspace's dependency graph and `theia build` pipeline, entirely outside the browser/backend split. |

No capability in this phase touches the CDN/static or Database/Storage tiers
— consistent with the phase boundary (`localhost` standalone app, no Firefox
build in the loop).

## Standard Stack

### Core

No new third-party libraries are introduced by this phase's product code —
the 49 `@theia/*` packages and their transitive dependencies were already
locked in CONTEXT.md D-19. The only **new** dependency this research
recommends is a headless browser driver for the D-64 verification proof
(§6), which is test tooling, not shipped product code.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `playwright` (or `@playwright/test`) | latest at plan time — `70,034,924` weekly downloads, official `microsoft/playwright` repo `[VERIFIED: npm registry]` | Headless in-page evaluation for D-64's `window.theia.container.isBound(...)` proof | Theia's own framework repo ships `puppeteer@25.1.0` as a root devDependency and an `examples/playwright` directory for its own e2e suite `[VERIFIED: /home/chris/Vibe Coding/TheiaIDE/sources/theia/package.json:51,145; examples/playwright/ directory listing]` — Playwright is the tool already idiomatic to this exact codebase's own testing conventions, not an outside import |

**Package legitimacy note:** the gate below flags both `playwright` and
`@modelcontextprotocol/sdk` `SUS` on a "too-new" heuristic. Both are false
positives on release-date recency, not package age — Playwright is a
7-year-old Microsoft project with a fast release cadence (its *latest*
publish is recent, which the heuristic reads as "new"), and
`@modelcontextprotocol/sdk` is a transitively-forced dependency of
`@theia/ai-mcp` (already accepted per D-19) with 43M weekly downloads under
the official `modelcontextprotocol` GitHub org — not a package this phase
chooses to add. See the audit table for full signals.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright for D-64 | `puppeteer` (already a Theia framework devDependency) | Either works; Playwright is recommended because it ships its own test runner (`@playwright/test`) with less scaffolding for a single assertion script, and its `page.evaluate()` semantics for symbol retrieval (§6) are identical to Puppeteer's — pick whichever the planner prefers, this is not a load-bearing decision |

**Installation** (inside the `theia` Nix dev shell, added to a new top-level
`devDependencies` if the verification script lives in the `theia/` workspace,
or as a repo-root tool if it lives in `scripts/`):

```bash
yarn add --dev playwright
npx playwright install chromium   # downloads a browser binary — see Environment Availability
```

## Package Legitimacy Audit

| Package | Registry | Age (from publish date) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------------------|-----------|--------------|---------|-------------|
| `@vscode/ripgrep` | npm | latest publish 2026-05-07 | 1,405,013/wk | github.com/microsoft/vscode-ripgrep | OK | Approved — transitive via `@theia/file-search`, no postinstall script `[VERIFIED: npm registry]` |
| `@vscode/ripgrep-linux-x64` | npm | latest publish 2026-05-07 | 611,879/wk | github.com/microsoft/vscode-ripgrep | OK | Approved — `optionalDependency`, gated by `os:["linux"], cpu:["x64"]`, only this one of 12 platform packages resolves on the target host `[VERIFIED: npm registry]` |
| `node-pty` | npm | latest publish 2025-12-22 | 5,124,342/wk | github.com/microsoft/node-pty | OK | Approved — already audited and rebuilt by Phase 1 (`scripts/smoke-theia.sh`); `@theia/plugin-ext`'s own `node-pty@1.2.0-beta.12` dependency resolves to the identical version already pinned via `@theia/process`, so it dedupes to one `node_modules/node-pty` entry, not a second native-build path `[VERIFIED: npm view @theia/process@1.74.1, @theia/plugin-ext@1.74.1]` |
| `@modelcontextprotocol/sdk` | npm | latest publish 2026-07-27 | 43,466,247/wk | github.com/modelcontextprotocol/typescript-sdk | SUS ("too-new" heuristic — false positive, see Summary) | Kept — transitively forced by `@theia/ai-mcp`, already an accepted D-19 dependency; not a package this phase installs by choice |
| `playwright` | npm | latest publish 2026-07-30 | 70,034,924/wk | github.com/microsoft/playwright | SUS ("too-new" heuristic — false positive) | Kept — see Summary; add a `checkpoint:human-verify` before `yarn add --dev playwright` per protocol even though the signal is a heuristic false positive |
| `@playwright/test` | npm | latest publish 2026-07-30 | 46,413,021/wk | github.com/microsoft/playwright | SUS ("too-new" heuristic — false positive) | Kept — same as above |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@modelcontextprotocol/sdk` (transitive, not a choice), `playwright`, `@playwright/test` (both are the "too-new" heuristic misfiring on high-cadence, massively-downloaded, officially-sourced packages — the planner should still gate the `yarn add --dev playwright` step behind a `checkpoint:human-verify` per protocol, but the underlying signal does not indicate an actual supply-chain risk).

The 49 `@theia/*` packages are not re-audited through this gate: their names,
versions, and dependency graphs were verified this session directly against
the Theia v1.74.1 source tree (`packages/*/package.json`, read file-by-file
in the investigations CONTEXT.md documents) — a stronger provenance bar than
a registry-existence check, per the package-name-provenance rule.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser tab (localhost:3000, dev) / Firefox <browser> (Phase 4+)    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Theia Frontend Container (inversify DI, one per page load)   │   │
│  │                                                                 │   │
│  │  FrontendApplication.start()                                  │   │
│  │    ├─ startContributions()  ◄── @sourcerer/branding:          │   │
│  │    │    (all FrontendApplicationContribution.onStart)         │   │
│  │    │      • inject favicon <link>                             │   │
│  │    │      • register welcome WidgetFactory                    │   │
│  │    │                                                            │   │
│  │    │    ◄── @sourcerer/customize:                              │   │
│  │    │      • read user-storage:/user/customize.css              │   │
│  │    │      • inject <style> into <head>                         │   │
│  │    │      • subscribe FileService.onDidFilesChange (hot reload)│   │
│  │    │      • (if sourcererPrivilegedJs) exec customize.js        │   │
│  │    │                                                            │   │
│  │    │    ◄── @sourcerer/tab-uris:                                │   │
│  │    │      • DefaultOpenerService.addHandler(view: handler)      │   │
│  │    │      • DefaultOpenerService.addHandler(settings: handler)  │   │
│  │    │      • rebind(TerminalFrontendContribution) → t<n> names   │   │
│  │    │                                                            │   │
│  │    └─ attachShell(host)   (ApplicationShell mounts — unchanged) │   │
│  │                                                                 │   │
│  │  User types/pastes a URI ──► OpenerService.open(uri)           │   │
│  │    └─ getOpeners(uri) sorted by canHandle() priority           │   │
│  │         └─ @sourcerer/tab-uris handler (priority 1000)         │   │
│  │              ├─ view: N  → AbstractViewContribution.openView() │   │
│  │              │             (per-package contribution, D-44)    │   │
│  │              ├─ settings:N → delegate to PreferenceOpenHandler │   │
│  │              └─ terminal:N → WidgetManager.getOrCreateWidget   │   │
│  │                              ('terminal', {created:N,...})     │   │
│  │                                                                 │   │
│  │  Tab opened/focused ──► WidgetManager.getDescription(widget)   │   │
│  │    └─ {factoryId, options} → @sourcerer/tab-uris reverse map   │   │
│  │         → URI shown on the tab (future browser-bridge consumer)│   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
theia/
├── package.json                 # workspaces: ["applications/*", "extensions/*"]  (D-31)
├── applications/
│   └── browser/
│       └── package.json         # 49 @theia/* deps + 3 @sourcerer/* deps + theia.frontend.config
└── extensions/
    ├── branding/
    │   ├── package.json         # name: "@sourcerer/branding"
    │   ├── tsconfig.json
    │   └── src/
    │       └── browser/
    │           ├── sourcerer-frontend-module.ts   # ContainerModule (theiaExtensions.frontend)
    │           ├── sourcerer-welcome-widget.tsx    # ReactWidget, WidgetFactory id 'welcome'
    │           ├── sourcerer-about-dialog.tsx       # rebind(AboutDialog)
    │           └── sourcerer-favicon-contribution.ts # FrontendApplicationContribution
    ├── customize/
    │   ├── package.json         # name: "@sourcerer/customize"  (name fixed by R4a)
    │   ├── tsconfig.json
    │   └── src/browser/
    │       └── customize-frontend-module.ts        # CSS layer + gated JS layer
    └── tab-uris/
        ├── package.json         # name: "@sourcerer/tab-uris"
        ├── tsconfig.json
        └── src/browser/
            ├── tab-uris-frontend-module.ts
            ├── view-open-handler.ts                 # view: + settings: bare OpenHandler
            ├── view-factory-registry.ts              # the static factoryId map (§4 table)
            └── terminal-naming-contribution.ts       # rebind(TerminalFrontendContribution)
```

### Pattern 1: `@sourcerer/*` extension package shape

**What:** A minimal, self-contained Theia extension package discoverable by
`theia build` via the `theiaExtensions` manifest key.
**When to use:** For all three `@sourcerer/*` packages — this is the only
mechanism that avoids patching Theia core.
**Verified minimum shape**, cross-checked against the theia-ide product
extension `[VERIFIED: /home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product/package.json, tsconfig.json]`:

```json
// extensions/branding/package.json
{
  "private": true,
  "name": "@sourcerer/branding",
  "version": "0.1.0",
  "license": "MIT",
  "dependencies": {
    "@theia/core": "1.74.1"
  },
  "peerDependencies": {
    "react": "^18.3.1"
  },
  "theiaExtensions": [
    { "frontend": "lib/browser/sourcerer-frontend-module" }
  ],
  "files": ["lib", "src"],
  "scripts": {
    "clean": "rimraf lib *.tsbuildinfo",
    "build": "tsc -b"
  }
}
```

```json
// extensions/branding/tsconfig.json — theia-ide extends a shared
// configs/base.tsconfig.json this repo does not have (no Lerna, D-08/D-32
// holds), so inline the same compilerOptions directly rather than inventing
// a shared-config package:
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib",
    "baseUrl": ".",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "noImplicitAny": true,
    "noEmitOnError": false,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "downlevelIteration": true,
    "resolveJsonModule": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2017",
    "jsx": "react",
    "lib": ["ES2017", "ES2020.Promise", "dom"],
    "sourceMap": true,
    "composite": true
  },
  "include": ["src"]
}
```
*(Source for the compilerOptions:
`[VERIFIED: /home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/configs/base.tsconfig.json:1-27]` — quoted verbatim above, just inlined instead of `extends`-referenced since there is no shared configs package in this repo.)*

**Required integration points, both must happen or `theia build` never sees
the package:**
1. `theia/package.json`'s `workspaces` array — currently
   `["applications/*"]` `[VERIFIED: /home/chris/coding/sourcerer/theia/package.json:3-5]`
   — must become `["applications/*", "extensions/*"]`.
2. `theia/applications/browser/package.json`'s `dependencies` must list each
   `@sourcerer/*` package by name at its own version (e.g.
   `"@sourcerer/branding": "0.1.0"`) — the generator only walks the app's own
   dependency graph, confirmed by CONTEXT.md's G8 citation and by the
   theia-ide precedent, where `applications/browser/package.json` lists
   `"theia-ide-product-ext": "1.74.100"` directly
   `[VERIFIED: /home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/applications/browser/package.json — quoted in dependencies block]`.

Build order: no Lerna, so each `@sourcerer/*` package's own `build` script
(`tsc -b`) must run **before** `applications/browser`'s `yarn build` (which
runs `theia rebuild:browser` then `theia build`) — since there is no
inter-package build dependency among the three `@sourcerer/*` packages
(D-32), a flat sequential `yarn workspaces run build` (Yarn Classic supports
this) or an explicit `(cd extensions/branding && yarn build) && (cd
extensions/customize && yarn build) && (cd extensions/tab-uris && yarn build)`
ahead of the existing `applications/browser` build step is sufficient — no
topological build orchestration is needed.

### Anti-Patterns to Avoid

- **Shared `configs/` package for the three `@sourcerer/*` tsconfigs:**
  theia-ide's `extends: "../../configs/base.tsconfig"` pattern implies a
  fourth workspace member. Given D-08/D-32's "no Lerna, no shared tooling
  infra" stance, inline the compilerOptions per-package instead (shown
  above) — three duplicated 25-line blocks is cheaper than standing up a
  shared-config package for a monorepo of three extensions.
- **Trusting `theia-ide`'s `TheiaIDEAboutDialog.renderContent()` as a
  finished template:** it still calls `this.renderExtensions()`
  `[VERIFIED: /home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product/src/browser/theia-ide-about-dialog.tsx:49]`
  — the exact method D-35 says criterion 1 forbids (it lists every `@theia/*`
  package by name and version). The in-tree precedent is a pattern for *how*
  to subclass and override `render()`, not a scrubbed dialog body to copy —
  Sourcerer's version must drop that call, not keep it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Open-vs-focus / dedup for a URI-opened widget | A custom "is this widget already open" check in the `view:` handler | `WidgetManager.getOrCreateWidget(factoryId, options)` | Already deduplicates on `stableJsonStringify({factoryId, options})`, handles the pending-promise race (`pendingWidgetPromises`), and fires `onDidCreateWidgetEmitter` correctly — confirmed at `widget-manager.ts:237-255` |
| Widget→URI reverse lookup | Walking `shell.widgets` and guessing an id scheme | `WidgetManager.getDescription(widget)` | Returns the exact `{factoryId, options}` the widget was created with — the only reliable source, confirmed at `widget-manager.ts:275-282` |
| Plugin-contributed view container round-trip | A custom lookup table keyed by view container id | `PLUGIN_VIEW_CONTAINER_FACTORY_ID + ':' + viewContainerId` string, reconstructed independently — see §4 | `PluginViewRegistry.toViewContainerIdentifier`/`toViewContainerId` are `protected`, not accessible from `@sourcerer/tab-uris`, but the formula they implement is a one-line string op confirmed reproducible without needing the protected methods |
| CSS layer cascade timing | A `MutationObserver` on `document.head` | `FrontendApplicationContribution.onStart` (runs after all core style contributions, before shell attach) | Already the mechanism CONTEXT.md D-59 specifies and this research confirmed via `frontend-application.ts`'s `start()` sequencing |

**Key insight:** everything URI-01 through URI-04 need already exists in
`WidgetManager`/`OpenerService`/`AbstractViewContribution` — the entire phase
is composition and one small registry, not new subsystem code.

## API Signatures

Verified directly against `/home/chris/Vibe Coding/TheiaIDE/sources/theia`
(v1.74.1, read-only reference).

### `OpenHandler`
```typescript
// Source: packages/core/src/browser/opener-service.ts:29-56
export interface OpenHandler {
    readonly id: string;
    readonly label?: string;
    readonly iconClass?: string;
    /** Return a nonzero number if this handler can open; otherwise it cannot. Never reject. */
    canHandle(uri: URI, options?: OpenerOptions): MaybePromise<number>;
    /** Resolve to an opened widget or undefined. Never reject if canHandle returned positive. */
    open(uri: URI, options?: OpenerOptions): MaybePromise<object | undefined>;
}
```
`Prioritizeable.isValid` is `p.priority > 0`
`[VERIFIED: packages/core/src/common/prioritizeable.ts:52-53]` — confirms
D-45's "1000 or 0, never a doc-comment-literal 0-is-valid reading" exactly.
In-tree opener priorities confirmed: `defaultHandlerPriority = 100_000`
`[VERIFIED: packages/core/src/browser/opener-service.ts:109]`.

### `AbstractViewContribution.openView()`
```typescript
// Source: packages/core/src/browser/shell/view-contribution.ts:29-33, 86-140
export interface OpenViewArguments extends ApplicationShell.WidgetOptions {
    toggle?: boolean;
    activate?: boolean;
    reveal?: boolean;
}
async openView(args: Partial<OpenViewArguments> = {}): Promise<T>
```
`effectiveWidgetId` — the id shell operations actually use — is
`options.viewContainerId || options.widgetId`
`[VERIFIED: packages/core/src/browser/shell/view-contribution.ts:90-93]`.
This is the id the `view:` handler's path must match for any widget that has
a `viewContainerId` (e.g. `explorer-view-container`, not
`FILE_NAVIGATOR_ID`).

### `WidgetManager`
```typescript
// Source: packages/core/src/browser/widget-manager.ts
readonly onDidCreateWidget: Event<DidCreateWidgetEvent>;              // :134
getWidgets(factoryId: string): Widget[]                                // :142
tryGetWidget<T>(factoryId: string, options?: any): T | undefined       // :162
async getOrCreateWidget<T>(factoryId: string, options?: any): Promise<T>  // :237
getDescription(widget: Widget): WidgetConstructionOptions | undefined  // :275
protected toKey(options): string { return stableJsonStringify(options); }  // :290-292
```
Confirms D-46's most-likely-bug note byte-for-byte: the key is
`stableJsonStringify({factoryId, options})` — `options: undefined` and an
absent `options` key both serialize identically; `options: {}` does not.

### `TerminalFrontendContribution.newTerminal` / `TerminalWidgetFactoryOptions`
```typescript
// Source: packages/terminal/src/browser/terminal-widget-impl.ts:60-82
export const TERMINAL_WIDGET_FACTORY_ID = 'terminal';
export interface TerminalWidgetFactoryOptions extends Partial<TerminalWidgetOptions> {
    created: string   // opaque, unique per terminal — NOT a date to parse
}
export function nextTerminalCreationToken(): string {
    return `${Date.now()}-${terminalCreationCounter++}`;   // wall-clock + counter, confirmed not typeable
}

// Source: packages/terminal/src/browser/terminal-frontend-contribution.ts:1010-1016
async newTerminal(options: TerminalWidgetOptions): Promise<TerminalWidget> {
    const widget = <TerminalWidget>await this.widgetManager.getOrCreateWidget(TERMINAL_WIDGET_FACTORY_ID, <TerminalWidgetFactoryOptions>{
        created: nextTerminalCreationToken(),
        ...options   // caller-supplied values win — confirmed, this is what makes D-47's rebind work with zero core changes
    });
    return widget;
}
```
**Full binding list one `rebind(TerminalFrontendContribution)` reaches** —
broader than D-47 stated, confirmed by reading the entire frontend module
`[VERIFIED: packages/terminal/src/browser/terminal-frontend-module.ts:90-95,143]`:
`TerminalService` (`.toService`), `CommandContribution`, `MenuContribution`,
`KeybindingContribution`, `TabBarToolbarContribution`, `ColorContribution`
(all five `.toService`), **and `FrontendApplicationContribution`**
(`bind(FrontendApplicationContribution).toService(TerminalFrontendContribution)`
at line 143 — this one was not named in D-47's list but is reached by the
same single rebind).

### `FileService.read` / `onDidFilesChange`
```typescript
// Source: packages/filesystem/src/browser/file-service.ts:727-738, 1431-1436
async read(resource: URI, options?: ReadTextFileOptions): Promise<TextFileContent>
// TextFileContent = FileStreamContent & { encoding: string, value: string }
get onDidFilesChange(): Event<FileChangesEvent>

// Source: packages/filesystem/src/common/files.ts:77-100
export class FileChangesEvent {
    constructor(public readonly changes: readonly FileChange[]) {}
    contains(resource: URI, type?: FileChangeType): boolean
}
```
Confirms D-57's `(await fileService.read(uri)).value` exactly.

### `UserStorageUri`
```typescript
// Source: packages/userstorage/src/browser/user-storage-uri.ts:19
export const UserStorageUri = new URI('user-storage:/user');

// Source: packages/core/src/common/uri.ts:87
resolve(path: string | Path): URI
```
So `UserStorageUri.resolve('customize.css')` is a plain `URI.resolve()` call
on a pre-built constant, not a special factory function — D-54's phrasing
("via `UserStorageUri.resolve('customize.css')`") is accurate as written.

### `AboutDialog` / `AboutDialogProps`
```typescript
// Source: packages/core/src/browser/about-dialog.tsx:36-140
@injectable()
export class AboutDialog extends ReactDialog<void> {
    protected applicationInfo: ApplicationInfo | undefined;
    protected extensionsInfos: ExtensionInfo[] = [];
    @inject(ApplicationServer) protected readonly appServer: ApplicationServer;
    @inject(WindowService) protected readonly windowService: WindowService;
    constructor(@inject(AboutDialogProps) protected override readonly props: AboutDialogProps)
    protected async doInit(): Promise<void>       // sets applicationInfo/extensionsInfos, calls this.update()
    protected renderHeader(): React.ReactNode      // hard-links eclipse-theia.github.io comparator — MUST be overridden
    protected renderExtensions(): React.ReactNode  // lists every @theia/* package by name+version — MUST be overridden
    protected render(): React.ReactNode { return <div>{this.renderHeader()}{this.renderExtensions()}</div>; }
}
```
All members that need overriding are `protected` — clean subclass, no core
patch. `renderHeader` and `renderExtensions` are the two call sites D-35
already identified; confirmed exact.

### `ReactWidget`
```typescript
// Source: packages/core/src/browser/widgets/react-widget.tsx:24-53
@injectable()
export abstract class ReactWidget extends BaseWidget {
    protected nodeRoot: Root;   // react-dom/client createRoot
    constructor(@unmanaged() options?: Widget.IOptions)
    protected abstract render(): React.ReactNode;   // the only method a subclass must implement
}
```
A new welcome widget needs only `render()` plus a constructor that sets
`this.id` and `this.title.label` (standard Lumino `Widget` fields, not shown
above — set in the constructor body per every in-tree `ReactWidget`
subclass).

### `FrontendApplicationContribution` lifecycle
```typescript
// Source: packages/core/src/browser/frontend-application-contribution.ts:26-70
export interface FrontendApplicationContribution {
    initialize?(): MaybePromise<void>;                              // before configure
    configure?(app: FrontendApplication): MaybePromise<void>;       // before commands/keybindings/menus
    onStart?(app: FrontendApplication): MaybePromise<void>;          // shell not yet attached
    onWillStop?(app: FrontendApplication): boolean | undefined | OnWillStopAction<unknown>;  // sync only
    onStop?(app: FrontendApplication): void;                         // last tick, sync only
    initializeLayout?(app: FrontendApplication): MaybePromise<void>; // only if no prior layout state
    onDidInitializeLayout?(app: FrontendApplication): MaybePromise<void>;
}
```
Both `@sourcerer/branding` (favicon injection) and `@sourcerer/customize`
(CSS injection, hot-reload subscription) use `onStart` — confirmed this is
the correct hook for D-59's cascade-timing guarantee ("present on first
paint, no flash") since the shell is attached only after all
`onStart`-registered contributions resolve.

## FactoryId Table (URI-03 deliverable — the planner should transcribe this directly)

Every entry below was located via `bindViewContribution(bind, X)` call sites
across all 49 in-scope packages `[VERIFIED: grep of every bindViewContribution
call site in packages/*/src/browser/*-frontend-module.ts, cross-checked
against packages excluded per D-28]`, then the constructor's `widgetId`/
`viewContainerId` literal traced to its source constant. **Five entries
differ from CONTEXT.md D-43's table; one shipped widget is missing from
D-43's table entirely.** Corrections are marked ⚠️.

| `view:` path (factoryId, verbatim) | Container? | Source (file:line) | vs. D-43 |
|---|---|---|---|
| `problems` | no | `packages/markers/src/browser/problem/problem-widget.tsx:32` `PROBLEMS_WIDGET_ID = 'problems'` | matches |
| `explorer-view-container` | yes | `packages/navigator/src/browser/navigator-widget-factory.ts:29` `EXPLORER_VIEW_CONTAINER_ID = 'explorer-view-container'` | matches |
| `outline-view` | no | `packages/outline-view/src/browser/outline-view-contribution.ts:29` `OUTLINE_WIDGET_FACTORY_ID = 'outline-view'` | matches |
| `search-view-container` | yes | `packages/search-in-workspace/src/browser/search-in-workspace-factory.ts:28` `SEARCH_VIEW_CONTAINER_ID = 'search-view-container'` | matches |
| `scm-view-container` | yes | `packages/scm/src/browser/scm-contribution.ts:52` `SCM_VIEW_CONTAINER_ID = 'scm-view-container'` | matches |
| `debug` | no | `packages/debug/src/browser/view/debug-widget.ts:42` `static ID = 'debug'` | matches |
| `debug-console` | no | `packages/debug/src/browser/console/debug-console-contribution.tsx:187` `static options: ConsoleOptions = { id: 'debug-console', ... }` | matches |
| `disassembly-view-widget` | no | `packages/debug/src/browser/disassembly-view/disassembly-view-widget.ts:62` `static readonly ID = 'disassembly-view-widget'` | matches |
| `test-view-container` | yes | `packages/test/src/browser/view/test-view-contribution.ts:130` `TEST_VIEW_CONTAINER_ID = 'test-view-container'` (shared by `TestViewContribution` and `TestRunViewContribution` — the latter's `TestRunTreeWidget` id `test-run-widget` is a **part**, correctly out of scope per D-49) | matches |
| `test-result-widget` | no | `packages/test/src/browser/view/test-result-widget.ts:31` `static readonly ID = 'test-result-widget'` | matches |
| `test-output-view` | no | `packages/test/src/browser/view/test-output-widget.ts:33` `static ID = 'test-output-view'` | matches |
| `callhierarchy` | no | `packages/callhierarchy/src/browser/callhierarchy.ts:21` `CALLHIERARCHY_ID = 'callhierarchy'` | matches |
| `theia-typehierarchy` | no | `packages/typehierarchy/src/browser/tree/typehierarchy-tree-widget.tsx:97` `export const WIDGET_ID = 'theia-typehierarchy'` | ⚠️ **D-43 says `typehierarchy` — wrong, source says `theia-typehierarchy`** |
| `keybindings.view.widget` | no | `packages/keymaps/src/browser/keybindings-widget.tsx:105` `static readonly ID = 'keybindings.view.widget'` | ⚠️ **D-43 says `keybindings` — wrong, source says `keybindings.view.widget`** |
| `chat-view-widget` | no | `packages/ai-chat-ui/src/browser/chat-view-widget.tsx:43` `public static ID = 'chat-view-widget'`, used as `widgetId: ChatViewWidget.ID` in `ai-chat-ui-contribution.ts:120` | ⚠️ **D-43 says `chat-view` — wrong, source says `chat-view-widget`** |
| `ai-configuration` | no | `packages/ai-ide/src/browser/ai-configuration/ai-configuration-widget.tsx:34` `static readonly ID = 'ai-configuration'`, used in `ai-configuration-view-contribution.ts:45` | ⚠️ **D-43 says `ai-config` — wrong, source says `ai-configuration`** |
| `ai-sessions-widget` | no | `packages/ai-ide/src/browser/ai-sessions-widget.tsx:33` `static readonly ID = 'ai-sessions-widget'`, `widgetId: AISessionsWidget.ID` in `ai-sessions-view-contribution.ts:42`, no `viewContainerId` — a genuine standalone left-panel tab, `defaultWidgetOptions: { area: 'left' }` | ⚠️ **missing from D-43's table entirely** — `@theia/ai-ide` ships this widget and it owns a real shell tab; URI-03 requires it to have an address |
| `bulkedit` | no | `packages/bulk-edit/src/browser/bulk-edit-tree/bulk-edit-tree-widget.tsx:33` `export const BULK_EDIT_TREE_WIDGET_ID = 'bulkedit'` | matches |
| `plugins` | no | `packages/plugin-ext/src/main/browser/plugin-frontend-view-contribution.ts:24` `public static PLUGINS_WIDGET_FACTORY_ID = 'plugins'` | matches |
| `vsx-extensions-view-container` | yes | `packages/vsx-registry/src/browser/vsx-extensions-view-container.ts:30` `static ID = 'vsx-extensions-view-container'` | matches |
| `settings_widget` | no | `packages/preferences/src/browser/views/preference-widget.tsx:39` `static readonly ID = 'settings_widget'` — **not** part of the `view:` static map, addressed via the bespoke `settings:` handler per D-38/D-43 | matches (confirms `PreferencesContribution` really does `bindViewContribution` under this id, but URI-01 routes it through `settings:`, not `view:`) |
| `welcome` (recommended, not yet a fact) | no | Does not exist yet — `@sourcerer/branding`'s own `WidgetFactory` id, Claude's Discretion in CONTEXT.md | not applicable — this is the one entry the planner picks, not verifies |

**Plugin-contributed view containers** (dynamic, `@theia/plugin-ext`, D-50):
confirmed the id-derivation formula is exactly right, with the precise
mechanics D-50 didn't spell out:
```typescript
// Source: packages/plugin-ext/src/main/browser/view/plugin-view-registry.ts:982-987
protected toViewContainerIdentifier(viewContainerId: string): ViewContainerIdentifier {
    return { id: PLUGIN_VIEW_CONTAINER_FACTORY_ID + ':' + viewContainerId, progressLocationId: viewContainerId };
}
protected toViewContainerId(identifier: ViewContainerIdentifier): string {
    return identifier.id.substring(PLUGIN_VIEW_CONTAINER_FACTORY_ID.length + 1);
}
```
`ViewContainerWidget.id` (the actual Lumino/DOM id, what
`WidgetManager.getDescription(widget)` — read via the widget's own `.id`
property, not the `options` field returned by `getDescription` — reports) is
set directly from `options.id`
`[VERIFIED: packages/core/src/browser/view-container.ts:185, "this.id = this.options.id;"]`.
Because `identifier.id` **is** `PLUGIN_VIEW_CONTAINER_FACTORY_ID + ':' +
viewContainerId`, the widget's own `.id` already equals the full `view:`
path — no lookup table needed. `toViewContainerIdentifier`/`toViewContainerId`
are `protected` on `PluginViewRegistry`, not reachable from
`@sourcerer/tab-uris`, but since the formula is one string op, reimplement it
locally rather than reaching into `PluginViewRegistry`:
```typescript
// @sourcerer/tab-uris reconstruction, URI → widget direction
const PLUGIN_VIEW_CONTAINER_FACTORY_ID = 'plugin-view-container';
function toIdentifier(path: string) {
    return { id: path, progressLocationId: path.substring(PLUGIN_VIEW_CONTAINER_FACTORY_ID.length + 1) };
}
widgetManager.getOrCreateWidget(PLUGIN_VIEW_CONTAINER_FACTORY_ID, toIdentifier(path));
```

## §1. Install/Build Procedure: 11 → 49 `@theia/*` Packages

### Current state (verified this session)

`theia/package.json`: `"workspaces": ["applications/*"]`, a 12-entry
`resolutions` block (the 11 originally-installed packages plus `@theia/cli`)
`[VERIFIED: /home/chris/coding/sourcerer/theia/package.json:3-19]`.
`theia/applications/browser/package.json`: 11 `@theia/*` dependencies at
`1.74.1` plus `react`/`react-dom` at `18.3.1`, `devDependencies.@theia/cli`
`[VERIFIED: /home/chris/coding/sourcerer/theia/applications/browser/package.json:12-29]`.
`docs/BUILD.md`'s documented sequence:
```bash
nix develop .#theia
cd theia
yarn install --ignore-scripts --frozen-lockfile
(cd node_modules/drivelist && node-gyp rebuild)
yarn build
yarn start
```
`[VERIFIED: /home/chris/coding/sourcerer/docs/BUILD.md — quoted exact commands under "## Theia half"]`.
`scripts/smoke-theia.sh` additionally confirms `node-pty` needs **no**
explicit rebuild — it ships a prebuilt binary at
`node_modules/node-pty/prebuilds/linux-x64/pty.node`, verified present as a
file-existence check, not rebuilt
`[VERIFIED: /home/chris/coding/sourcerer/scripts/smoke-theia.sh:39-54]`.

### What changes for 49 packages

1. **`theia/package.json`**: add `"extensions/*"` to `workspaces`; extend
   `resolutions` to cover all 49 `@theia/*` names at `1.74.1` (plus
   `@theia/monaco-editor-core` at `1.108.201`) — the established pattern in
   this file already lists direct dependencies in `resolutions` too (not
   just transitive ones), so extend uniformly rather than trying to prune to
   only the 12 D-19 calls "transitively forced."
2. **`theia/applications/browser/package.json`**: extend `dependencies` from
   11 to 49 `@theia/*` entries (all `1.74.1` except
   `monaco-editor-core@1.108.201`), add the three `@sourcerer/*` entries
   pointing at their own `extensions/*` package versions, add
   `theia.frontend.config.applicationName` and
   `theia.frontend.config.sourcererPrivilegedJs`, add default
   `theia.frontend.config.preferences["security.workspace.trust.enabled"] = false`.
3. **Install sequence** — the `--ignore-scripts` + explicit-rebuild pattern
   from Phase 1 extends, but the two originally-anticipated extension points
   (`drivelist`, `@vscode/ripgrep`) resolve differently than expected:
   - `drivelist`: unchanged from Phase 1 — still needs
     `(cd node_modules/drivelist && node-gyp rebuild)`.
   - `node-pty`: unchanged from Phase 1 — `@theia/plugin-ext`'s own
     `node-pty@1.2.0-beta.12` dependency is **identical** to the version
     already pinned via `@theia/process@1.74.1`
     `[VERIFIED: npm view @theia/process@1.74.1 dependencies, npm view @theia/plugin-ext@1.74.1 dependencies — both report "node-pty": "1.2.0-beta.12"]`
     — Yarn dedupes to one `node_modules/node-pty`, so no new native-build
     step is introduced.
   - `@vscode/ripgrep` (via `@theia/file-search`, first time this dependency
     enters the tree): **D-26's stated mechanism is stale.** At the version
     `@theia/file-search@1.74.1` resolves (`^1.18.0`), `@vscode/ripgrep` has
     **no scripts field at all** — no `postinstall`, no `install`
     `[VERIFIED: npm view @vscode/ripgrep@1.18.0 --json → scripts: undefined]`.
     Instead it declares 12 platform-specific binary packages
     (`@vscode/ripgrep-linux-x64`, `-darwin-arm64`, etc.) under
     **`optionalDependencies`**, each gated with `os`/`cpu` fields
     `[VERIFIED: npm view @vscode/ripgrep-linux-x64@1.18.0 --json → os:["linux"], cpu:["x64"]; npm view @vscode/ripgrep@1.18.0 --json → optionalDependencies lists all 12]`.
     Yarn Classic skips `optionalDependencies` whose `os`/`cpu` doesn't match
     the host `[CITED: yarnpkg.com/configuration/manifest — "optional
     dependencies won't be installed at all if the os/cpu/libc filters don't
     cover the host platform"]`, so on the NixOS x86_64 dev host only
     `@vscode/ripgrep-linux-x64` installs. **There is no download to
     intercept via `--ignore-scripts` — that flag does nothing for this
     package.** If the actual goal behind D-26 (avoid an un-audited prebuilt
     `rg` binary blob) still stands, the correct mechanism is different: `rg`
     is imported directly as `import { rgPath } from '@vscode/ripgrep'` in
     both `file-search-service-impl.ts:20` and
     `ripgrep-search-in-workspace-server.ts` — a **module-level constant
     import, not a DI-injectable or preference-driven value**
     `[VERIFIED: packages/file-search/src/node/file-search-service-impl.ts:20,137-138; packages/search-in-workspace/src/node/ripgrep-search-in-workspace-server.ts:87,241]`.
     There is no preference to rebind. To point at nixpkgs' `rg` instead, the
     only lever is replacing `node_modules/@vscode/ripgrep-linux-x64`'s
     bundled binary (or the resolved `rgPath` module output) with a symlink
     to the Nix-store `rg` **after** install — a small postinstall-replacement
     step, not an install-time flag. Recommend deferring this hardening
     unless CLAUDE.md-level policy requires it; the npm-registry-sourced
     binary is not a live network fetch and is a pinned, versioned artifact.
4. **Re-audit for install scripts across the newly-added transitive tree**:
   Phase 1's own methodology (docs/BUILD.md: "auditing all 1,042 transitive
   packages... only 9 carry [a script], drivelist is the only load-bearing
   one") is the repeatable procedure — re-run it after expanding to 49
   packages, since the transitive dependency count will grow substantially
   (`@theia/plugin-ext` alone pulls `node-pty`, `decompress`, `vhost`,
   `macaddress`, `is-electron`, `vscode-textmate`, `@vscode/proxy-agent`,
   `@modelcontextprotocol/sdk` via `@theia/ai-mcp`, and more
   `[VERIFIED: npm view @theia/plugin-ext@1.74.1 dependencies --json — full 38-entry list captured this session]`).
   Spot-checked `decompress@4.2.1`, `macaddress`, `vhost` — none carry an
   `install`/`postinstall` script `[VERIFIED: npm view <pkg> scripts --json]`.
   The audit command to reuse:
   ```bash
   yarn install --ignore-scripts --frozen-lockfile
   find node_modules -maxdepth 3 -name package.json -exec \
     node -e "const p=require(process.argv[1]); const s=p.scripts||{}; if(s.install||s.postinstall||s.preinstall) console.log(process.argv[1], JSON.stringify({install:s.install,postinstall:s.postinstall,preinstall:s.preinstall}))" {} \;
   ```
5. **`@theia/plugin-ext` requires `theia download:plugins`** only if the app
   ships bundled VSIX plugins (a `theiaPlugins` map in `package.json`, as
   theia-ide's root `package.json` does
   `[VERIFIED: /home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/package.json — "theiaPluginsDir": "plugins", "theiaPlugins": {...}]`).
   **This phase's scope does not require it** — CONTEXT.md's D-19 package
   set ships the extension-host machinery (`plugin-ext`, `plugin-ext-vscode`,
   `vsx-registry`) but names no bundled plugins; a user installing extensions
   at runtime through `vsx-registry`'s open-vsx.org connection (D-21) is the
   only plugin-acquisition path this phase needs. Do not add a
   `theiaPlugins` block or run `theia download:plugins` unless a future phase
   decides to bundle default extensions.
6. **What `theia rebuild:browser` recompiles**: unchanged in kind from
   Phase 1 — it walks the resolved dependency tree for native Node addons
   and either compiles or explicitly skips them per-target (browser vs.
   electron). Expect the same skip list Phase 1 documented
   (`native-keymap`, `find-git-repositories`, `drivelist`, `keytar`) plus,
   now, whatever native modules the newly-added packages pull that are
   browser-inapplicable — verify by reading the command's own log output
   rather than assuming the Phase 1 list is exhaustive for 49 packages.

## §2. `@sourcerer/*` Extension Package Physical Shape

Covered above under **Architecture Patterns → Pattern 1**. Summary: package
name = npm name, `theiaExtensions[0].frontend` = compiled entry point path
(no `.js` extension, resolved from `lib/`), added as a direct dependency of
`applications/browser/package.json`, own `tsconfig.json` (inlined
compilerOptions, no shared base since D-08/D-32 rejects a Lerna-style shared
tooling package), own `build` script (`tsc -b`), no build-order dependency
between the three `@sourcerer/*` packages.

## §3. API Signatures

Covered above under **API Signatures**.

## §4. FactoryId Table

Covered above under **FactoryId Table**.

## §5. Verifying Criterion 2 (zero changes inside `@theia/*`)

D-68 calls for "a checksum comparison of `node_modules/@theia/*` against a
freshly-resolved install." Two complementary mechanisms, cheapest first:

1. **`yarn check --integrity`** (Yarn Classic 1.x) — verifies that every
   installed package's on-disk content hash matches the `integrity` field
   recorded in `yarn.lock`
   `[CITED: classic.yarnpkg.com/lang/en/docs/cli/check — "--integrity adds
   cryptographic hash verification to ensure packages haven't been
   tampered with"]`. This is the **per-commit** check: it catches any manual
   edit to a file inside `node_modules/@theia/*` after install, at zero extra
   install cost (no second install needed), and runs in seconds. This does
   **not** catch a hand-edited `yarn.lock` integrity field pointing at a
   forged tarball — for that, use mechanism 2.
2. **Fresh-resolve diff** — the CI-grade, re-runnable script D-68 actually
   asks for, comparing the committed tree against an independently-resolved
   install of the same `package.json` + `resolutions`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   REPO_ROOT="$(git rev-parse --show-toplevel)"
   TMPDIR="$(mktemp -d)"
   cp "$REPO_ROOT/theia/package.json" "$REPO_ROOT/theia/yarn.lock" "$TMPDIR/"
   ( cd "$TMPDIR" && yarn install --ignore-scripts --frozen-lockfile )
   diff -rq "$REPO_ROOT/theia/node_modules/@theia" "$TMPDIR/node_modules/@theia" \
     && echo "diff-theia-core: PASS -- zero changes inside @theia/*" \
     || { echo "diff-theia-core: FAIL -- see diff above" >&2; exit 1; }
   rm -rf "$TMPDIR"
   ```
   Run this in CI on every push touching `theia/package.json`,
   `theia/yarn.lock`, or `theia/applications/browser/package.json`.
   Mechanism 1 catches drift cheaply on every local commit; mechanism 2 is
   the authoritative Phase 3+/CI proof.

## §6. Verifying Criterion 3's Dev-Flag-Off Clause Headlessly (D-64)

D-64's proof is `window.theia.container.isBound(SourcererPrivilegedJs) ===
false`, evaluated in a running page against a release-configured `theia
build`. **The one executable detail CONTEXT.md does not specify: how a
Playwright `page.evaluate()` callback — which cannot import
`SourcererPrivilegedJs` from the bundle's module graph, since evaluate
callbacks run as a serialized function string in the page's own realm —
retrieves the same DI token value the bundle registered.**

The mechanism: define the DI identifier via the **global symbol registry**,
not a bare `Symbol(...)` call:
```typescript
// @sourcerer/customize's DI token — MUST use Symbol.for, not Symbol()
export const SourcererPrivilegedJs = Symbol.for('SourcererPrivilegedJs');
```
`Symbol.for(key)` looks up (or creates) a symbol in the JS realm's global
symbol registry, keyed by the string `key` — any other call to
`Symbol.for('SourcererPrivilegedJs')` **in the same realm** (including one
typed into a Playwright `page.evaluate()` callback, which executes inside
the page's own global scope, not a separate context) returns the identical
symbol value. A bare `Symbol('SourcererPrivilegedJs')` does not do this —
each call produces a unique, unretrievable value, making the token
impossible to reference from outside the module that created it. This is
fundamental ECMAScript `Symbol.for` semantics, not Theia-specific — flagged
`[ASSUMED]` only because it was not re-verified against a spec citation this
session, but it is standard-library behavior with no plausible alternative
reading.

Full verification script:
```typescript
// scripts/verify-dev-flag-off.ts (new)
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForFunction(() => (window as any).theia?.container);
  const isBound = await page.evaluate(() => {
    const token = Symbol.for('SourcererPrivilegedJs');
    return (window as any).theia.container.isBound(token);
  });
  await browser.close();
  if (isBound) {
    console.error('verify-dev-flag-off: FAIL -- SourcererPrivilegedJs is bound with the dev flag off');
    process.exit(1);
  }
  console.log('verify-dev-flag-off: PASS');
}
main();
```
**Two ways this passes vacuously, per D-64, both still apply and are worth
restating in the script's own header comment:** must run against a `theia
build` (not `theia generate`'s untouched `src-gen`) served by `lib/backend/main.js`,
and must evaluate in the page, not grep source.

## Common Pitfalls

### Pitfall 1: Trusting D-43's factoryId strings without re-verification
**What goes wrong:** `@sourcerer/tab-uris`'s static map ships with 5 wrong
strings (`typehierarchy` vs `theia-typehierarchy`, `keybindings` vs
`keybindings.view.widget`, `chat-view` vs `chat-view-widget`, `ai-config` vs
`ai-configuration`) and one missing entry (`ai-sessions-widget`).
**Why it happens:** D-43's table was produced by a 24-agent investigation
reading source, but string constants get mis-transcribed in that kind of
high-volume pass, and the investigation itself flagged that its own two runs
contradicted each other on some points.
**How to avoid:** use §4's table above, which was re-verified against source
this session with file:line citations, not D-43's.
**Warning signs:** a `view:` URI silently no-ops (canHandle returns 0
because no widget in the shell has that id) instead of erroring loudly —
this fails silently at exactly the moment a human types the URI by hand,
which is URI-04's whole acceptance criterion.

### Pitfall 2: Assuming `@vscode/ripgrep`'s postinstall still exists
**What goes wrong:** a task written to "intercept `@vscode/ripgrep`'s
postinstall download" is a no-op task — there is no postinstall script at
`1.18.0`, so nothing needs intercepting, and the task closes without having
addressed whatever the underlying supply-chain concern actually was.
**Why it happens:** the package's mechanism changed from a network-fetch
postinstall (older versions) to platform-gated `optionalDependencies`
(current) between when D-26 was written from training knowledge and this
session's registry check.
**How to avoid:** if avoiding a prebuilt binary blob is still a goal, target
the actual resolved artifact (`node_modules/@vscode/ripgrep-linux-x64`'s
binary, or the `rgPath` export) with a post-install replacement step, not an
`--ignore-scripts` gate.
**Warning signs:** `--ignore-scripts` install completes with `rg` present
and working — because it always would have, the flag was never doing
anything for this package.

### Pitfall 3: `options: {}` vs `options: undefined` forking a widget
**What goes wrong:** a `view:` handler that always passes `{}` for options
(even for factories that take no options) creates a second, distinct widget
instance from the one the menu/command palette opens — because
`stableJsonStringify({factoryId, options: {}})` differs from
`stableJsonStringify({factoryId, options: undefined})`.
**Why it happens:** `WidgetManager.toKey` is a pure function of exactly what
was passed — there is no normalization.
**How to avoid:** `createWidgetOptions` (or equivalent) in
`@sourcerer/tab-uris` must return `undefined` for factories with no path
payload, never `{}`.
**Warning signs:** two tabs with the same label, one opened via URI and one
via menu, both individually functional — this is D-46's own predicted
symptom, confirmed exactly by reading `widget-manager.ts`'s `toKey`.

## Code Examples

### Registering the `view:`/`settings:` OpenHandler (bare `OpenHandler`, D-44)
```typescript
// Source pattern confirmed against: packages/core/src/browser/opener-service.ts:29-56,
// packages/core/src/browser/shell/view-contribution.ts:103-140
import { injectable, inject } from '@theia/core/shared/inversify';
import { OpenHandler, OpenerOptions } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class ViewUriOpenHandler implements OpenHandler {
    readonly id = 'sourcerer.view-uri-open-handler';

    canHandle(uri: URI): number {
        return uri.scheme === 'view' || uri.scheme === 'settings' ? 1000 : 0;
    }

    async open(uri: URI): Promise<object | undefined> {
        // uri.path.toString() is the factoryId (view:) or preference id (settings:)
        // dispatch to the per-package AbstractViewContribution.openView(), per D-44 —
        // never shell.addWidget directly, that hardcodes { area: 'main' }.
    }
}
```

### Registering it without racing `ContributionProvider`'s cache (D-50)
```typescript
// Source: packages/core/src/browser/opener-service.ts:124 addHandler()
// A late bind(OpenHandler) is invisible once getContributions() has cached —
// so a handler bound after first open() must go through addHandler(), which
// returns a Disposable, not a static ContainerModule bind().
const disposable = openerService.addHandler(new ViewUriOpenHandler());
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@vscode/ripgrep` postinstall downloads a platform binary from a network location at install time | `optionalDependencies` on 12 platform-specific npm packages, `os`/`cpu`-gated, resolved via the registry like any other dependency | Sometime before `1.18.0` (exact version not determined this session) | D-26's "intercept the postinstall download" framing does not apply to the pinned version; see §1 point 3 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Symbol.for('SourcererPrivilegedJs')` in a Playwright `page.evaluate()` callback returns the identical symbol the bundled `@sourcerer/customize` module registered, because both execute in the page's own JS realm | §6 | If wrong, D-64's headless proof always reports `isBound === false` regardless of the actual binding state (a false pass) — verify with a positive-control run (dev flag ON) before trusting a negative result |
| A2 | Yarn Classic 1.x's `os`/`cpu` platform-package skip behavior (confirmed generally via `yarnpkg.com/configuration/manifest`, which documents Yarn's manifest handling without version-pinning the behavior to Classic specifically) applies identically to 1.x, not only Berry/2.x+ | §1 | If wrong, all 12 `@vscode/ripgrep-*` platform packages install on every host, wasting disk space but not breaking functionality — low severity even if wrong |
| A3 | `@theia/plugin-ext` does not require `theia download:plugins` for this phase's scope, because no `theiaPlugins` bundling block is planned | §1 point 5 | If a later decision bundles default VSIX extensions, this step must be added; does not block Phase 2 as scoped |

## Open Questions

1. **Exact publish version where `@vscode/ripgrep` dropped its postinstall
   script**
   - What we know: `1.18.0` (the version `@theia/file-search@1.74.1`'s
     `^1.18.0` range resolves to) has no scripts field.
   - What's unclear: whether any version in the `^1.18.0` range (there is
     only one: `1.18.0` itself, per the full versions list) behaves
     differently — moot for this pin.
   - Recommendation: not worth resolving further; the pinned resolution is
     confirmed clean.

2. **Whether `theia rebuild:browser`'s browser-target skip list grows beyond
   Phase 1's four names once 38 more packages' transitive native
   dependencies enter the tree**
   - What we know: Phase 1 documented `native-keymap`,
     `find-git-repositories`, `drivelist`, `keytar` as the skip set for 11
     packages.
   - What's unclear: whether any of the newly-added 38 packages pull a
     browser-inapplicable native module not on that list (e.g. via a Node.js
     backend-only feature in `@theia/ai-mcp` or `@theia/plugin-ext`).
   - Recommendation: read the actual `theia rebuild:browser` log output
     during Wave 0/1 execution rather than assuming the Phase 1 list is
     exhaustive — this is a one-command check at implementation time, not
     worth a speculative audit here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `nix develop .#theia` shell (node 22, yarn 1.x, node-gyp toolchain) | All install/build steps | ✓ (Phase 1 built and proved this) | per `flake.nix`, unchanged this phase | — |
| `playwright` npm package | §6's D-64 headless proof | ✗ (not yet a dependency anywhere in the repo) | — | Add via `yarn add --dev playwright` inside the `theia` shell; requires `npx playwright install chromium` to fetch a browser binary (network access needed once, cacheable) |
| `rg` (ripgrep) via `@vscode/ripgrep-linux-x64` | `@theia/file-search`, `@theia/search-in-workspace` | ✓ (resolves automatically via `optionalDependencies`, no separate install step) | `1.18.0` bundled binary | nixpkgs' own `ripgrep` package if the D-26 hardening (§1 point 3) is ever pursued |

**Missing dependencies with no fallback:** none — `playwright` has a
straightforward install path and no environment blocker.

**Missing dependencies with fallback:** `rg`'s bundled-vs-nixpkgs binary
choice, not currently blocking (see §1 point 3 — deferred unless policy
requires it).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None yet — Phase 1 shipped shell-script smoke tests (`scripts/smoke-theia.sh`, `scripts/smoke-firefox.sh`), no JS/TS test runner exists in `theia/` |
| Config file | none — see Wave 0 |
| Quick run command | `scripts/smoke-theia.sh` (existing, Phase 1) — needs a Phase 2 sibling or extension, not yet written |
| Full suite command | not yet defined |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-05 | Welcome widget, About dialog, title, favicon show Sourcerer identity, no Theia/Eclipse strings | manual/UAT (string-presence checks could be scripted via Playwright `page.content()` grep, but visual correctness needs a human look) | `playwright` script asserting DOM text does not match `/Theia|Eclipse/i` in the About dialog and welcome widget, plus a human screenshot review | ❌ Wave 0 |
| CUST-01 | Empty `customize.css` → zero visual diff; populated file → visible restyle | automated (screenshot diff) or manual | Playwright screenshot compare with/without a test CSS file present | ❌ Wave 0 |
| CUST-02 | Dev flag off → `isBound(SourcererPrivilegedJs) === false` in a release build | automated | §6's `scripts/verify-dev-flag-off.ts` | ❌ Wave 0 — this is the one script this research fully specifies |
| URI-01 | `settings:` opens/focuses the Settings widget, tab reports the address | automated | Round-trip assertion per D-53: `registry.uriOf(await open(u)).toString(true) === u`, plus `widgetManager.getWidgets('settings_widget').length === 1` after opening via both menu and URI | ❌ Wave 0 |
| URI-02 | `terminal:t1` etc. round-trips, stale name creates fresh shell | automated | Same D-53 pattern against `TERMINAL_WIDGET_FACTORY_ID` | ❌ Wave 0 |
| URI-03 | Every §4-table widget has a working `view:` address | automated, table-driven | One parameterized test iterating the §4 table, D-53's round-trip assertion per row | ❌ Wave 0 |
| URI-04 | URIs are typeable/copy-pasteable, semantics documented | manual (typing a URI by hand into an input) + a markdown doc listing per-scheme semantics | n/a for the typing check; the doc is a phase deliverable, not a test | ❌ Wave 0 (doc) |

### Sampling Rate
- **Per task commit:** the relevant single-scheme round-trip script (fast,
  seconds) plus `yarn check --integrity` (§5 mechanism 1).
- **Per wave merge:** the full §4-table-driven URI round-trip suite plus
  §6's dev-flag-off script against a release build.
- **Phase gate:** the §5 mechanism 2 fresh-resolve diff (criterion 2), the
  full URI round-trip table (criterion 4/5), and a manual branding pass
  (criterion 1) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/verify-dev-flag-off.ts` — covers CUST-02, fully specified in §6.
- [ ] `scripts/diff-theia-core.sh` — covers the criterion-2 verification,
      fully specified in §5 mechanism 2.
- [ ] A URI round-trip test harness (table-driven off §4) — covers URI-01
      through URI-04's round-trip clause.
- [ ] Framework install: `yarn add --dev playwright && npx playwright
      install chromium` inside the `theia` Nix shell.
- [ ] No existing JS/TS test runner in `theia/` — Wave 0 must decide whether
      these scripts are plain Node/TS scripts (as shown in §5/§6, no test
      framework needed for a handful of assertion scripts) or wired into a
      proper runner (`@playwright/test` gives one for free if adopted
      instead of bare `playwright`). Given the small number of checks this
      phase needs, plain scripts are the lazier and sufficient choice —
      `@playwright/test`'s fixtures/reporters are overhead this phase's
      scope does not need.

## Sources

### Primary (HIGH confidence)
- `/home/chris/Vibe Coding/TheiaIDE/sources/theia` (v1.74.1, read-only
  reference) — every file:line citation above, read directly this session:
  `opener-service.ts`, `prioritizeable.ts`, `widget-manager.ts`,
  `view-contribution.ts`, `frontend-application-contribution.ts`,
  `about-dialog.tsx`, `react-widget.tsx`, `file-service.ts`, `files.ts`,
  `user-storage-uri.ts`, `uri.ts`, `terminal-frontend-contribution.ts`,
  `terminal-widget-impl.ts`, `terminal-frontend-module.ts`,
  `view-container.ts`, `plugin-view-registry.ts`, and every
  `*-frontend-module.ts`/`*-contribution.ts`/`*-widget.ts(x)` file cited in
  the FactoryId Table.
- `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide` (theia-ide product
  repo, read-only reference) — `package.json` files, `base.tsconfig.json`,
  `theia-ide-frontend-module.ts`, `theia-ide-about-dialog.tsx`.
- npm registry, queried live this session: `@theia/process@1.74.1`,
  `@theia/plugin-ext@1.74.1`, `@theia/plugin-ext-vscode@1.74.1`,
  `@theia/ai-mcp@1.74.1`, `@theia/file-search@1.74.1`,
  `@vscode/ripgrep@1.18.0`, `@vscode/ripgrep-linux-x64@1.18.0`,
  `node-pty@1.2.0-beta.12`, `decompress@4.2.1`, `macaddress`, `vhost`.
- `/home/chris/coding/sourcerer/docs/BUILD.md`,
  `/home/chris/coding/sourcerer/scripts/smoke-theia.sh`,
  `/home/chris/coding/sourcerer/theia/package.json`,
  `/home/chris/coding/sourcerer/theia/applications/browser/package.json` —
  current-state files read directly.
- `gsd-tools query package-legitimacy check` — ran against `@vscode/ripgrep`,
  `@vscode/ripgrep-linux-x64`, `node-pty`, `@modelcontextprotocol/sdk`,
  `playwright`, `@playwright/test`.

### Secondary (MEDIUM confidence)
- `classic.yarnpkg.com/lang/en/docs/cli/check` — `yarn check --integrity`
  behavior (§5).
- `yarnpkg.com/configuration/manifest` — `os`/`cpu` optionalDependency skip
  behavior, confirmed for the Yarn manifest format generally, not
  version-pinned to Classic 1.x specifically in the source (§1, flagged as
  A2 in the Assumptions Log).

### Tertiary (LOW confidence)
- None — every claim above is either file-verified this session or cited to
  an official doc; nothing rests on unverified training-data recall alone
  except the two items in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Package composition / install procedure: HIGH — every version and
  dependency claim checked live against the npm registry this session.
- FactoryId table: HIGH — every entry traced to a source file:line this
  session, five corrections and one addition made against CONTEXT.md's D-43.
- API signatures: HIGH — every signature quoted directly from the pinned
  Theia source tree.
- D-64 headless proof mechanism: MEDIUM — the `Symbol.for` requirement is
  correct ECMAScript semantics but was not independently spec-cited (A1 in
  Assumptions Log); recommend a positive-control test run before trusting a
  negative result.

**Research date:** 2026-08-20
**Valid until:** 30 days for the Theia-source-verified material (framework
pinned at 1.74.1, will not drift under this phase). 7 days for the npm
registry package-state claims (`@vscode/ripgrep`'s scripts, download
counts) — re-verify at plan time if execution is delayed.
</content>
