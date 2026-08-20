# Phase 2: Sourcerer Theia Extensions - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The standalone `theia/` browser-target application becomes Sourcerer: it
composes a frozen, daily-drivable set of `@theia/*` packages, presents
Sourcerer identity in its welcome widget, About dialog, window/tab title and
favicon, exposes a visually-inert customization seam (runtime user CSS layer
plus a dev-flag-gated privileged JS layer), and gives every tab a typeable
URI. All of it arrives as `@sourcerer/*` Theia extensions with Theia core
untouched, verified by diff. Covers BRAND-05, CUST-01, CUST-02, URI-01,
URI-02, URI-03, URI-04.

This phase runs entirely against the standalone app at `localhost` under
`yarn watch` — no Firefox build is in the loop. It ships no Firefox patch, no
`sourcerer.xhtml`, no `SourcererAPI.sys.mjs`, and no browser chrome. It also
ships no custom chrome inside Theia: Theia's own shell (menu bar, status bar,
tab bars, top panel) stays unsuppressed. Hiding Theia's tab bar belongs to the
post-4.0 `@sourcerer/browser-bridge`, not here.

</domain>

<decisions>
## Implementation Decisions

Numbering continues from Phase 1 (D-01…D-18) so cross-phase references stay
unambiguous.

### Package composition

- **D-19:** The v4.0 app composes exactly **49 `@theia/*` packages**, all
  pinned **exact** with a matching `resolutions` block, per Phase 1's D-09.
  Every version is `1.74.1` **except `@theia/monaco-editor-core`, which is
  `1.108.201`** — it is the VS Code repackage and is versioned on VS Code's
  line, not the framework's. Verified against the installed tree and
  `packages/monaco/package.json`.
  — **Reversibility:** costly — the set determines URI-03's scope, the
  `resolutions` block, and the whole Phase 2 URI workload; adding a package
  later adds widget types that then owe URIs.

  The set:

  ```
  ai-anthropic  ai-chat  ai-chat-ui  ai-code-completion  ai-core  ai-core-ui
  ai-editor  ai-ide  ai-mcp  ai-mcp-ui  ai-openai  ai-terminal
  application-package  bulk-edit  callhierarchy  console  core  debug  editor
  editor-preview  file-search  filesystem  keymaps  markers  messages  monaco
  monaco-editor-core(1.108.201)  navigator  notebook  outline-view  output
  ovsx-client  plugin  plugin-ext  plugin-ext-vscode  preferences  process
  request  scm  search-in-workspace  task  terminal  test  timeline
  typehierarchy  userstorage  variable-resolver  vsx-registry  workspace
  ```

  Of these, **12 are transitively forced** and are listed explicitly only so
  the exact-pin `resolutions` block covers them and a transitive bump cannot
  drift them: `ai-core`, `ai-mcp`, `ai-terminal`, `application-package`,
  `bulk-edit`, `editor-preview`, `monaco-editor-core`, `notebook`, `output`,
  `ovsx-client`, `request`, `timeline`.

- **D-20:** `@theia/plugin-ext` + `@theia/plugin-ext-vscode` ship. No reading
  of "daily-drivable IDE" survives without VS Code extension support. This is
  the package that actually picks the app: it hard-depends on `ai-core`,
  `debug`, `console`, `task`, `test`, `notebook`, `output`, `scm`, `timeline`,
  `bulk-edit`, `callhierarchy` and `typehierarchy`, so roughly half the set is
  forced rather than chosen.

- **D-21:** `@theia/vsx-registry` ships, with `VSX_REGISTRY_URL` set
  **explicitly** to `https://open-vsx.org`, repointed at Sourcerer's own
  mirror in R9. Rationale, verified: `VSXExtensionResolver` is the only
  `PluginDeployerResolver` that accepts a `vscode-extension:` URI, and
  `plugin-ext-vscode` registers `installFromVSIX` with an id and **no label**,
  which Theia's command palette filters out. Deferring the package means no
  runtime extension installation by any route at all.
  — **Reversibility:** reversible — the URL is one env var; the R9 mirror
  swap is a config change.

- **D-22:** The stock AI stack ships, **including `@theia/ai-ide`**. It is the
  only place any `bind(ChatAgent)` exists in the entire tree and the only
  rebind of `AIActivationService` (which `ai-core` hardcodes to
  `isActive = true`), so without it the chat tab the Phase 2 criteria name
  errors on every message. Two small `@sourcerer` rebinds accompany it:
  a **no-op `AIFirstPerspectiveContribution`**, and an override of
  `AIAgentConfigurationViewContribution.initializeLayout()` so it stops
  forcing a main-area tab open at first boot. `AIActivationService` stays
  default-off as shipped. Accepted tradeoff: another vendor's agent lineup
  (Coder, Architect, PR-review, App Tester) ships inside a trademark-renamed
  product and is replaced in R8.

- **D-23:** Model providers are `@theia/ai-anthropic` + `@theia/ai-openai`,
  with **no key and no default model configured**. Local models reach the app
  today through `ai-openai`'s `customOpenAiModels` preference against any
  OpenAI-compatible `/v1` endpoint — Ollama, llama.cpp, vLLM and OpenRouter
  all qualify — so no additional vendor SDK is needed. **v4.0 makes no
  "nothing leaves the host" product claim.** If that later becomes a stated
  promise, add `@theia/ai-ollama` for its native reasoning handling and change
  the defaults.

- **D-24:** `@theia/getting-started` is **excluded**, and Sourcerer ships its
  own welcome widget instead (D-33). The package's content is 8 hardcoded
  `eclipse-theia.github.io` / `theia-ide.org` / `github.com/eclipse-theia`
  URLs inside a product R1 requires fully renamed. Subclassing it means
  overriding every string and link anyway; a fresh `ReactWidget` is less code
  with nothing to scrub. Its dependencies (`core`, `editor`, `filesystem`,
  `keymaps`, `workspace`) are all in the set already, so nothing else breaks.

- **D-25:** Default preferences ship `security.workspace.trust.enabled: false`.
  Without it, day one is a modal workspace-trust gate.

- **D-26:** ~~`@vscode/ripgrep` is pointed at the nixpkgs `rg` binary rather
  than allowed to run its postinstall download.~~ **Superseded 2026-08-20 by
  Phase 2 research — the premise was stale.** At the pinned resolution
  (`@vscode/ripgrep@1.18.0`, via `@theia/file-search`) the package has **no
  `scripts` field at all**; it now ships 12 `os`/`cpu`-gated
  `optionalDependencies` platform packages, and Yarn Classic already skips the
  11 that do not match the host. `--ignore-scripts` therefore does nothing for
  this package and no install-time gate is needed.

  If avoiding the prebuilt binary blob is still wanted on NixOS, the remaining
  option is a **post-install file swap**, not an install-time flag — `rgPath`
  is a hardcoded module export, not DI-injectable and not preference-driven.
  Treat that as optional hardening, not a phase requirement. `docs/BUILD.md`'s
  existing `--ignore-scripts` sequence still applies to the packages Phase 1
  identified and must not be simplified away.

- **D-27:** `@theia/ai-chat-ui`'s widget is rebound with
  `isExtractable = false` so it cannot escape into a secondary window the
  future unified tab strip has no way to model.

### Packages deliberately excluded

- **D-28:** These are excluded on evidence, not taste. Recorded so a later
  phase does not re-add one without reading the reason.

  | Package | Reason |
  |---|---|
  | `mini-browser` | `mini-browser-endpoint.ts` mounts `miniBrowserApp.get('*')` with no `HttpConnectionValidator` guard and no root confinement, and its host pattern makes `getVirtualHostRegExp` match every `Host` header on 127.0.0.1 — an unauthenticated arbitrary-file read on the sidecar. |
  | `ai-mcp-server` | Registers `app.all('/mcp')` unconditionally at backend boot, no auth, no preference gate, on a sidecar whose whole contract is token-gated 127.0.0.1 — and stock Theia binds exactly one tool through it. |
  | `metrics`, `plugin-metrics`, `telemetry` | `metrics` mounts an unauthenticated `GET /metrics`; `telemetry` has no sink and therefore no behaviour; `plugin-metrics` rebinds two `plugin-ext` internals to ship numbers its own README admits are wrong. |
  | `toolbar` | Hard-rebinds `ApplicationShell` and overrides `createLayout()` — the exact binding slot `@sourcerer/browser-bridge` must own post-4.0. Direct violation of the design-for-the-bridge rule, for a band that ships hidden by default. |
  | `secondary-window` | Produces widgets that have left the shell and by construction can have no tab and no URL — contradicts R4b — and obliges a `theia-patch` postinstall monkey-patch of `node_modules` lumino. |
  | `terminal-manager` | Re-parents terminals into its own nested `ViewContainerLayout`, so they stop being peer shell widgets the chrome strip can mirror one-to-one. A second, competing tab model, disabled by default. |
  | `memory-inspector` | Embeds an unmanaged nested `DockPanel` that sets `DOCK_PANEL_ID='theia-main-content-panel'`, impersonating the real main tab bar. DOM id collision plus a second tab bar. |
  | `preview`, `ai-vercel-ai` | `private: true` at 1.74.1 — unpublishable, so the exact-pin rule makes them uninstallable without vendoring the monorepo, which is prohibited. |
  | `external-terminal`, `remote`, `remote-wsl`, `dev-container` | Declare only `frontendElectron`/`backendElectron` `theiaExtensions` entries — a browser build never loads a line — while installing ssh2, dockerode, archiver and decompress into the lockfile. |
  | `electron` | The Electron dependency bundle by definition. `@theia/core` marks it an optional peer and Yarn Classic does not install peers, so the unmet-peer warning at install is the correct steady state and must **not** be "fixed". |
  | `collaboration` | Rebinds core `WorkspaceService` globally whether or not a session is active, and defaults to an outbound third-party endpoint (`api.open-collab.tools`) with a localStorage auth token. No second peer exists in a single-user product. |
  | `ai-registry` | Hard-codes an un-overridable startup call to `https://ai.open-vsx.org` and adds that host to the backend's outbound allowlist. R9 territory. |
  | `ai-scanoss`, `scanoss` | Only mechanism is POSTing model-generated code to `osskb.org`, with an automatic mode that fires without a per-scan gesture. |
  | `ai-llamafile` | Spawns preference-configured executables that are orphaned when the Firefox supervisor kills the backend — direct conflict with Phase 5's "working period without manual process cleanup". |
  | `ai-copilot` | Hard-codes EclipseSource's own GitHub OAuth client id inside a binary R1 requires fully renamed; its credential store silently degrades to in-memory on a bare NixOS host. |
  | `ai-codex` | Defeats the bundler with `new Function('specifier','return import(specifier)')` to load an ESM-only SDK, so a Nix-built sidecar must ship a resolvable `node_modules` copy before the feature works at all. |
  | `ai-claude-code` | **Deferred, not rejected.** Resolves `@anthropic-ai/claude-agent-sdk` at request time via `execSync('npm root -g')`, which has no writable global prefix on NixOS by design. Becomes a clean include once R8 packages and pins the SDK. |
  | `ai-google`, `ai-ollama`, `ai-hugging-face` | Additional vendor SDKs in a redistributed binary for capability `customOpenAiModels` already reaches by configuration. Re-adding any is one pinned dependency, zero code, zero URI work. |
  | `ai-history`, `ai-tool-sketchpad` | Each a full widget type owing a URI, for LLM-traffic debugging and agent authoring — R8 work a daily driver opens approximately never. |
  | `scm-extra`, `property-view`, `plugin-ext-headless`, `plugin-dev` | `scm-extra` duplicates `scm`'s own history graph; `property-view` has zero reverse dependencies and renders `stat` output; the last two each spawn additional long-lived backend processes — the orphan-process failure mode v4.0's finish line is written against. |

- **D-29:** Threat-model entry, carried to Phase 4/5: `@theia/ai-terminal`'s
  backend `ShellExecutionServer` calls `spawn(command, [], { shell: true })`
  with **no permission logic** — all approval machinery is frontend-only. The
  sidecar's per-launch token gate is the sole guard against arbitrary code
  execution on the host. This belongs in `sourcerer/INTERNAL-APIS.md`'s threat
  section when Phase 4 creates it.

### `@sourcerer/*` package layout

- **D-30:** Three packages, not one: `@sourcerer/branding`,
  `@sourcerer/customize`, `@sourcerer/tab-uris`. `@sourcerer/customize` is
  named by R4a and must exist under that name; splitting branding from URIs
  keeps the diff-against-stock verification (criterion 2) legible.
- **D-31:** `theia/package.json`'s `workspaces` gains `extensions/*` (it
  currently declares only `applications/*`), and each `@sourcerer/*` package
  is added as a **direct dependency** of `applications/browser/package.json`.
  The generator only walks the app's dependency graph — a workspace member
  that is not a dependency is invisible to `theia build`.
- **D-32:** Phase 1's **D-08 holds — still no Lerna.** The three packages have
  no build-order dependency on each other; `tsc -b` per package is sufficient.
  Revisit only if a real ordering requirement appears.

### Branding (BRAND-05)

- **D-33:** `@sourcerer/branding` ships its own welcome widget (a
  `ReactWidget` registered as a `WidgetFactory`), written from scratch rather
  than subclassing `GettingStartedWidget` — see D-24. It is a main-area tab
  and therefore owes a URI (`view:welcome`).
- **D-34:** Window and tab title are fixed by setting
  `theia.frontend.config.applicationName` in
  `theia/applications/browser/package.json` — **our** file, not a core file.
  Verified: the generated `<title>` reads it
  (`frontend-generator.ts:72`) and `WindowTitleService`'s `appName` part reads
  it via `FrontendApplicationConfigProvider.get().applicationName`
  (`window-title-service.ts:24`). It is currently unset, which is why the app
  says "Eclipse Theia".
- **D-35:** The About dialog is replaced by `rebind(AboutDialog)` to a
  subclass that overrides **`render()` entirely**, not just the title.
  Verified necessary: stock `renderHeader()` hard-links
  `https://eclipse-theia.github.io/vscode-theia-comparator/status.html`, and
  `renderExtensions()` enumerates every `@theia/*` package by name and version
  into the dialog body. Criterion 1 forbids both. `render`, `renderHeader` and
  `renderExtensions` are all `protected` — clean subclass, in-tree precedent
  in `theia-ide`'s product extension.
- **D-36:** **Theia emits no favicon at all** — verified, zero `favicon`
  references across `dev-packages` and `packages/core/src`, and the generated
  `index.html` head has no icon link. `@sourcerer/branding` injects
  `<link rel="icon" type="image/svg+xml">` from a `FrontendApplicationContribution`
  at `onStart`. Source asset is `logo/LE logo.svg` (527 bytes: three crossed
  lens shapes plus three dots), inlined as a data URI. **It must be recolored
  — its shapes are `fill:#fff`, invisible on a light background.** The other
  two files in `logo/` are treatments of the same mark: the blue PNG is a
  circular app-icon badge, `logo reworked.png` is a galaxy-render hero image;
  neither survives 16px.
- **D-37:** BRAND-06 (dev-build indicator) is **not** this phase. It draws a
  distinction between a dev build and a future packaged release, which is a
  Firefox build-configuration concern — Phase 3, as REQUIREMENTS.md's
  placement note already records.

### URI model (R4b)

- **D-38:** **Registry-first, not `Navigatable`-first.** The widget→URI
  direction is a `factoryId → URI` registry read through the public
  `WidgetManager.getDescription(widget)`. `Navigatable` is implemented **only
  on Terminal**, where the widget is a `BaseWidget` and tab-context URI
  selection is a genuine win.
  — **Reversibility:** costly — the registry is the interface
  `@sourcerer/browser-bridge` consumes post-4.0.

  **This amends URI-01 and URI-03's wording** from "implements
  `Navigatable.getResourceUri()`" to "has an address". Verified reason:
  `NavigatableWidget.is()` is `arg instanceof BaseWidget && Navigatable.is(arg)`
  (`navigatable-types.ts:41`) and that is the variant Theia's tab bar
  actually calls (`tab-bars.ts:672`, `:1016`) — while `PreferencesWidget
  extends` Lumino `Panel` (`preference-widget.tsx:35`), not `BaseWidget`. So
  Settings, the widget URI-01 names, **cannot** satisfy `NavigatableWidget.is`
  by any amount of method stamping. Honouring the literal wording would give
  Settings a URI on half of core's consumers and not the other half — a split
  invisible in review that reads as a flaky bug. Adding `Navigatable` to the
  docked views would also switch on core sites that assume "has a resource
  URI" means "is a document" (window title, Timeline retargeting,
  `resourceSet` context key).

- **D-39:** Canonical printed form is the **opaque** form `scheme:path` —
  never `scheme://authority`. Verified: the authority component is
  lower-cased on serialization, and Theia widget ids are not uniformly
  lowercase. `settings://` already normalizes to `settings:`, so URI-01's
  spelling is satisfied by the short form.
- **D-40:** **Parse leniently, emit canonically.** Every scheme's `parse()`
  reduces `scheme:x`, `scheme:/x`, `scheme:///x` and `scheme://x` to one name.
  Never match or key on `uri.toString()` — `settings://` normalizes to
  `settings:` but `settings:///` normalizes to `settings:/`, so two typeable
  forms of one address would fork into two widgets.
- **D-41:** The path is **identity and identity only** — no query, no
  fragment, no JSON, no base64, no uuid. `toString()` percent-encodes the
  query, so anything a human copies must come from `toString(true)`; the
  simplest way to keep copy-paste exact is to have nothing there to encode.
  Non-user-chosen discriminators (`EditorManager`'s random `counter`,
  terminal's wall-clock token) stay in widget options, never in the URI.
- **D-42:** **No dots in the final path segment.** `initResourceContextKeys`
  feeds a Navigatable URI into `ResourceContextKey.set`, which derives
  `resourceExtname` from `uri.path.ext` — `settings:editor.fontSize` yields
  `resourceExtname === '.fontSize'`. It also keeps a plugin custom editor's
  `*.json` basename glob from matching our addresses.
- **D-43:** Schemes. Three new, three existing that need only the widget→URI
  direction added, one session-scoped fallback:

  | Scheme | Status | Covers | Path means |
  |---|---|---|---|
  | `view:` | new | every singleton / stable-id docked or panel view — **authoritative table is `02-RESEARCH.md` §"FactoryId Table", not this list** (see correction note below) | the widget / view-container id exactly as Theia spells it — the same string in the persisted layout's `constructionOptions.factoryId` |
  | `settings:` | new | the Settings widget (`settings_widget`) | empty = the widget; non-empty = a preference id, delegated verbatim to Theia's already-bound `PreferenceOpenHandler` |
  | `terminal:` | new | terminal widgets — the only genuinely multi-instance type | a short lowercase user-facing name that **is** the instance identity |
  | `output:` | exists | output channels | `OutputUri` + `OutputContribution` already ship as an `OpenHandler`; only `getResourceUri` is missing |
  | `preference:` | exists | settings deep links | `preference-open-handler.ts` already claims it at priority 500 |
  | `vscode-extension:` | exists | the extension detail editor | `VSXExtensionEditorManager` is already a `WidgetOpenHandler` on it |
  | `webview:` | new, session-scoped | plugin-contributed webview panels | `<viewType>/<panelId>` — **documented as not restore-safe** |

  > **Correction, 2026-08-20 (Phase 2 research).** The `view:` path list
  > originally written here carried five wrong strings and omitted one shipped
  > widget. Verified against source: `typehierarchy` → **`theia-typehierarchy`**
  > (`typehierarchy-tree-widget.tsx:97`); `keybindings` →
  > **`keybindings.view.widget`** (`keybindings-widget.tsx:105`); `chat-view` →
  > **`chat-view-widget`** (`chat-view-widget.tsx:43`); `ai-config` →
  > **`ai-configuration`** (`ai-configuration-widget.tsx:34`); and
  > **`ai-sessions-widget`** (`ai-sessions-widget.tsx:33`, a standalone
  > left-panel tab shipped by `@theia/ai-ide`) was missing entirely — URI-03
  > requires it to have an address. The planner MUST transcribe
  > `02-RESEARCH.md` §"FactoryId Table", which cites file:line for every entry,
  > and must not re-derive from this decision's prose.
  >
  > Also confirmed there: plugin-contributed view containers need no lookup
  > table at all. `ViewContainerWidget.id` is assigned straight from
  > `options.id` (`view-container.ts:185`), and that id already equals
  > `plugin-view-container:<viewContainerId>` — so the widget's own `.id` **is**
  > the `view:` path.

  `view:` was chosen over a namespaced `sourcerer-view:` because URI-04's
  whole point is typeability and no collision exists — verified, the tree's
  scheme constants are `ai-variable`, `breakpointinput`, `changeset-file`,
  `debug`, `debug-breakpoint`, `devcontainer`, `diff`, `localfile`,
  `merge-editor`, `output`, `untitled`, `vscode-extension`,
  `vscode-notebook-cell`, `vscode-notebook-cell-output`, `ws`, `wsl`. D-40's
  lenient parsing is the escape hatch if a rename is ever forced.

- **D-44:** The `view:`/`settings:` handler implements **bare `OpenHandler`**,
  **not** `WidgetOpenHandler`. Verified reason: `WidgetOpenHandler.doOpen`
  hardcodes `shell.addWidget(widget, op.widgetOptions || { area: 'main' })`,
  so a URI-driven first open of Problems or Outline would attach it to the
  main area instead of its own panel — a different tab in a different place
  from the one the menu produces. The handler instead delegates to the
  already-bound `AbstractViewContribution.openView(...)`, which reads the area
  from the contribution's own `defaultViewOptions`.
- **D-45:** `canHandle` returns **1000 or 0**, synchronously, on scheme alone.
  Strictly-greater-than-zero is required: `Prioritizeable.isValid` tests
  `p.priority > 0`, contradicting `OpenHandler`'s own doc comment which says
  "nonzero". 1000 clears every in-tree bidder (editor 100, output and
  notebook-cell 200, preference/command/http/vsx/custom-editor 500) while
  leaving `defaultHandlerPriority = 100_000` — user
  `workbench.editorAssociations` — able to override, which is correct.
- **D-46:** **Open-vs-focus is free; we write none of it.** The handler
  reduces the URI to a canonical `(factoryId, options)` pair or to an
  `openView()` call and never invents its own dedup. Theia supplies the dedup
  (`WidgetManager.getOrCreateWidget` keys on
  `stableJsonStringify({factoryId, options})`), correct panel placement, the
  `mode: 'open' | 'reveal' | 'activate'` vocabulary URI-04 needs (do not
  invent another), a concurrent-open race guard
  (`WidgetManager.pendingWidgetPromises`), and restore.

  **The one thing to get right:** `createWidgetOptions` must be a pure,
  canonical, total function of the URI. `options: undefined` and a missing
  `options` hash identically, but `options: {}` does **not** — passing an
  empty object where the native path passes nothing silently forks the
  widget. This is the most likely v4.0 bug in the whole phase.
- **D-47:** Terminal identity. Names are `t<n>`, minted by
  `rebind(TerminalFrontendContribution)` to a subclass whose `newTerminal`
  injects `created` / `id` / `title` when the caller supplied none. Verified
  as needing **no core change**: `newTerminal` spreads caller options *after*
  `created` (`{ created: nextTerminalCreationToken(), ...options }`), so a
  caller-supplied value wins, and every terminal binding in `@theia/terminal`
  is `toService(TerminalFrontendContribution)` on a
  `toSelf().inSingletonScope()` binding, so one rebind reaches
  `TerminalService`, the commands and the quick-open path. Both fields land in
  the persisted `constructionOptions` and replay verbatim on restore, which is
  what makes the address survive a reload. The allocator scans
  `widgetManager.getWidgets('terminal')` so a restored layout's names are not
  reused. Explicitly rejected as path content: the backend `terminalId`
  (random), and the wall-clock creation token (not typeable).
- **D-48:** A **stale terminal address creates a fresh shell under that name**
  rather than erroring — the tmux named-target model, and the behaviour that
  makes `terminal:build` worth typing. `terminal:` with an empty path means
  the active terminal, or a new one if none exists. Renaming a tab changes the
  label only; the address stays the `created` name, because re-keying would
  require disposing and recreating the widget.
- **D-49:** Coverage boundary is **every widget that owns a shell tab**.
  Included: side-panel and bottom-panel views — they own real tabs, and the
  `view:` handler reaches them correctly precisely because D-44 delegates area
  placement. Included **as containers, not as parts**: the Explorer is
  `view:explorer-view-container`. Excluded: `ViewContainerPart` sub-views
  (`files`, `theia-open-editors-widget`, debug's five, scm's three, test's
  two, all of timeline) — `SidePanelHandler.expand` only searches top-level
  `dockPanel.widgets()`, so a part is a collapsible section, not a tab, and
  "no tab without a URI" does not reach it. They stay addressable later at
  zero design cost because `shell.activateWidget(id)` already walks down
  through `TrackableWidgetProvider`.

  Note for the post-4.0 mirror: **ViewContainer composition mutates at
  runtime** — a user can drag Debug's variables part into the Explorer — so a
  container URI names a box, never a fixed set of contents.
- **D-50:** Because `@theia/plugin-ext` ships (D-20), the `view:` table is a
  static map **plus** a `PluginViewRegistry` lookup for runtime-registered
  view containers. Their ids are derived deterministically
  (`PLUGIN_VIEW_CONTAINER_FACTORY_ID + ':' + viewContainerId`), so they
  round-trip cleanly. A handler registered after the first `open()` **must**
  go through `DefaultOpenerService.addHandler()` (which returns a
  `Disposable`) — `ContributionProvider.getContributions()` caches its array
  on first call and nulls its container reference, making a late
  `bind(OpenHandler)` permanently invisible.
- **D-51:** Three carve-outs are unavoidable and get **documented under
  URI-04 rather than engineered around**:
  1. `@theia/output`'s widget is a singleton whose content swaps per channel,
     so `output:A` and `output:B` resolve to the same tab.
  2. `@theia/editor-preview` swaps the document a tab shows without user
     navigation, so a tab's resource URI mutates in place.
  3. `notebook`'s `vscode-notebook-cell:` handler is a registered scheme that
     opens no tab and returns undefined.
  4. `webview:` addresses only round-trip within a session — panel ids are
     minted per `createWebviewPanel` call by the plugin host, so without a
     `WebviewPanelSerializer` the URL restores a blank panel. Documented
     degradation, not a v4.0 bug.
- **D-52:** Save-As guard. `FilesystemSaveableService.canSaveAs` gates on
  `Saveable.isSource(widget) && … && Navigatable.is(widget) && widget.getResourceUri() !== undefined`
  (`filesystem-saveable-service.ts:46-52`), wired to `SAVE_AS` enablement at
  `common-frontend-contribution.ts:749`. So anything that gains a
  `getResourceUri` must be checked against `Saveable.isSource` first, or
  "Save As" lights up on a view and tries to write a `view:` URI through
  `FileService`. (Note: returning `undefined` from `createMoveToUri` does
  **not** mitigate this — `createMoveToUri` is not in the gate.)
- **D-53:** Acceptance test per scheme, one line each: paste the URI into a
  fresh session and assert the **state** round-trips —
  `registry.uriOf(await open(u)).toString(true) === u` — not merely that a
  widget appeared. Plus, per scheme, open via both the menu and the URI and
  assert `widgetManager.getWidgets(factoryId).length === 1`. The in-tree
  failure to avoid is `output:<channel>`, which validates its scheme and then
  discards the channel.

### Customization layer (R4a)

- **D-54:** The user CSS file is `$THEIA_CONFIG_DIR/customize.css`, addressed
  from the frontend as `user-storage:/user/customize.css` via
  `UserStorageUri.resolve('customize.css')`. It lands next to `settings.json`
  and `keymaps.json` where a human already looks, outside every workspace and
  unaffected by workspace switching.
- **D-55:** The Firefox supervisor (Phase 4) sets
  `THEIA_CONFIG_DIR=$XDG_CONFIG_HOME/sourcerer` on the sidecar spawn — the
  highest-priority branch of `EnvVariablesServer.createConfigDirUri()`,
  XDG-correct, branded, and it makes the surprising portable-`data/` branch
  unreachable (a stray `applications/browser/data/` directory would otherwise
  relocate the whole config dir with no warning). **The supervisor must also
  `mkdir -p` it** — Theia only creates the config dir on the portable branch,
  never on the `THEIA_CONFIG_DIR` or `~/.theia` branches, and an absent
  directory leaves the config-dir watch stuck in a 500 ms `fs.stat` poll loop
  with no hot reload. Phase 2 can set the env var by hand for `yarn watch`;
  Phase 4 owns making it permanent.
- **D-56:** `@theia/userstorage` is added as an **explicit direct dependency**
  even though it arrives transitively through `@theia/preferences` today —
  dropping preferences later would silently take both the scheme and the free
  watch with it, with no compile error.
- **D-57:** Read is `(await fileService.read(uri)).value` with a `.catch()`
  treating any failure as "absent, empty". No backend contribution, no express
  route, no static-file serving — the frontend's provider already proxies the
  backend's `DiskFileSystemProvider` with no root restriction. State plainly
  in the phase doc that this is **pre-existing reach**: the workspace was
  never a sandbox, and the file's location is not a security boundary.
- **D-58:** Injection is a bare `document.createElement('style')` appended to
  `document.head` in `FrontendApplicationContribution.onStart`, with the
  file's literal bytes in `textContent`. Not `DecorationStyle.createStyleElement`
  — it hard-sets `media='screen'`, which would silently exclude print. Not
  `createStyleSheet` + `insertRule` — `textContent` lets the browser's parser
  drop invalid rules silently instead of throwing on malformed user input. Not
  a `<link>` — a miss 404s through express's default handler with a
  `text/html` body, which the browser refuses to apply as a stylesheet.
- **D-59:** Cascade order is mechanical, not luck. `onStart` runs after every
  core style contribution and before the shell exists
  (`FrontendApplication.start()` awaits `startContributions()`, then
  `attachShell(host)`), so the layer is present on first paint with no flash.
  Theia's bundled CSS is a single `<link href="./bundle.css">` earlier in
  document order. Two Theia sheets *are* injected later — Monaco's
  `<style class="monaco-colors">` and one
  `<style id="<terminalId>-terminal-style">` per colored-icon terminal — both
  handled with the `PluginSharedStyle.update()` idiom: on every reload,
  dispose the old element and append a fresh one, re-asserting last position.
  Theme switches never displace it (themes are inline custom properties on
  `documentElement` plus a body class), so user CSS written against
  `var(--theia-*)` follows the active theme free. **Rejected:** `@layer`
  (points the wrong way — layered rules lose to unlayered, and all of Theia's
  bundle is unlayered), and a `MutationObserver` on head (a permanent observer
  firing on every editor and terminal open).
- **D-60:** Hot reload subscribes to `fileService.onDidFilesChange` filtered
  on `e.contains(cssUri)` — **no watcher of our own**.
  `UserStorageContribution.createProvider` already holds a recursive watch on
  the whole config dir, activated at startup by `@theia/preferences`. Two
  things to code around: one physical save fires **twice** (once as `file:`
  from the disk provider, once as `user-storage:` remapped by the delegating
  provider), so filter on one scheme and debounce ~150 ms with `p-debounce`
  (already a dependency); and editors save by truncate-then-write or atomic
  rename, so a mid-save read can return empty or partial content — **keep the
  last good content on a read error** rather than blanking the user's styling.
- **D-61:** **Never create the file.** Absence is the untouched default; a
  written starter file would be a visual change by definition. Inject the
  file's literal bytes and nothing else — no wrapper selector, no `:root {}`,
  no body class, no comment banner. An empty `<style></style>` in head has
  provably zero effect, and the whole CUST-01 guarantee is keeping it that
  way.
- **D-62:** The dev flag is a boolean `sourcererPrivilegedJs` under
  `theia.frontend.config` in `applications/browser/package.json`, read as
  `FrontendApplicationConfigProvider.get()['sourcererPrivilegedJs']` **inside
  the `ContainerModule` callback**, wrapping the privileged bindings in a
  plain `if` — so the `bind()` is skipped entirely rather than guarded.
  — **Reversibility:** reversible — one package.json key and one `if`.

  Verified both halves: an undeclared field under `theia.frontend.config`
  survives `ApplicationPackage.props` (`deepmerge(ApplicationProps.DEFAULT, theia)`,
  and `ApplicationConfig` declares `readonly [key: string]: any`) and is
  `JSON.stringify`d into the `FrontendApplicationConfigProvider.set(...)` call
  emitted at the top of `src-gen/frontend/index.js` — well before
  `new Container()` and the first `container.load`. This is the extension
  point core itself uses for the same shape of decision
  (`warnOnPotentiallyInsecureHostPattern`), and conditional binding inside a
  ContainerModule is already idiomatic in core (`if (!isBound(FuzzySearch))`).

  **Rejected, with reasons:** a URL query param is attacker-selectable (the
  connection-token middleware issues a valid cookie on any HTTP request and
  core explicitly exempts the initial HTML page and static assets);
  `window.location.hash` is owned end-to-end by `@theia/workspace`; a backend
  env var read through `EnvVariablesServer` **cannot gate a binding at all**,
  because every method on that proxy is async RPC resolving long after
  `container.load()` — it could only produce the runtime no-op guard CUST-02
  forbids.
- **D-63:** Accepted cost of D-62: the flag is **baked at build time**.
  `theia start` never runs the generator — only `theia generate` / `theia build`
  do — so flipping it needs a rebuild, not a restart. That is the right
  default for a developer-only flag, and it is the property that makes a
  release build un-talkable-into binding the layer by any runtime input. If
  hot-flip later proves necessary, the supported route is a
  `BackendApplicationContribution` pushing a handler onto the injected
  `EarlyExpressMiddleware` to splice a `<script>` global into the served
  index.html — **ANDed** with the build-time field so a release build still
  cannot be enabled by env alone.
- **D-64:** CUST-02's proof is
  `window.theia.container.isBound(SourcererPrivilegedJs) === false`, evaluated
  **in the running page**, against a release-configured `theia build`. The
  container is exposed unconditionally by the generated bootstrap in every
  build, so no test harness is needed. Two ways this passes vacuously and must
  be avoided: running against `src-gen` rather than `lib` (the backend prefers
  `lib/backend/main.js` and serves `lib/frontend`, so hand-edited `src-gen`
  changes nothing), and grepping source instead of evaluating in the page.
- **D-65:** Honest caveat, recorded so it is not discovered at verification:
  the **binding** is absent, but the **class is still in `bundle.js`** —
  tree-shaking cannot remove code behind a runtime config read. As CUST-02 is
  worded ("no privileged binding exists at runtime"), D-62 satisfies it
  literally. If it is ever reworded as "not present in the artifact", only a
  separate app target satisfies it, at the cost of a second build and
  smoke-test matrix.
- **D-66:** The phase doc must state the JS layer's security posture
  **accurately and without overclaiming**. The generated frontend publishes
  the entire DI container on `window.theia.container` in every build,
  development and production alike — so this flag is **not** a boundary
  against script already executing in the Theia page; such script owns the
  container regardless. What the flag decides is exactly one thing: whether
  Sourcerer auto-executes a user-supplied JS file from disk at startup.
  Reinforcing context for Phase 4's threat model: the connection token does
  not protect the page or its static assets, and the WS origin validator
  returns true when the `Origin` header is absent, so anything that can reach
  `127.0.0.1:PORT` can load the Theia page.
- **D-67:** When the flag is on, the layer executes
  `<configDir>/customize.js` after `onStart`, handing it a small stable
  surface: the DI container, the shell, and the tab-URI registry. If that
  layer registers URI schemes it must use `DefaultOpenerService.addHandler()`
  per D-50.

### Verification

- **D-68:** Criterion 2 ("zero changes inside `@theia/*`") is proven by a
  checked-in script, not a manual pass — it must be re-runnable in Phase 3+
  and in CI. The natural shape is a checksum comparison of
  `node_modules/@theia/*` against a freshly-resolved install of the same
  pinned versions.

- **D-69:** **The headless verification harness is the Firefox we already
  build — `objdir/dist/bin/firefox` — driven over WebDriver BiDi. Not
  Playwright, not Puppeteer, not geckodriver.** No new npm dependency is added
  to the `theia` workspace for testing.
  — **Reversibility:** reversible — the harness is a few plain `.mjs` scripts;
  swapping the driver later touches only them.

  **Supersedes** RESEARCH.md §6's Playwright-based mechanism, its
  "Environment Availability" row for the `playwright` package, and its
  `[SUS]` package-legitimacy gate for `playwright` / `@playwright/test`
  (the gate becomes moot — there is no package to vet).

  **Verified live on this host, 2026-08-20**, against the Phase 1 build
  (`Mozilla Firefox 153.1.0esr`). Every assertion Phase 2 needs was executed
  end to end, not reasoned about:

  | Phase 2 check | Mechanism | Probe result |
  |---|---|---|
  | CUST-01 screenshot | `--headless --window-size 800,600 --screenshot <path>` | 800×600 PNG written, valid magic bytes |
  | BRAND-05 title | BiDi `script.evaluate` → `document.title` | `"Sourcerer"` |
  | BRAND-05 favicon | `(document.querySelector('link[rel="icon"]')||{}).type` | `"image/svg+xml"` |
  | BRAND-05 no-Theia | `/Theia\|Eclipse/i.test(document.body.innerText)` | `false` |
  | **CUST-02 negative** | `window.theia.container.isBound(Symbol.for('SourcererPrivilegedJs'))` | `false` |
  | **CUST-02 positive control** | `window.theia.container.isBound(Symbol.for('Present'))` | `true` |

  Flags confirmed present in `objdir/dist/bin/firefox --help`: `--headless`,
  `--screenshot [<path>]`, `--window-size`, `--remote-debugging-port`,
  `--remote-allow-hosts`, `--remote-allow-origins`,
  `--remote-allow-system-access`, `--marionette`, `--profile`,
  `--new-instance`.

  **Why this and not Playwright — three independent reasons:**
  1. **Right engine.** v4.0 ships a Firefox fork. A harness driving headless
     Chromium proves Theia works in an engine Sourcerer does not ship. Driving
     the exact `153.1.0esr` build that becomes Sourcerer tests the real
     substrate, which makes these scripts reusable as Phase 4/5 integration
     tests rather than throwaway.
  2. **Zero dependencies.** The **pinned** `nodejs_22` exposes a global
     `WebSocket`, so the BiDi client is ~40 lines of stdlib. Nothing is added
     to `theia/package.json`, so nothing new can drift against the exact-pin
     discipline (D-19), and criterion 2's "diff against the pinned release"
     stays clean.

     **Re-verified 2026-08-20 against the pinned toolchain, not the host's:**
     the first probe ran under the system Node (v24.19.0), which is *not* what
     Phase 1 D-16 pins. Re-run inside `nix develop .#theia`:
     `node --version` → **`v22.23.2`**, `typeof WebSocket` → **`function`**,
     and all six assertion shapes returned identical results. The
     zero-dependency claim therefore holds under the toolchain this project
     actually ships, not merely under a newer host Node. Had it not, the
     honest fallback was `ws` — which would have cost this decision its second
     reason, so the check was worth running rather than assuming.

     Also disproven while checking: `objdir/dist/bin/firefox` does **not**
     require `nix develop .#firefox` to run. Both probes launched it from a
     plain shell and from the `theia` shell; `--headless`, `--screenshot` and
     the Remote Agent all worked in each. The harness does not need to
     shell-hop.
  3. **NixOS.** Playwright downloads generic-Linux browser ELFs that do not
     run on NixOS without `nixpkgs.playwright-driver` +
     `PLAYWRIGHT_BROWSERS_PATH` + `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`
     or `nix-ld`. RESEARCH.md's Wave 0 line
     (`yarn add --dev playwright && npx playwright install chromium`) does not
     account for that friction on the only delivery platform v4.0 targets.

  **Proven driver shape — transcribe this, do not re-derive it.** Launch:

  ```
  objdir/dist/bin/firefox --headless --profile <tmpdir> \
    --remote-debugging-port=<port> --remote-allow-hosts 127.0.0.1 <url>
  ```

  The Remote Agent writes `WebDriver BiDi listening on ws://127.0.0.1:<port>`
  to **stderr** — poll for that line rather than sleeping. Then connect to
  `ws://127.0.0.1:<port>/session` with Node's global `WebSocket` and issue, in
  order: `session.new` (`{capabilities:{}}`) → `browsingContext.getTree` (take
  `contexts[0].context`) → `script.evaluate`
  (`{expression, target:{context}, awaitPromise:true}`), reading the result at
  `result.result.value`. Close with `session.end`. Correlate responses by the
  `id` field; a response with `type === 'error'` carries `error` and `message`.

  **Still to settle at implementation time (not a blocker):** comparing two
  PNGs for CUST-01. Byte-hash equality may be flaky if Firefox writes varying
  metadata; if it is, decode raw pixels with python3 `zlib` + `struct` (~15
  dependency-free lines) rather than adding an image library. Check which is
  needed by taking two screenshots of an unchanged page and diffing them.

  **Process hygiene:** every harness script must kill its Firefox and remove
  its temp profile in a `finally`. Phase 5's whole subject is orphaned
  processes — the test harness must not create them.

### Claude's Discretion

The user did not specify these; treat the leanings as defaults, not
constraints.

- **Brand copy** — the exact welcome-widget headline and body text, the About
  dialog's product blurb, and whether a tagline exists at all. Leaning: name
  only ("Sourcerer"), version, and a link set pointing at the repo; no
  invented marketing copy. Ask before writing anything user-facing beyond the
  product name.
- **Which logo treatment goes where** — the favicon source is settled (D-36).
  Leaning: the same recolored SVG in the welcome widget and About dialog;
  the blue circular badge is the natural source for a future packaged app
  icon (Phase 3, BRAND-06 territory).
- **`view:` path spelling for the welcome widget** — `view:welcome` vs
  `view:sourcerer-welcome`. Leaning: whatever the `WidgetFactory` id is, per
  D-43's rule that the path is the factory id verbatim.
- **Whether v4.0 exposes extracted-widget secondary windows at all.** If it
  does, D-58's CSS layer needs ~20 more lines mirroring
  `StylingService.registerWindow` / `SecondaryWindowHandler.onWillAddWidget`,
  because `secondary-window.html` has its own `document.head`. Leaning: no —
  `@theia/secondary-window` is excluded (D-28) and extracted widgets
  contradict R4b anyway.
- **Default `theia.frontend.config` beyond `applicationName`** — e.g.
  `preferences` defaults shipping D-25's workspace-trust setting. Leaning:
  keep the default block minimal and put anything debatable in a documented
  `settings.json` default rather than baking it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative requirements and architecture
- `docs/PRODUCT-REQUIREMENTS.md` — R1–R9, CONFIRMED 2026-08-19. R1 (rebrand),
  R3 (extension-based internals), R4 (incremental growth), R4a
  (customization bridge), R4b (universal tab URIs) are this phase.
- `docs/research/sourcerer-architecture.md` — authoritative architecture;
  defines `theia/` as an independent npm workspace with an
  `applications/browser` target, and §2 defines the post-4.0 bridge this
  phase must not weld against.
- `.planning/REQUIREMENTS.md` — BRAND-05, CUST-01, CUST-02, URI-01, URI-02,
  URI-03, URI-04 are this phase's requirements. **Note D-38 amends URI-01 and
  URI-03's wording** from "implements `Navigatable.getResourceUri()`" to "has
  an address".
- `.planning/ROADMAP.md` §"Phase 2: Sourcerer Theia Extensions" — the five
  success criteria this phase is verified against.

### Theia extension model and shell seams
- `docs/research/extension-model-decisions.md` — D1 (npm is the registry for
  `@sourcerer/*`), D4 (AI chat variants ship as agents, not extensions), D5
  (single anti-corruption layer, Firefox side only — Theia's public APIs mean
  discipline suffices on our side).
- `docs/research/gui-customizability-model.md` — G3 (ship the CSS layer, gate
  the JS one) and G5 (structural shell work by `ApplicationShell` subclassing)
  are the decisions this phase implements. §6a names the
  `DecorationStyle.createStyleElement` hook — **D-58 deliberately does not use
  it**; read D-58's reason before "correcting" that. §7 documents the rebind
  seams and the `.toService()`-not-`.to()` rule. §8 documents that extension
  discovery walks the app's `dependencies` with zero registry calls, which is
  why D-31 requires a direct dependency entry.
- `docs/research/tab-management-research/05-theia-shell-customization.md` §2
  — the original "does every tab have a URL" analysis and its D4 ("start work
  at per-widget `Navigatable`/URI schemes — the only part reusable under
  either layer split"). Its "Open questions" section flags URL semantics as
  the cheap-now-miserable-later decision; D-39 through D-51 settle it.
- `docs/research/tab-management-research/04-everything-is-a-url.md` §1 and §9
  — the URI-as-universal-handle model and what survives vs breaks when one
  tab system holds heterogeneous resources.

### Prior phase
- `.planning/phases/01-build-infrastructure/01-CONTEXT.md` — D-05/D-06/D-07
  (the real `theia/` workspace, `applications/browser` only, no Electron),
  D-08 (no Lerna — still holds, see D-32), D-09 (exact 1.74.1 pins plus
  `resolutions` — see D-19 for the `monaco-editor-core` exception),
  D-16 (`nodejs_22`), D-17 (Yarn Classic).
- `.planning/phases/01-build-infrastructure/01-VERIFICATION.md` — what Phase 1
  actually proved.
- `docs/BUILD.md` — the `--ignore-scripts` + explicit `node-gyp rebuild`
  install sequence. D-26's ripgrep handling must extend it, not bypass it.

### Project rules
- `CLAUDE.md` — hard rules (never fork Theia core, never modify Gecko, no
  custom chrome in v4.0, design for the bridge) and the space-free-path
  constraint.
- `.claude/CLAUDE.md` — stack table and "What NOT to Use" list.

### Read-only reference sources (not in this repo)
- Theia framework v1.74.1: /home/chris/Vibe Coding/TheiaIDE/sources/theia —
  every file path cited in the decisions above is relative to this root.
- `theia-ide` product extension:
  /home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product
  — the in-tree precedent for `rebind(AboutDialog)` and for replacing a
  widget by binding a second `WidgetFactory` with the same id.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `theia/` yarn workspace, built and proven in Phase 1 — 11 `@theia/*`
  packages at exact 1.74.1, `applications/browser` as the only application
  target, `node-pty` compiled against the pinned Node 22. Phase 2 extends it;
  it does not restructure it.
- `logo/` — three treatments of one mark. `LE logo.svg` (527 bytes: three
  crossed lens shapes plus three dots, `fill:#fff`) is the vector master and
  the favicon source per D-36. `LE blue C bord@4x-8.png` (4011×4014) is a
  circular app-icon badge. `logo reworked.png` (3668×3057) is a galaxy-render
  hero image. **`logo/` is currently untracked — Phase 2 must add it to git.**
- `flake.nix` — the `theia` dev shell (node 22, yarn 1.x, node-gyp
  toolchain). Phase 2 uses it and should not need to change it, except
  possibly for D-26's ripgrep binary.

### Established Patterns
- Exact-pin + `resolutions` (Phase 1 D-09) — D-19 extends the same block to
  49 packages, with `monaco-editor-core` at its own version.
- `--ignore-scripts` install with explicit native rebuilds, documented in
  `docs/BUILD.md` with its audit reason so it is never simplified back to a
  plain `yarn install`. D-26 extends this.
- Theia's own rebind idioms, verified in-tree: `rebind(X).to(Y)` for class
  tokens, a second `WidgetFactory` with the same id for widget replacement
  (last wins), `.toService()` not `.to()` for late-resolved aliases, and
  `bindViewContribution` singletons injectable by class token.

### Integration Points
- `theia/package.json` `workspaces` — gains `extensions/*` (D-31).
- `theia/applications/browser/package.json` — the dependency list (D-19), the
  `theia.frontend.config` block (D-34, D-62), and direct dependency entries
  for each `@sourcerer/*` package (D-31). This one file is where most of the
  phase's non-code configuration lands.
- `@sourcerer/tab-uris`'s registry is the interface `@sourcerer/browser-bridge`
  consumes post-4.0 — it is the phase's most load-bearing public shape.
- `THEIA_CONFIG_DIR` — set by hand for `yarn watch` in Phase 2, owned
  permanently by the Phase 4 supervisor (D-55).

### Environment constraint
The repo must stay at a space-free path (`/home/chris/coding/sourcerer`).
`mkShell` appends `-rpath $PWD/outputs/out/lib` to the space-separated
`NIX_LDFLAGS`; a space in `$PWD` makes the cc-wrapper split it and every
native link step fails. Phase 2 drives that linker through node-gyp.

</code_context>

<specifics>
## Specific Ideas

### Verification performed during this discussion (2026-08-20)

Every claim below was checked against the pinned v1.74.1 tree, not assumed.
Two multi-agent investigations (24 agents, all 77 packages in the tree read
from source) produced the analysis; the load-bearing mechanism claims were
then re-verified by hand because the two investigations **contradicted each
other**.

| Claim | Result |
|---|---|
| `Navigatable.is()` is duck-typed | ✅ `isObject(arg) && 'getResourceUri' in arg && 'createMoveToUri' in arg` — `navigatable-types.ts:34-37` |
| …but `NavigatableWidget.is()` also requires `instanceof BaseWidget` | ✅ `navigatable-types.ts:41` — **and this is the variant the tab bar calls** (`tab-bars.ts:672`, `:1016`) |
| `PreferencesWidget` is a `BaseWidget` | ❌ `extends Panel` — `preference-widget.tsx:35`. Settings can never satisfy `NavigatableWidget.is`. **This is why D-38 is registry-first.** |
| `TerminalWidget`, `ViewContainer`, `OutlineViewWidget` are `BaseWidget`s | ✅ all three |
| `WidgetManager` fires `onDidCreateWidget({factoryId, widget})` | ✅ `widget-manager.ts:250` |
| Save-As gate content | ✅ `Saveable.isSource && … && Navigatable.is && getResourceUri() !== undefined` — `filesystem-saveable-service.ts:46-52`, wired at `common-frontend-contribution.ts:749`. `createMoveToUri` is **not** in the gate. |
| Theia emits a favicon | ❌ zero `favicon` references in `dev-packages` or `packages/core/src`; generated `index.html` head has no icon link |
| `<title>` source | ✅ `frontend-generator.ts:72` reads `props.frontend.config.applicationName` |
| `WindowTitleService` `appName` source | ✅ `window-title-service.ts:24`, same config field |
| About dialog leaks Theia identity | ✅ `renderHeader()` hard-links the eclipse-theia comparator; `renderExtensions()` lists every `@theia/*` package by name and version — `about-dialog.tsx:68-111` |
| `@theia/getting-started` hardcoded Eclipse/Theia URLs | ✅ 8 of them |
| Scheme collisions for `view:` / `settings:` / `terminal:` | ✅ none — tree constants are `ai-variable`, `breakpointinput`, `changeset-file`, `debug`, `debug-breakpoint`, `devcontainer`, `diff`, `localfile`, `merge-editor`, `output`, `untitled`, `vscode-extension`, `vscode-notebook-cell`, `vscode-notebook-cell-output`, `ws`, `wsl` |
| `@theia/monaco-editor-core` version | ⚠️ **1.108.201, not 1.74.1** — the VS Code repackage, versioned on VS Code's line. Confirmed in `packages/monaco/package.json` and the installed tree. |
| `@theia/plugin`, `application-package`, `ovsx-client`, `request` versions | ✅ all 1.74.1 |
| theia-ide composes how many `@theia/*` | 69. Sourcerer's set is 49. |
| `bindViewContribution` sites across all 77 packages | 28 — the URI ceiling was always bounded, not open-ended |

### The finding that sized the phase

`WidgetOpenHandler.doOpen` hardcoding `{ area: 'main' }` (D-44) and
`Prioritizeable.isValid` testing `> 0` against a doc comment that says
"nonzero" (D-45) are both the kind of detail that costs a day of debugging if
discovered during execution rather than planning. They are written down here
precisely so they are not rediscovered.

The single most likely bug in the whole phase is D-46's:
`options: undefined` and a missing `options` hash identically under
`stableJsonStringify`, but `options: {}` does not. Passing an empty object
where the native code path passes nothing silently forks the widget, and the
symptom — two Settings tabs, one from the menu and one from a URL — looks like
a URI bug rather than an options-shape bug.

</specifics>

<deferred>
## Deferred Ideas

- **`@sourcerer/browser-bridge`** — the Theia half of the mirror/proxy bridge,
  hiding Theia's tab bar by CSS and pushing active-widget URIs into the chrome
  mirror. Post-4.0 (CHROME-01). Phase 2's contribution is the tab-URI registry
  it will consume (D-38); nothing else.
- **Chrome-side URL bar consuming these URIs** — post-4.0 (CHROME-02).
  Confirmed throwaway if built Theia-side, per
  `05-theia-shell-customization.md` D1.
- **Firefox-side branding** (`MOZ_APP_NAME`, `branding/` tree, profile dir,
  disabling auto-update, dev-build indicator) — Phase 3, BRAND-01 through
  BRAND-04 and BRAND-06.
- **`sourcerer.xhtml`, `SourcererAPI.sys.mjs`, `TheiaService.sys.mjs`** —
  Phase 4. D-55's `THEIA_CONFIG_DIR` and `mkdir -p` land there permanently.
- **`sourcerer/INTERNAL-APIS.md`** — Phase 4 creates it. D-29's
  `ai-terminal` arbitrary-execution note and D-66's token/origin notes belong
  in its threat section.
- **Self-hosted Open VSX registry** — R9, post-4.0. D-21's explicit
  `VSX_REGISTRY_URL` is the seam that makes repointing a config change.
- **Sourcerer's own AI layer** (own agents, `customAgents.yml`, Firefox AI
  Runtime) — R8, post-4.0. Replaces `@theia/ai-ide`'s vendor lineup (D-22).
- **`@theia/ai-claude-code`** — deferred, not rejected. Becomes a clean
  include once R8 packages and pins `@anthropic-ai/claude-agent-sdk` rather
  than resolving it through `npm root -g`, which has no writable prefix on
  NixOS.
- **Addressing `ViewContainerPart` sub-views** (`files`,
  `theia-open-editors-widget`, debug's five, scm's three) — excluded from
  v4.0 by D-49, and addressable later at zero design cost because
  `shell.activateWidget(id)` already walks down through
  `TrackableWidgetProvider`.
- **A `WebviewPanelSerializer` so `webview:` URLs survive a restart** —
  post-4.0. D-51 documents the degradation instead.
- **Hot-flipping the CUST-02 dev flag without a rebuild** — the
  `EarlyExpressMiddleware` route in D-63, only if the rebuild becomes a daily
  annoyance, and ANDed with the build-time field.

</deferred>

---

*Phase: 2-Sourcerer Theia Extensions*
*Context gathered: 2026-08-20*
