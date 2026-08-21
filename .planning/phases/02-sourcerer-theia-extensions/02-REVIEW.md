---
phase: 02-sourcerer-theia-extensions
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - theia/extensions/branding/src/browser/sourcerer-about-dialog.tsx
  - theia/extensions/branding/src/browser/sourcerer-ai-layout-contribution.ts
  - theia/extensions/branding/src/browser/sourcerer-favicon-contribution.ts
  - theia/extensions/branding/src/browser/sourcerer-frontend-module.ts
  - theia/extensions/branding/src/browser/sourcerer-mark.ts
  - theia/extensions/branding/src/browser/sourcerer-welcome-contribution.ts
  - theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx
  - theia/extensions/customize/src/browser/customize-css-contribution.ts
  - theia/extensions/customize/src/browser/customize-frontend-module.ts
  - theia/extensions/customize/src/browser/customize-privileged-js-contribution.ts
  - theia/extensions/customize/src/browser/sourcerer-privileged-js.ts
  - theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts
  - theia/extensions/tab-uris/src/browser/tab-uri-registry.ts
  - theia/extensions/tab-uris/src/browser/tab-uris-frontend-module.ts
  - theia/extensions/tab-uris/src/browser/terminal-naming-contribution.ts
  - theia/extensions/tab-uris/src/browser/terminal-open-handler.ts
  - theia/extensions/tab-uris/src/browser/view-factory-table.ts
  - theia/extensions/tab-uris/src/browser/view-open-handler.ts
  - scripts/lib/firefox-bidi.mjs
  - scripts/diff-theia-core.sh
  - scripts/verify-branding.mjs
  - scripts/verify-customize-inert.mjs
  - scripts/verify-dev-flag-off.mjs
  - scripts/verify-uri-roundtrip.mjs
  - scripts/verify-phase-02.sh
  - theia/package.json
  - theia/applications/browser/package.json
  - theia/extensions/branding/package.json
  - theia/extensions/branding/tsconfig.json
  - theia/extensions/customize/package.json
  - theia/extensions/customize/tsconfig.json
  - theia/extensions/tab-uris/package.json
  - theia/extensions/tab-uris/tsconfig.json
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: fixed
fixed: 2026-08-21
fix_summary: >
  All 3 Critical and all 3 Warning findings fixed and verified (see
  per-finding Status lines below and 02-REVIEW-FIX.md). Both Info
  findings (IN-01, IN-02) are unchanged -- out of the fix pass's scope
  and neither was one-line/risk-free. Full gate green:
  `scripts/verify-phase-02.sh --build` 5/5 checks, 23/23 URI
  round-trip rows, exit code 0.
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 32 (18 TypeScript sources, 6 harness scripts, 8 manifests)
**Status:** issues_found

## Summary

This phase is unusually well-documented — nearly every non-obvious choice is
justified inline with a cross-reference to a numbered decision in
`02-CONTEXT.md`, and the majority of things that look like bugs on first read
turn out to be deliberate, verified-against-source workarounds for upstream
Theia quirks (D-44/D-45's `canHandle`/`WidgetOpenHandler` avoidance, D-46's
`options: undefined` vs `{}` discipline, D-58's `textContent`-based style
injection, D-60's exact-URI dedup, D-69's Firefox-BiDi harness). Those are not
re-litigated here per the review brief.

Three real, unexcused defects were found, all consistent with the review's
explicit focus areas:

1. A genuine **widget-attach bug** in the `view:` open handler's
   plugin-view-container branch — it reproduces exactly the "created but not
   shown" failure mode D-44 was written to avoid, and the phase's own
   acceptance-test methodology (D-53) does not catch it because that
   methodology never asserts attachment/visibility, only address round-trip.
2. A **hang-forever bug** in the BiDi driver used by every harness script —
   no timeout and no WebSocket-close handling on in-flight RPCs, so a Firefox
   crash mid-session (the exact scenario the review brief calls out) leaves
   the calling script blocked indefinitely, silently defeating `waitFor()`'s
   own `timeoutMs` safety net in the process.
3. A **SIGINT cleanup race** in the one script that layers its own SIGINT
   handler on top of the shared driver's — the outer handler's faster promise
   chain very likely calls `process.exit()` before the driver's own Firefox
   kill/profile-removal sequence completes, risking exactly the orphaned-
   process outcome Phase 5 exists to eliminate.

Three warnings and two info items round out the findings; none of the
customization-layer (`@sourcerer/customize`) trust-boundary code, the URI
parse/emit round-trip logic, or the terminal-naming allocator turned up
defects beyond what's listed below — those areas held up under adversarial
tracing against the actual Theia v1.74.1 source.

## Critical Issues

### CR-01: `view:plugin-view-container:<id>` never attaches the widget to the shell on first open

**File:** `theia/extensions/tab-uris/src/browser/view-open-handler.ts:74-84`

**Status:** Fixed. Delegates to `PluginViewRegistry.openViewContainer(viewContainerId)`
instead of the bare `getOrCreateWidget` + `activateWidget` sequence (commit
`fix(02): CR-01 attach plugin view containers on first URI open`). Verified
its `toViewContainerIdentifier` produces the identical
`{id, progressLocationId}` shape `TabUriRegistry.createWidgetOptions`
already returns, so this cannot fork the widget under D-46's dedup key.
`verify-uri-roundtrip.mjs`'s D-53 acceptance check is also strengthened
with an explicit (bounded-poll) `widget.isAttached` assertion on every row,
per this finding's own note that the round-trip check alone doesn't catch
this bug class (commits `fix(02): CR-01 ...` and the `CR-01 follow-up`
commit, the latter fixing a false-failure the stricter check itself
introduced on 6 rows -- found live, see 02-REVIEW-FIX.md).

**Issue:** For a plugin-contributed view container, `openView()` bypasses
`PluginViewRegistry.openViewContainer()` (the real Theia code path, which
calls `shell.addWidget(containerWidget, { area, rank })` whenever
`!containerWidget.isAttached` — see
`packages/plugin-ext/src/main/browser/view/plugin-view-registry.ts:806-808`
in the pinned v1.74.1 source) and instead does its own narrower sequence:

```ts
const widget = await this.widgetManager.getOrCreateWidget(
    PLUGIN_VIEW_CONTAINER_FACTORY_ID,
    this.registry.createWidgetOptions(name)
);
await this.shell.activateWidget(widget.id);
return widget;
```

`WidgetManager.getOrCreateWidget` only invokes the factory and caches the
widget — it never touches the shell. `ApplicationShell.activateWidget(id)`
builds its target stack from `this.tracker.widgets` (`toTrackedStack`,
`application-shell.ts:1313-1324`), which only contains widgets already
attached to the shell. For a container that has never been opened before
(no prior menu-driven `PluginViewRegistry.openViewContainer` call), the
widget is brand new and unattached, so `toTrackedStack` returns an empty
stack, `activateWidget` silently resolves `undefined`, and the function
returns a widget object that was created but is not in the DOM anywhere —
nothing appears on screen. There is no error, no thrown exception, no log
line.

This is a silent no-op on exactly the code path D-44's whole design
(`AbstractViewContribution.openView()` delegation instead of
`WidgetOpenHandler`) was written to prevent for the static-view case — but
the plugin-container branch reimplements a narrower, incorrect version of
the same attach logic instead of delegating. The phase's own acceptance test
(D-53: `registry.uriOf(await open(u)).toString(true) === u`, plus a widget
count check) does not catch this, because `WidgetManager.getDescription`
still reports the correct `{factoryId, options}` for an unattached cached
widget — the round-trip assertion passes even though the tab never appeared.

**Fix:** Delegate to `PluginViewRegistry.openViewContainer(viewContainerId)`
instead of re-deriving the widget from `WidgetManager` directly, mirroring
D-44's own rationale for the static-view branch:

```ts
if (name.startsWith(PLUGIN_VIEW_CONTAINER_FACTORY_ID + ':')) {
    const viewContainerId = name.substring(PLUGIN_VIEW_CONTAINER_FACTORY_ID.length + 1);
    const widget = await this.pluginViewRegistry.openViewContainer(viewContainerId);
    if (!widget) {
        throw new Error(`sourcerer.view-uri-open-handler: no plugin view container '${viewContainerId}'`);
    }
    await this.shell.activateWidget(widget.id);
    return widget;
}
```

(inject `PluginViewRegistry` from `@theia/plugin-ext/lib/main/browser/view/plugin-view-registry`,
already a dependency of `@sourcerer/tab-uris`). If avoiding a hard
`PluginViewRegistry` dependency is preferred, the minimal fix is to check
`widget.isAttached` and call `this.shell.addWidget(widget, { area: 'left' })`
before `activateWidget`, matching the location `PluginViewRegistry` itself
uses — but delegating is safer against a future Theia version changing that
placement logic.

### CR-02: `BiDiClient` has no timeout or WebSocket-close handling — a mid-session Firefox death hangs every harness script forever

**File:** `scripts/lib/firefox-bidi.mjs:69-99`

**Status:** Fixed. `BiDiClient` now rejects every pending request when the
WebSocket closes or errors, and every `send()` carries a 20s default
timeout (commit `fix(02): CR-02 reject in-flight BiDi requests on socket
close/timeout`).

**Issue:** `BiDiClient.send()` registers a pending `{resolve, reject}` pair
keyed by request id and only ever settles it from the `ws.addEventListener('message', ...)`
handler (lines 74-89). There is no `ws.addEventListener('close', ...)` or
`ws.addEventListener('error', ...)` handler that rejects outstanding pending
requests, and no per-request or global timeout on `send()` itself.

If the spawned Firefox process dies after the BiDi WebSocket connects —
crash, OOM-kill, a `--headless` renderer fault, anything covered by the
review brief's "browser that dies mid-session" — the socket closes (or stops
producing messages) but nothing ever calls `pending.reject(...)`. Every
in-flight `evaluate()` call (which is `client.send('script.evaluate', ...)`,
`firefox-bidi.mjs:272-279`) hangs forever.

This also silently defeats `waitFor()`'s own bounded-wait contract
(`firefox-bidi.mjs:107-117`): `waitFor` calls `await evaluate(expression)`
and only checks its `deadline` *after* that await returns. If `evaluate`
never returns, the deadline check is unreachable — a function whose entire
purpose is "don't wait longer than `timeoutMs`" provides no such guarantee
once the underlying transport is dead. Every caller (`verify-branding.mjs`,
`verify-customize-inert.mjs`, `verify-dev-flag-off.mjs`,
`verify-uri-roundtrip.mjs`) inherits this: a browser crash turns a fast,
loud failure into an indefinite hang, which in CI means the job hangs until
an external job-level timeout kills it — at which point `withFirefoxPage`'s
own `finally`/cleanup never runs either, so the crashed Firefox's temp
profile is also never removed. This is the exact failure category (D-69)
this whole harness exists to avoid.

**Fix:** Reject all pending requests when the socket closes or errors, and
add a per-request timeout:

```js
constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', event => { /* unchanged */ });
    const failAll = err => {
        for (const { reject } of this.pending.values()) reject(err);
        this.pending.clear();
    };
    ws.addEventListener('close', () => failAll(new Error('BiDi WebSocket closed (browser likely died)')));
    ws.addEventListener('error', err => failAll(new Error(`BiDi WebSocket error: ${err.message || err}`)));
}

send(method, params, { timeoutMs = 20000 } = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`BiDi request '${method}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        this.pending.set(id, {
            resolve: v => { clearTimeout(timer); resolve(v); },
            reject: e => { clearTimeout(timer); reject(e); },
        });
        this.ws.send(JSON.stringify({ id, method, params }));
    });
}
```

Additionally worth adding to `withFirefoxPage`: a `child.on('exit', ...)`
listener re-armed after the initial `waitForBiDiUrl` handshake, so a Firefox
death is detected and surfaced even faster than the request timeout.

**Skipped (not implemented):** the `child.on('exit', ...)` listener suggested
above -- CR-02's close/error rejection plus the per-request timeout already
make a mid-session death fail fast and loudly; adding a third detection path
for the same event would be unrequested extra surface. Add if a real gap in
detection latency shows up in practice.

### CR-03: Racing SIGINT handlers in `verify-customize-inert.mjs` can orphan the Firefox process and leak its profile directory

**File:** `scripts/verify-customize-inert.mjs:80-84`, racing against
`scripts/lib/firefox-bidi.mjs:236-257`

**Status:** Fixed. Root-caused in the shared driver rather than patched only
in the caller: `withFirefoxPage`'s own SIGINT handler no longer calls
`process.exit()` itself (it sets `process.exitCode = 130` and runs
`cleanup()`, letting the natural `try/finally` unwind deterministically once
CR-02's close-triggered rejection propagates); `verify-customize-inert.mjs`
now just records that SIGINT arrived and lets its existing `finally` (where
`restore()` already lived) run naturally instead of racing a second
`process.exit()` (commit `fix(02): CR-03 make SIGINT teardown deterministic,
not racing`). **Proven with a real SIGINT, not just asserted:** sent SIGINT
mid-run against the built app (twice, at different points) and confirmed no
`objdir/dist/bin/firefox` process and no `/tmp/sourcerer-firefox-bidi-*`
profile directory survive, exit code 130, full teardown in ~1.7s. Also fixed
a gap found live while proving this: a `send()` issued after the socket
already closed (e.g. a `screenshot()` call following a plain `setTimeout`
sleep) previously hung for its own 20s timeout instead of rejecting
immediately, since `close`/`error` only fire once.

**Issue:** `verify-customize-inert.mjs` registers its own `SIGINT` listener
(to restore `customize.css` to its pre-run state) in addition to the one
`withFirefoxPage` registers internally once it is called:

```js
// verify-customize-inert.mjs:80-84
let sigintHandler;
sigintHandler = () => {
    restore().finally(() => process.exit(130));
};
process.on('SIGINT', sigintHandler);
```

```js
// firefox-bidi.mjs:254-257 (withFirefoxPage, registered later, after
// verify-customize-inert.mjs has already called withFirefoxPage())
sigintHandler = () => {
    cleanup().finally(() => process.exit(130));
};
process.on('SIGINT', sigintHandler);
```

When SIGINT arrives, Node invokes both listeners synchronously in
registration order, but each kicks off independent async work and calls
`process.exit(130)` from its own `.finally()`. The outer script's `restore()`
is one or two small `fs` writes/unlinks — it resolves in low single-digit
milliseconds. The inner driver's `cleanup()` (`firefox-bidi.mjs:236-252`)
sends `SIGTERM`, then *waits up to 5000ms* for the process to actually exit
before escalating to `SIGKILL`, and only then removes the temp profile
directory via `rm(profileDir, { recursive: true, force: true })`.

Because `restore()` will essentially always resolve first, its
`process.exit(130)` fires while `cleanup()` is still mid-flight — killing the
Node process before the 5s grace period elapses, before any `SIGKILL`
escalation can run, and before `rm(profileDir, ...)` executes. If headless
Firefox does not die promptly from the initial `SIGTERM` (the entire reason
the `SIGKILL` escalation path exists), the browser process is now orphaned
with nothing left to kill it, and the temporary profile directory is leaked
on disk. This is the specific failure mode D-69's "process hygiene" note and
this review's scrutiny item both call out by name — "every harness script
must kill its Firefox and remove its temp profile ... on SIGINT" — and it is
violated precisely because this is the one script layering a second SIGINT
handler on top of the shared one.

**Fix:** Do not register a second `SIGINT` listener with its own
`process.exit()`. Instead, perform the CSS-file restore inside the `finally`
block that already wraps the `withFirefoxPage` call (it already runs on
every exit path including the one triggered by `withFirefoxPage`'s own
internal SIGINT handling, since that handler's `cleanup()` — not a second
`process.exit()` call — is what should be awaited first), or explicitly
`await` the driver's cleanup before restoring:

```js
let sigintReceived = false;
process.on('SIGINT', () => { sigintReceived = true; }); // no exit() here

try {
    await withFirefoxPage(url, async (...) => { ... });
} finally {
    await restore();
    if (sigintReceived) process.exit(130);
}
```

This way the driver's own SIGINT handler (which owns the Firefox
kill/SIGKILL-escalation/`rm` sequence) is the only one calling
`process.exit()`, and the outer restore runs after `withFirefoxPage` has
actually finished unwinding rather than racing it.

## Warnings

### WR-01: `@sourcerer/customize` depends on `@sourcerer/tab-uris`'s build output with no `tsc` project reference enforcing build order

**File:** `theia/extensions/customize/tsconfig.json`, `theia/extensions/customize/package.json:6`, `theia/package.json:69`

**Status:** Fixed. Added `"references": [{ "path": "../tab-uris" }]` to
`extensions/customize/tsconfig.json` (commit `fix(02): WR-01 add tsc project
reference for customize -> tab-uris`). Verified live: cleaned both
packages' `lib/` output, ran `yarn build` inside `extensions/customize`
alone with no manual pre-build of `tab-uris`, and `tsc -b` built `tab-uris`
first automatically.

**Issue:** `@sourcerer/customize` imports `@sourcerer/tab-uris/lib/browser/tab-uri-registry`
(`customize-frontend-module.ts:5`, `customize-privileged-js-contribution.ts:5`)
and declares it as a `dependencies` entry, meaning `@sourcerer/tab-uris` must
already be compiled (its `lib/` directory populated) before `customize` can
type-check or build. All three extension `tsconfig.json` files set
`"composite": true`, which is the flag that enables TypeScript project
references — but none of them declare a `"references"` array. The only thing
that currently guarantees correct build order is the hand-written sequence
in `theia/package.json:69`:

```json
"build:extensions": "yarn --cwd extensions/branding build && yarn --cwd extensions/tab-uris build && yarn --cwd extensions/customize build",
```

This works today only because someone got the order right by hand. It is
also a change from what D-32 recorded ("the three packages have no
build-order dependency on each other; `tsc -b` per package is sufficient") —
that was true when D-32 was written but the later-landed `TabUriRegistry`
wiring (D-67, called out in `customize`'s own file headers as "wired now
that @sourcerer/tab-uris exists") introduced exactly the dependency D-32 said
didn't exist, without anyone updating the build wiring to make the ordering
structural rather than incidental. Running `tsc -b` directly inside
`extensions/customize` (a natural thing to do while iterating on that
package alone) will fail or silently resolve stale/absent types if
`tab-uris` hasn't been built first, and reordering or parallelizing the
`build:extensions` script line in the future (e.g. adding `&`) would
reintroduce the same failure with no compiler-level guard against it.

**Fix:** Add the project reference so `tsc -b` itself enforces the order:

```json
// theia/extensions/customize/tsconfig.json
{
  "compilerOptions": { ... },
  "references": [{ "path": "../tab-uris" }],
  "include": ["src"]
}
```

With that in place, `tsc -b extensions/customize` will build `tab-uris`
first automatically, and the `build:extensions` script's hand-ordering
becomes redundant rather than load-bearing.

### WR-02: `SourcererWelcomeWidget.doInit()` is a floating promise with no error handling

**File:** `theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx:34-43`

**Status:** Fixed. `doInit()` now wraps its `await` in `try`/`catch`/`finally`,
matching the pattern used by `CustomizeCssContribution.applyCss()` and
`CustomizePrivilegedJsContribution.run()` (commit `fix(02): WR-02 catch
rejection in SourcererWelcomeWidget.doInit()`).

**Issue:**

```ts
@postConstruct()
protected init(): void {
    this.doInit();
}

protected async doInit(): Promise<void> {
    const info = await this.appServer.getApplicationInfo();
    this.version = info?.version;
    this.update();
}
```

`init()` calls `this.doInit()` without awaiting or attaching a `.catch()`.
This is deliberate and necessary (a `@postConstruct` hook cannot be async in
a way that blocks construction, and the file's sibling code elsewhere in the
phase is careful about exactly this boot-chain hazard) — but here, unlike
`CustomizeCssContribution.applyCss()` and `CustomizePrivilegedJsContribution.run()`,
there is no `try`/`catch` around the `await`. If `appServer.getApplicationInfo()`
rejects (RPC failure, backend not yet connected, connection drop), the
rejection is never observed: `this.version` never gets set (harmless, the
JSX already guards on `this.version &&`) but the rejection surfaces as an
unhandled promise rejection warning/error in the console on every occurrence,
with no indication of what failed or why.

**Fix:** Match the pattern already used elsewhere in this phase for
fire-and-forget async work from a sync hook:

```ts
protected async doInit(): Promise<void> {
    try {
        const info = await this.appServer.getApplicationInfo();
        this.version = info?.version;
    } catch (error) {
        console.error('[@sourcerer/branding] failed to load application info for welcome widget:', error);
    } finally {
        this.update();
    }
}
```

### WR-03: `parseWebviewPath`'s no-slash fallback can silently create a second, mismatched widget instead of resolving to an existing one

**File:** `theia/extensions/tab-uris/src/browser/existing-scheme-coverage.ts:73-81`

**Status:** Fixed via the loud-failure option. `SourcererWebviewOpenHandler.open()`
now resolves a bare `webview:<id>` address against already-open panels by
`id` alone and throws if none matches, rather than falling through to
`getOrCreateWidget` with an under-specified `{id}`-only options object
(commit `fix(02): WR-03 loud failure for under-specified webview: address`).
`docs/URI-SCHEMES.md` documents the new behaviour since it changes what a
hand-typed degenerate address does.

**Issue:** `webviewUriOf()` (the canonical widget→URI direction) always
emits the two-segment form `webview:<viewId>/<id>` when `viewId` is present
(`existing-scheme-coverage.ts:47-53`), so every URI the system itself ever
prints is round-trip-safe. But `parseWebviewPath()`'s degenerate branch —
reached when a human types (or another tool constructs) a `webview:<id>`
address with no slash — returns `{ id: path }` with no `viewId` key at all:

```ts
function parseWebviewPath(path: string): WebviewWidgetIdentifier {
    const slash = path.indexOf('/');
    if (slash === -1) {
        return { id: path };
    }
    return { viewId: path.slice(0, slash), id: path.slice(slash + 1) };
}
```

`WidgetManager` dedups on `stableJsonStringify({factoryId, options})`. A
real webview panel created by the plugin host is always constructed with
both `id` and `viewId` populated (`webviews-main.ts`:
`getOrCreateWidget(WebviewWidget.FACTORY_ID, {id: panelId, viewId: viewType})`).
A degenerate `webview:<id>` open therefore produces an `options` object that
differs from any real panel's options whenever the real panel has a non-empty
`viewId` — `{id}` vs `{id, viewId: 'someType'}` do not serialize identically
— so `getOrCreateWidget` treats it as a brand-new widget rather than the one
the user meant, silently creating an empty second panel under the same
apparent id instead of erroring or resolving to the existing one.

This is a narrower case than the already-documented D-51 carve-out 4
(session-restart degradation) — it happens within the same session, the
first time someone under- specifies the address, and it fails silently
rather than with the "an unknown path must surface an error" discipline the
`view:` handler applies (`view-open-handler.ts:86-90`).

**Fix:** Either document this explicitly alongside the existing `webview:`
carve-out text (`CARVE_OUTS` in `existing-scheme-coverage.ts:154-176`) as a
fifth, same-session degradation, or make the failure loud instead of silent:
if `parseWebviewPath` cannot find a viewId, look the id up against
`widgetManager.getWidgets(WebviewWidget.FACTORY_ID)` by `id` alone before
falling back to `getOrCreateWidget`, and throw if no existing match is found
rather than minting a new, empty widget.

## Info

### IN-01: `captureScreenshot` export is unused dead code

**File:** `scripts/lib/firefox-bidi.mjs:132-190`

**Status:** Not fixed -- out of this fix pass's scope (Info items were
skipped unless one-line/risk-free; removing ~60 lines of dead process-
management code is neither).

**Issue:** `captureScreenshot()` is exported but has no caller anywhere in
`scripts/` — its own header comment says so explicitly ("this file has no
caller of its own") and explains it was tried for the CUST-01 pixel-diff use
case and found unusable (fires on the page's early `load` event, before the
Theia SPA finishes rendering), which is why `verify-customize-inert.mjs`
uses `withFirefoxPage`'s `screenshot()` method instead. The function and its
~60 lines of process-lifecycle code (duplicate of `withFirefoxPage`'s own
kill/cleanup logic) are retained anyway.

**Fix:** Given the project's YAGNI leaning and that the header comment
itself documents the function as unusable for its originally intended
purpose, consider deleting it rather than carrying ~60 lines of untested,
uncalled process-management code that would need to be kept in sync with
`withFirefoxPage`'s own cleanup fixes (including CR-02/CR-03 above) if it
ever were pressed into use. If it is being kept deliberately as a documented
fallback for a future one-shot screenshot need, a `ponytail:`-style comment
noting that intent would make the "why does this exist with zero callers"
question answerable without reading the whole header.

### IN-02: `sourcererPrivilegedJs: false` is redundant given D-62's "missing key behaves as off" rule

**File:** `theia/applications/browser/package.json:14`

**Status:** Not fixed -- out of this fix pass's scope. The finding itself
says "no action required... not a defect."

**Issue:** `customize-frontend-module.ts:21` gates the privileged-JS binding
on `FrontendApplicationConfigProvider.get()['sourcererPrivilegedJs'] === true`,
which per D-62 already treats a missing key identically to an explicit
`false`. The manifest sets it explicitly to `false` rather than omitting it.
This is harmless and arguably clearer, but it does mean there are now two
independent things a future editor could get wrong when trying to "turn the
flag off" (delete the line vs. set it to `false`) instead of one, for a
value whose whole design point (D-62/D-63) is being a single, unambiguous
build-time switch.

**Fix:** No action required; noted only because the discretion section of
`02-CONTEXT.md` leans toward "keep the default block minimal." Purely
stylistic — not a defect.

---

_Reviewed: 2026-08-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
