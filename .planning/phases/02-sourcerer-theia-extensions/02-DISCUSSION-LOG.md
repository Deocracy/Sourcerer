# Phase 2: Sourcerer Theia Extensions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 2-Sourcerer Theia Extensions
**Areas discussed:** Shipped widget inventory, URI scheme semantics, Customize layer plumbing, Branding identity & assets

---

## How this discussion ran

The first pass presented the four areas as a menu of options built on surface
framing. The user rejected that outright — *"OK I have no idea. look at each
component and make your recommendation based on that."* — so the workflow was
restarted as investigation-first.

Two multi-agent investigations were run against the read-only Theia v1.74.1
sources:

1. **Package inventory** — 15 agents, all 77 packages in the tree read from
   source, then a dependency-closure check, three adversarial critique lenses
   (daily-drivability, URI tax, substrate), and a synthesis pass.
2. **URI + customization design** — 9 agents across six source dives (opener
   mechanics, widget identity and restore, widget inventory semantics, prior
   art, CSS layer, dev flag), then two adversarial verification lenses and a
   recommendation pass.

The two investigations **contradicted each other** on the central mechanism.
That contradiction was resolved by hand-verification, and the resolution is
the phase's most important decision (D-38).

Only three questions were put to the user, all of them product-intent calls
that evidence could not settle. Each was presented with a recommendation
rather than as an open menu.

---

## Shipped widget inventory

Not asked as a menu. Investigated, then recommended: **49 `@theia/*` packages**.

Findings that decided it:

- `theia-ide`, the closest analog, composes 69 packages. Sourcerer's app
  composed 11 at the end of Phase 1.
- `@theia/plugin-ext` picks most of the app, not our preferences — it
  hard-depends on 12 other packages including the entire AI core.
- Across all 77 packages there are only 28 `bindViewContribution` sites, so
  the URI ceiling was always bounded.
- Several packages were excluded on **verified security grounds** rather than
  taste: `mini-browser` (unauthenticated arbitrary file read), `ai-mcp-server`
  (unconditional unauthenticated `/mcp` mount), `metrics` (unauthenticated
  `/metrics`).
- `@theia/toolbar` was excluded specifically because it hard-rebinds
  `ApplicationShell` — the binding slot `@sourcerer/browser-bridge` needs
  post-4.0.

### Product-intent question 1 — the AI agent suite

| Option | Description | Selected |
|--------|-------------|----------|
| Ship ai-ide (recommended) | Include it plus two `@sourcerer` rebinds; accept shipping EclipseSource's agent lineup until R8 replaces it | ✓ |
| Exclude ai-ide, no chat in v4.0 | Drop the chat view and amend URI-03 and criterion 4 to stop naming it | |
| Ship chat, author our own agents now | Include `ai-chat-ui` but write `customAgents.yml` ourselves — pulls R8 work forward for a thinner result | |

**User's choice:** Ship ai-ide.
**Notes:** Evidence settled the mechanics completely — `ai-chat` binds zero
`ChatAgent`, and `ai-ide` is the only rebind of `AIActivationService` against
`ai-core`'s hardcoded `isActive = true`, which `plugin-ext` forces into the app
regardless. What evidence could not settle was willingness to ship another
vendor's opinionated agents inside a trademark-renamed product.

### Product-intent question 2 — the extension registry

| Option | Description | Selected |
|--------|-------------|----------|
| Ship vsx-registry → open-vsx.org (recommended) | Set `VSX_REGISTRY_URL` explicitly, repoint at our own mirror in R9 | ✓ |
| Defer — build-time extension set only | No runtime extension installation until R9 | |

**User's choice:** Ship vsx-registry.
**Notes:** Evidence killed the deferral's premise: `VSXExtensionResolver` is
the only `PluginDeployerResolver` accepting a `vscode-extension:` URI, and
`installFromVSIX` is registered with an id and no label, which Theia's palette
filters out. Deferring means no runtime extension installation of any kind.

### Product-intent question 3 — model-provider posture

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud-capable, no default key (recommended) | Ship `ai-anthropic` + `ai-openai`, no key, no default model; local models via `customOpenAiModels` | ✓ |
| Local-first as a stated claim | Add `ai-ollama`, default to a local endpoint, ship no cloud provider | |
| Cloud-first with a shipped default provider | Best out-of-box, worst fit for a privacy-branded fork | |

**User's choice:** Cloud-capable, no default key.
**Notes:** v4.0 makes no "nothing leaves the host" product claim. If that ever
becomes a stated promise, the defaults and `ai-ollama` both come back.

### Where the recommendation overrode the agents

The analysis agents excluded `@theia/getting-started` because its content is 8
hardcoded eclipse-theia and theia-ide.org URLs inside a product R1 requires
fully renamed. The reasoning was right but the conclusion broke BRAND-05 and
criterion 1, which both require a branded welcome widget. Resolved by
excluding the package *and* writing `@sourcerer`'s own welcome widget — less
code than overriding every string, with nothing to scrub.

---

## URI scheme semantics

Not asked as a menu. Investigated, then recommended.

The two investigations disagreed. Investigation 1 concluded that
`Navigatable.is()` being duck-typed meant one ~50-line contribution could
stamp `getResourceUri` onto any widget. Investigation 2 concluded that would
not work for Settings.

Hand-verification confirmed investigation 2:

- `NavigatableWidget.is()` is `arg instanceof BaseWidget && Navigatable.is(arg)`
  (`navigatable-types.ts:41`), and that is the variant Theia's tab bar calls.
- `PreferencesWidget extends Panel` (`preference-widget.tsx:35`) — raw Lumino,
  not `BaseWidget`.

So Settings, the widget URI-01 names by name, can never satisfy
`NavigatableWidget.is`. The design became registry-first.

### Product-intent question 4 — requirement wording

| Option | Description | Selected |
|--------|-------------|----------|
| Registry is the answer; Navigatable only on Terminal (recommended) | Amend URI-01/URI-03 to require an address per tab, delivered by a factoryId→URI registry | ✓ |
| Honour the wording literally on every widget | Stamp both methods via `onWillCreateWidget` — Settings still needs a carve-out, and eight core sites switch on | |
| Literal wording, and fix Settings too | Replace `PreferencesWidget` with a `BaseWidget` subclass — rejected on evidence: its injections are bound only in a child container, so the subclass is unresolvable | |

**User's choice:** Registry is the answer.
**Notes:** This is a change to the requirement's wording, not a technical
unknown. Both readings were implementable at similar cost; which one counts as
"done" depended on whether R4b meant `Navigatable` as the mechanism or as
shorthand for "every tab has an address".

### Other URI decisions taken without a question, on evidence

- Bare `OpenHandler`, not `WidgetOpenHandler` — the latter's `doOpen`
  hardcodes `{ area: 'main' }`, which would put Problems and Outline in the
  wrong panel.
- `canHandle` must return `> 0`, not merely nonzero — `Prioritizeable.isValid`
  contradicts `OpenHandler`'s own doc comment.
- Canonical form `scheme:path`, never `scheme://authority` — the authority
  component is lower-cased on serialization.
- No dots in the final path segment — `ResourceContextKey` derives
  `resourceExtname` from `uri.path.ext`.
- `terminal:` names are minted by us and stale names create a fresh shell —
  the tmux named-target model.
- `view:` chosen over a namespaced `sourcerer-view:` because URI-04's whole
  point is typeability and no collision exists.

---

## Customize layer plumbing

Not asked as a menu. Investigated, then recommended.

Rejected alternatives, each with a verified reason rather than a preference:

| Alternative | Why rejected |
|---|---|
| `DecorationStyle.createStyleElement` (named in prior research as the hook) | Hard-sets `media='screen'`, silently excluding print |
| `createStyleSheet` + `insertRule` | Throws on malformed user input instead of dropping invalid rules |
| Serving the CSS over a `<link>` | A miss 404s with a `text/html` body, which the browser refuses to apply |
| `@layer` for cascade ordering | Points the wrong way — layered rules lose to unlayered, and all of Theia's bundle is unlayered |
| A `MutationObserver` on head | A permanent observer firing on every editor and terminal open, to solve what reload-time re-append covers |
| Our own `fileService.watch()` | The user-storage watch is placed on the provider directly and never enters `recursiveWatcherIndexes`, so ours would not be subsumed — a second OS watch on one directory |
| A URL query param as the dev flag | Attacker-selectable: the token middleware issues a valid cookie on any HTTP request and exempts the initial page |
| `window.location.hash` as the dev flag | Owned end-to-end by `@theia/workspace` |
| A backend env var as the dev flag | Every `EnvVariablesServer` method is async RPC resolving long after `container.load()` — could only produce the runtime no-op guard CUST-02 forbids |

The dev-flag rebuild question was settled without asking: the build-time
`theia.frontend.config` field is one package.json key plus one `if`, and being
build-time is a feature — no runtime input can enable the layer in a release
build.

Two honest caveats were recorded rather than papered over: the binding is
absent but the class is still in `bundle.js`, and the flag is not a security
boundary against script already running in the Theia page, because
`window.theia.container` is published in every build.

---

## Branding identity & assets

Investigated directly rather than delegated.

- The three files in `logo/` are one mark in three treatments. `LE logo.svg`
  is the vector master and the only one that survives 16px, so it is the
  favicon source — after recoloring, since its shapes are `fill:#fff`.
- Theia emits no favicon at all. Verified: zero references across
  `dev-packages` and `packages/core/src`.
- Window and tab title are one config field in our own package.json, not an
  extension.
- The About dialog needed a full `render()` override, not a retitle — stock
  `renderHeader()` hard-links the eclipse-theia comparator and
  `renderExtensions()` lists every `@theia/*` package by name and version.

No question was put to the user here; the remaining gap is brand copy, which
is recorded under Claude's Discretion with an explicit instruction to ask
before writing user-facing text beyond the product name.

---

## Claude's Discretion

- Brand copy — welcome-widget and About-dialog text, and whether a tagline
  exists. Leaning: product name, version and repo links only; ask before
  inventing marketing copy.
- Which logo treatment appears where beyond the favicon.
- The `view:` path spelling for the welcome widget.
- Whether v4.0 exposes extracted-widget secondary windows at all (leaning:
  no).
- How minimal the default `theia.frontend.config` block stays.

---

## Deferred Ideas

- `@sourcerer/browser-bridge` and the chrome-side URL bar — post-4.0.
- Firefox-side branding, `sourcerer.xhtml`, `SourcererAPI.sys.mjs`,
  `TheiaService.sys.mjs`, `sourcerer/INTERNAL-APIS.md` — Phases 3 and 4.
- Self-hosted Open VSX registry — R9.
- Sourcerer's own AI layer — R8.
- `@theia/ai-claude-code` — deferred pending R8 packaging the SDK.
- Addressing `ViewContainerPart` sub-views.
- A `WebviewPanelSerializer` so `webview:` URLs survive a restart.
- Hot-flipping the CUST-02 dev flag without a rebuild.
