# Phase 2: Sourcerer Theia Extensions - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 9 (3 new packages × ~3 files each) + 2 modified config files
**Analogs found:** 8 / 9 (all but the welcome widget's exact shape have a strong analog; welcome widget itself has a related-but-rejected analog, noted below)

**In-repo status:** `/home/chris/coding/sourcerer` has no `@sourcerer/*` TypeScript yet — Phase 1 shipped only the stock 11-package `theia/` workspace. There is nothing in-repo to pattern-match against for the new packages; every analog below is in one of the two read-only reference trees named in the task brief. The two in-repo files this phase modifies (`theia/package.json`, `theia/applications/browser/package.json`) are shown as their own current-state baseline, not analog-matched.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/branding/package.json` | config | — | `theia-ide/theia-extensions/product/package.json` | exact (package shape) |
| `extensions/branding/tsconfig.json` | config | — | `theia-ide/configs/base.tsconfig.json` (inlined, no `extends`) | exact |
| `extensions/branding/src/browser/sourcerer-frontend-module.ts` | provider (DI ContainerModule) | event-driven (DI bind/rebind at container-load time) | `theia-ide/.../theia-ide-frontend-module.ts` | exact |
| `extensions/branding/src/browser/sourcerer-about-dialog.tsx` | component | request-response (render on dialog open) | `theia-ide/.../theia-ide-about-dialog.tsx` | exact, **minus `renderExtensions()`** (see Anti-Pattern note) |
| `extensions/branding/src/browser/sourcerer-welcome-widget.tsx` | component | request-response (render on tab open) | `theia/packages/core/src/browser/widgets/react-widget.tsx` (base class) + `theia-ide/.../theia-ide-getting-started-widget.tsx` (shape reference only, **not a subclass target** — D-24) | role-match, not a literal copy target |
| `extensions/branding/src/browser/sourcerer-favicon-contribution.ts` | middleware (`FrontendApplicationContribution`) | event-driven (`onStart` lifecycle hook) | `theia/packages/plugin-ext/src/main/browser/plugin-shared-style.ts` (style-element injection idiom, same `onStart`-timed DOM-mutation shape) | role-match |
| `extensions/customize/src/browser/customize-frontend-module.ts` | provider (DI ContainerModule + `FrontendApplicationContribution`) | file-I/O (read `user-storage:` CSS/JS) + event-driven (file-watch hot reload) | `theia/packages/plugin-ext/src/main/browser/plugin-shared-style.ts` | role-match (style-element lifecycle); no in-tree analog for the file-watch+debounce half — see "No Analog Found" |
| `extensions/tab-uris/src/browser/tab-uris-frontend-module.ts` | provider (DI ContainerModule) | event-driven | `theia-ide/.../theia-ide-frontend-module.ts` | exact (module shape only) |
| `extensions/tab-uris/src/browser/view-open-handler.ts` (`view:`/`settings:`) | route handler (bare `OpenHandler`) | request-response | `theia/packages/preferences/src/browser/preference-open-handler.ts` | exact |
| `extensions/tab-uris/src/browser/terminal-open-handler.ts` (`terminal:`) | route handler (`WidgetOpenHandler`) | request-response | `theia/packages/vsx-registry/src/browser/vsx-extension-editor-manager.ts` | exact |
| `extensions/tab-uris/src/browser/terminal-naming-contribution.ts` (`rebind(TerminalFrontendContribution)`) | provider (DI rebind of a singleton service) | event-driven | `theia/packages/toolbar/src/browser/toolbar-frontend-module.ts` (`bindToolbarApplicationShell` — the one in-tree `rebind(ApplicationShell)`) | role-match (rebind-a-core-singleton idiom); read only — `@theia/toolbar` itself is excluded (D-28) |
| `theia/package.json` (modify) | config | — | its own current committed state (Phase 1) | n/a — direct edit, current content shown below |
| `theia/applications/browser/package.json` (modify) | config | — | its own current committed state (Phase 1); dependency-list shape confirmed against `theia-ide/applications/browser/package.json` | n/a / role-match |

## Pattern Assignments

### `extensions/branding/package.json` (config)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product/package.json`

Full file is short — reproduced as the copy target (adapted: drop `electronMain`, drop `ai-registry`/`getting-started`/`vsx-registry`/`workspace` deps since D-24/D-33 write a fresh widget with no `GettingStartedWidget` dependency; `@sourcerer/branding` needs only `@theia/core` + React peer dep):

```json
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

Note the analog's `theiaExtensions` array carries a second key, `"electronMain"` — do **not** copy that key; Phase 1's D-06/D-07 ship browser-target only, and `@theia/electron` is excluded (D-28).

`@sourcerer/customize` and `@sourcerer/tab-uris` follow the identical shape, only `name`, `theiaExtensions[0].frontend`, and `dependencies` differ (`tab-uris` additionally needs `@theia/terminal`; `customize` additionally needs `@theia/filesystem` and `@theia/userstorage` per D-56).

---

### `extensions/*/tsconfig.json` (config)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/configs/base.tsconfig.json`

Per RESEARCH.md §2 / Anti-Patterns: inline the `compilerOptions` directly in each package's own `tsconfig.json` rather than `extends`-referencing a shared config package — D-08/D-32 reject standing up a fourth "configs" workspace member for three extensions. Copy target (verbatim `compilerOptions` from the analog, `extends` removed):

```json
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

---

### `extensions/branding/src/browser/sourcerer-frontend-module.ts` (provider, event-driven)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product/src/browser/theia-ide-frontend-module.ts` (full file, 49 lines, reproduced above under Step 4 read — key excerpts below)

**Imports pattern:**
```typescript
import { WidgetFactory } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { CommandContribution } from '@theia/core/lib/common/command';
import { ContainerModule } from '@theia/core/shared/inversify';
import { MenuContribution } from '@theia/core/lib/common/menu';
```

**Core DI-rebind pattern** — the `isBound` guard before `rebind` is the load-bearing idiom, confirmed idiomatic in-tree (RESEARCH.md §"Established Patterns"):
```typescript
export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(SourcererWelcomeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: 'welcome',   // D-43's rule: path is the factoryId verbatim
        createWidget: () => context.container.get<SourcererWelcomeWidget>(SourcererWelcomeWidget),
    })).inSingletonScope();

    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(SourcererAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(SourcererAboutDialog).inSingletonScope();
    }

    bind(SourcererFaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SourcererFaviconContribution);
});
```
Do not copy the analog's `applyBranding()` call, `AIRegistryConfiguration` rebind, or `TheiaIDEContribution` command/menu bindings — those are `theia-ide`-specific (AI registry endpoint override, out of D-28/D-30 scope). Copy only the `WidgetFactory`-replaces-`GettingStartedWidget` idiom and the `isBound`-guarded `AboutDialog` rebind idiom.

---

### `extensions/branding/src/browser/sourcerer-about-dialog.tsx` (component, request-response)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product/src/browser/theia-ide-about-dialog.tsx` (full file, 105 lines, reproduced above)

**Subclass shape to copy:**
```typescript
import * as React from 'react';
import { AboutDialog, AboutDialogProps, ABOUT_CONTENT_CLASS } from '@theia/core/lib/browser/about-dialog';
import { injectable, inject } from '@theia/core/shared/inversify';

@injectable()
export class SourcererAboutDialog extends AboutDialog {
    constructor(@inject(AboutDialogProps) protected readonly props: AboutDialogProps) {
        super(props);
    }

    protected render(): React.ReactNode {
        return <div className={ABOUT_CONTENT_CLASS}>
            {this.renderContent()}
        </div>;
    }

    protected renderContent(): React.ReactNode {
        // Sourcerer's own body — name, version, repo link. NO renderExtensions() call.
        return <div className='ad-container'>
            {this.renderTitle()}
            <hr className='gs-hr' />
        </div>;
    }
}
```

**Anti-pattern — do not copy verbatim:** the analog's `renderContent()` calls `this.renderExtensions()` (`theia-ide-about-dialog.tsx:49`), which is exactly what D-35/criterion 1 forbids — it lists every `@theia/*` package by name and version. RESEARCH.md's own Anti-Patterns section flags this explicitly: "the in-tree precedent is a pattern for *how* to subclass and override `render()`, not a scrubbed dialog body to copy." Sourcerer's version must drop the `renderExtensions()` call entirely, and must not link `https://eclipse-theia.github.io/vscode-theia-comparator/status.html` (the base `renderHeader()`'s hardcoded link — also must not be called).

---

### `extensions/branding/src/browser/sourcerer-welcome-widget.tsx` (component, request-response)

**No exact analog** — D-24 explicitly rejects subclassing `theia-ide-getting-started-widget.tsx` (which extends `GettingStartedWidget`) because scrubbing 8 hardcoded Eclipse/Theia URLs from every inherited render method is more code than writing fresh. Use as **shape reference only**:
- Base class: `ReactWidget` at `theia/packages/core/src/browser/widgets/react-widget.tsx:24-53` — only `render(): React.ReactNode` must be implemented; `this.id` and `this.title.label` set in the constructor per every in-tree `ReactWidget` subclass (RESEARCH.md API Signatures section).
- The analog's CSS class idiom (`gs-container`, `gs-header`, `flex-grid`/`col` wrapper divs) is reusable structurally even though the specific `render()` body must be written fresh — no code to copy line-for-line, only the wrapper-div convention.

```typescript
@injectable()
export class SourcererWelcomeWidget extends ReactWidget {
    constructor() {
        super();
        this.id = 'welcome';
        this.title.label = 'Welcome';
        this.title.closable = true;
    }
    protected render(): React.ReactNode {
        return <div className='gs-container'>{/* Sourcerer name, version, repo link only — no invented marketing copy per CONTEXT.md leaning */}</div>;
    }
}
```

---

### `extensions/branding/src/browser/sourcerer-favicon-contribution.ts` (middleware, event-driven)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia/packages/plugin-ext/src/main/browser/plugin-shared-style.ts` (lines 1-65 read; style-element create/append/dispose idiom)

**Core pattern to copy** — style/link-element injection timed to a lifecycle hook, `@postConstruct` → DOM mutation:
```typescript
@injectable()
export class SourcererFaviconContribution implements FrontendApplicationContribution {
    onStart(): void {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = SOURCERER_FAVICON_DATA_URI;   // inlined data: URI, recolored SVG per D-36
        document.head.appendChild(link);
    }
}
```
`plugin-shared-style.ts`'s `document.getElementsByTagName('head')[0].appendChild(style)` / `Disposable.create(() => ...removeChild...)` idiom is the confirmed in-tree pattern for head-mutation-on-lifecycle-hook; favicon injection is simpler (no re-run/dispose needed — one-shot `onStart`) so only the append call, not the dispose/re-render cycle, needs copying.

---

### `extensions/customize/src/browser/customize-frontend-module.ts` (provider, file-I/O + event-driven)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia/packages/plugin-ext/src/main/browser/plugin-shared-style.ts` (style-element lifecycle only)

**Core pattern (style injection half, D-58/D-59):**
```typescript
@injectable()
export class CustomizeCssContribution implements FrontendApplicationContribution {
    @inject(FileService) protected readonly fileService: FileService;

    async onStart(): Promise<void> {
        const uri = UserStorageUri.resolve('customize.css');
        await this.applyCss(uri);
        this.fileService.onDidFilesChange(e => {
            if (e.contains(uri)) { this.debouncedApply(uri); }   // p-debounce ~150ms per D-60
        });
    }

    protected async applyCss(uri: URI): Promise<void> {
        let content = '';
        try {
            content = (await this.fileService.read(uri)).value;
        } catch {
            // absent = empty, per D-57/D-61 — never create the file
        }
        const style = document.createElement('style');
        style.textContent = content;   // never insertRule — let the parser drop invalid rules silently (D-58)
        document.head.appendChild(style);
    }
}
```
`FileService.read` / `onDidFilesChange` signatures verified in RESEARCH.md API Signatures section (`file-service.ts:727-738,1431-1436`; `files.ts:77-100`). `UserStorageUri.resolve` verified at `user-storage-uri.ts:19` + `uri.ts:87`.

**No in-tree analog for the debounce/dedup-two-events half** (D-60's "one physical save fires twice, filter on one scheme, debounce ~150ms with `p-debounce`") — `p-debounce` is already a transitive dependency; this is new composition, not a copy target. Listed under "No Analog Found" below.

**Privileged JS gate (D-62, CUST-02):**
```typescript
export default new ContainerModule(bind => {
    bind(FrontendApplicationContribution).toService(CustomizeCssContribution);
    if (FrontendApplicationConfigProvider.get()['sourcererPrivilegedJs']) {
        bind(FrontendApplicationContribution).toService(CustomizePrivilegedJsContribution);
    }
});
```
Core's own precedent for conditional binding inside a `ContainerModule` callback (cited in D-62, not independently re-read this pass — CONTEXT.md already verifies `if (!isBound(FuzzySearch))` is idiomatic in `packages/core`).

---

### `extensions/tab-uris/src/browser/view-open-handler.ts` (route handler, request-response)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia/packages/preferences/src/browser/preference-open-handler.ts` (full file, 47 lines, reproduced above)

**Full pattern to copy (bare `OpenHandler`, not `WidgetOpenHandler` — D-44):**
```typescript
import { OpenHandler } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { injectable, inject } from '@theia/core/shared/inversify';

@injectable()
export class ViewUriOpenHandler implements OpenHandler {
    readonly id = 'sourcerer.view-uri-open-handler';

    canHandle(uri: URI): number {
        // D-45: 1000 or 0, never a negative/zero-is-valid reading
        return (uri.scheme === 'view' || uri.scheme === 'settings') ? 1000 : 0;
    }

    async open(uri: URI): Promise<object | undefined> {
        // delegate to the per-package AbstractViewContribution.openView() (D-44) —
        // never shell.addWidget directly, that hardcodes { area: 'main' }
    }
}
```
Note the analog's own `canHandle` returns `-1` for non-match (`preference-open-handler.ts:29-31`) where D-45 requires **0**, not `-1` — do not copy that literal value, only the shape. The analog is `id = 'preference'` at priority 500; Sourcerer's handler must be priority 1000 per D-45 to clear every in-tree bidder.

---

### `extensions/tab-uris/src/browser/terminal-open-handler.ts` (`terminal:`, route handler)

**Analog:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia/packages/vsx-registry/src/browser/vsx-extension-editor-manager.ts` (class declaration + `canHandle` read, lines ~19-30)

```typescript
import { WidgetOpenHandler } from '@theia/core/lib/browser';

@injectable()
export class TerminalUriOpenHandler extends WidgetOpenHandler<TerminalWidget> {
    readonly id = TERMINAL_WIDGET_FACTORY_ID;   // 'terminal'
    canHandle(uri: URI): number {
        return uri.scheme === 'terminal' ? 1000 : 0;
    }
}
```
`WidgetOpenHandler` is deliberately used here (unlike `view:`/`settings:`) because terminal *is* a main-area widget with no competing area-placement concern — confirmed against `vsx-extension-editor-manager.ts` extending the same base class for `vscode-extension:`.

---

### `extensions/tab-uris/src/browser/terminal-naming-contribution.ts` (DI rebind)

**Analog (read-only, idiom reference — not a package to ship):** `/home/chris/Vibe Coding/TheiaIDE/sources/theia/packages/toolbar/src/browser/toolbar-frontend-module.ts` — the one in-tree `rebind(ApplicationShell)`, confirming the mechanics of rebinding a core singleton service from an extension module without touching core.

**Core pattern (from RESEARCH.md API Signatures, verified against `terminal-widget-impl.ts:60-82` and `terminal-frontend-contribution.ts:1010-1016`):**
```typescript
@injectable()
export class SourcererTerminalFrontendContribution extends TerminalFrontendContribution {
    async newTerminal(options: TerminalWidgetOptions): Promise<TerminalWidget> {
        if (!options.created && !options.id) {
            const name = this.nextName();   // t<n>, scans widgetManager.getWidgets('terminal')
            options = { ...options, created: name, id: name, title: name };
        }
        return super.newTerminal(options);
    }
}
```
Bind with `rebind(TerminalFrontendContribution).to(SourcererTerminalFrontendContribution).inSingletonScope()` — reaches `TerminalService`, all `CommandContribution`/`MenuContribution`/`KeybindingContribution`/`TabBarToolbarContribution`/`ColorContribution`, and `FrontendApplicationContribution` in one rebind (`terminal-frontend-module.ts:90-95,143`), per RESEARCH.md.

**CLAUDE.md hard-rule check:** this is a `rebind`, not a Theia-core file edit — permitted under "never fork or patch Theia core" because it is a DI substitution from `@sourcerer/tab-uris`, exactly the sanctioned seam.

## Shared Patterns

### `isBound` guard before `rebind`
**Source:** `theia-ide-frontend-module.ts:33-37`
**Apply to:** every `@sourcerer/*` `ContainerModule` that rebinds a core singleton (`AboutDialog` in branding, `TerminalFrontendContribution` in tab-uris)
```typescript
if (isBound(AboutDialog)) {
    rebind(AboutDialog).to(SourcererAboutDialog).inSingletonScope();
} else {
    bind(AboutDialog).to(SourcererAboutDialog).inSingletonScope();
}
```

### Second `WidgetFactory` with the same id (widget replacement, last wins)
**Source:** `theia-ide-frontend-module.ts:28-32`
**Apply to:** `@sourcerer/branding`'s welcome widget replacing (in intent, though D-24 excludes the package rather than binding a same-id factory against it) `@theia/getting-started`'s slot — since `getting-started` is excluded outright (D-24), this idiom is not literally needed for branding, but stays the reference if any future widget-swap needs it.

### Bare `OpenHandler` vs `WidgetOpenHandler` choice
**Source:** `preference-open-handler.ts` (bare) vs `vsx-extension-editor-manager.ts` (Widget-)
**Apply to:** `@sourcerer/tab-uris` — `view:`/`settings:` use bare `OpenHandler` (D-44, area-placement must stay per-contribution), `terminal:` uses `WidgetOpenHandler` (single fixed main-area placement, no competing area logic).

### Style-element head-injection, not `DecorationStyle`/`<link>`
**Source:** `plugin-shared-style.ts:56-63`
**Apply to:** `@sourcerer/branding`'s favicon `<link>` and `@sourcerer/customize`'s CSS `<style>` — both are `document.head.appendChild` of a freshly created element inside a lifecycle hook, never `DecorationStyle.createStyleElement` (D-58 explicitly rejects it — hardcodes `media='screen'`) and never a `<link>` for the CSS layer (a 404 would 200-with-`text/html` through Express's default handler, silently not applying).

### `theiaExtensions` manifest key + direct-dependency requirement
**Source:** `theia-ide/theia-extensions/product/package.json` + `theia-ide/applications/browser/package.json`
**Apply to:** all three `@sourcerer/*` packages and `theia/applications/browser/package.json` — the generator only walks the app's own `dependencies`; a workspace member absent from that list is invisible to `theia build` (D-31, confirmed against the `theia-ide-product-ext` precedent).

## No Analog Found

Files/behaviors with no close match in either reference tree — RESEARCH.md's own composition, not derivable from an existing pattern:

| File / Behavior | Role | Data Flow | Reason |
|---|---|---|---|
| `extensions/customize` hot-reload debounce + dual-scheme-event dedup (D-60) | provider | event-driven | No in-tree consumer subscribes to `FileService.onDidFilesChange` with a debounce + single-scheme filter for a single user-authored file; `p-debounce` is available as a dependency but its application here is new composition, not a copy target. |
| `extensions/tab-uris`'s `factoryId → URI` registry (reverse-lookup half, D-38) | provider (registry) | transform | `WidgetManager.getDescription(widget)` supplies the raw `{factoryId, options}`, but no in-tree code builds a public bidirectional registry over it — this is the phase's own new public interface (the post-4.0 `browser-bridge` consumption point), not a pattern extension. |
| `scripts/verify-dev-flag-off.ts` (D-64 headless proof) | test | request-response | No existing Playwright/Puppeteer script exists in this repo; RESEARCH.md §6 fully specifies it from scratch against Playwright's own API, not a codebase analog. |
| `scripts/diff-theia-core.sh` (D-68 criterion-2 proof) | test / utility | batch | No existing script in `scripts/` does a fresh-resolve diff; RESEARCH.md §5 mechanism 2 specifies it fully — closest kin is `scripts/smoke-theia.sh`'s file-existence-check style (shell script, `set -euo pipefail`), reuse that header convention only. |

## Metadata

**Analog search scope:** `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/theia-extensions/product/` (full directory), `/home/chris/Vibe Coding/TheiaIDE/sources/theia/packages/{output,preferences,vsx-registry,plugin-ext,toolbar,core}/src/browser` (targeted files per RESEARCH.md's pre-identified analog list), `/home/chris/coding/sourcerer/theia/{package.json,applications/browser/package.json}` (current-state baseline for the two modified files).
**Files scanned:** 13 read directly (package.json ×2 current-state, package.json/tsconfig.json/frontend-module/about-dialog/getting-started-widget ×1 each from theia-ide product, output-contribution.ts, output-uri.ts, plugin-shared-style.ts, preference-open-handler.ts, toolbar-frontend-module.ts grep, vsx-extension-editor-manager.ts grep).
**Pattern extraction date:** 2026-08-20

---

## PATTERN MAPPING COMPLETE

**Phase:** 2 - Sourcerer Theia Extensions
**Files classified:** 13 (9 new + 2 modified config + 2 test scripts named in RESEARCH.md)
**Analogs found:** 10 / 13 (bare-OpenHandler, WidgetOpenHandler, DI-rebind, About-dialog subclass, style-injection, package/tsconfig shape all have exact or role-match analogs; welcome widget, hot-reload debounce, the registry itself, and the two verification scripts have no analog and are named explicitly under "No Analog Found")

### Coverage
- Files with exact analog: 6 (package.json, tsconfig.json, frontend-module.ts, about-dialog.tsx, view-open-handler.ts, terminal-open-handler.ts)
- Files with role-match analog: 4 (favicon-contribution.ts, customize CSS-injection half, terminal-naming-contribution.ts, welcome-widget.tsx)
- Files with no analog: 4 (customize debounce/dedup logic, tab-uris registry, verify-dev-flag-off.ts, diff-theia-core.sh)

### Key Patterns Identified
- Every `@sourcerer/*` `ContainerModule` follows `theia-ide-frontend-module.ts`'s shape exactly: `isBound`-guarded rebind for singletons, a second same-id `WidgetFactory` for widget replacement, `.toService()` for late-resolved aliases.
- The URI scheme handlers split cleanly on one axis: bare `OpenHandler` (`preference-open-handler.ts`) when area-placement must be delegated per-package (`view:`/`settings:`), `WidgetOpenHandler` (`vsx-extension-editor-manager.ts`) when the target is a single fixed-area widget type (`terminal:`).
- All DOM-mutation-on-lifecycle-hook work (favicon `<link>`, CSS `<style>`) follows `plugin-shared-style.ts`'s `document.head.appendChild` + lifecycle-hook-timed idiom, never `DecorationStyle` or a `<link>`-for-CSS approach — both explicitly rejected in CONTEXT.md D-58 with reasons.
- The About dialog subclass pattern is exact-copy-then-subtract: copy `theia-ide-about-dialog.tsx`'s subclass shape, but delete its `renderExtensions()` call — the analog itself violates this phase's own criterion 1 and must not be trusted as a finished template (RESEARCH.md's own Anti-Patterns section flags this).

### File Created
`/home/chris/coding/sourcerer/.planning/phases/02-sourcerer-theia-extensions/02-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
