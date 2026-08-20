# Feature Research

**Domain:** Branded Firefox-ESR fork hosting Eclipse Theia IDE full-window (v4.0 scope only: R1–R4b)
**Researched:** 2026-08-19
**Confidence:** MEDIUM-HIGH (Firefox rebrand and sidecar-supervision precedents are well-documented; Theia-side branding and R4b URI semantics are MEDIUM — thin public precedent, verified against local Theia 1.74.1 source and this repo's own D1–D4 research)

This file maps table stakes / nice-to-have / anti-feature onto the four fixed
v4.0 requirement clusters (R1 rebrand, R2 build+sidecar, R3 presentation
surface, R4b tab URIs), not a generic competitive landscape — v4.0 has no
market competitors, it has correctness bars set by comparable engineering
(Firefox forks, VS Code remote/server products, Theia's own IDE distribution).

## Feature Landscape

### Table Stakes (Required for R1–R4b to Be Considered Done)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Firefox-side rename: `MOZ_APP_NAME`, `MOZ_APP_DISPLAYNAME`, `MOZ_APP_VENDOR` set in `mozconfig`/`confvars.sh` | `MOZ_APP_NAME` is the internal id baked into the executable name, the profile directory root, and dozens of build-time string substitutions. Get it wrong and half the app still says "firefox" in paths and about:support. `MOZ_APP_DISPLAYNAME` is the user-visible string shown in window title, About dialog, crash reporter, taskbar. | LOW | Set once, near the top of the fork's `sourcerer/confvars.sh`. Zen/Floorp/LibreWolf all do this as step one. Iceweasel precedent: kept `MOZ_APP_NAME=firefox` for compat but changed `MOZ_APP_DISPLAYNAME` — Sourcerer should NOT copy that half-measure; change both, since a from-scratch product has no compat constraint. |
| `branding/official`-equivalent directory replaced wholesale (icons, splash, `branding.nsi`, `locales/browserconfig.properties`) | Mozilla's official-branding license explicitly forbids shipping Firefox/Mozilla logos, icon, or brand assets in a third-party build — this is not optional polish, it is the trademark condition that makes distribution legal at all. | LOW-MEDIUM | Precedent (LibreWolf, Floorp) all ship a full custom `branding/` tree from day one, not a patched original. Do this before any other rebrand step — everything else is UI string work, this is the legal gate. |
| Profile directory renamed away from `~/.mozilla/firefox` | `MOZ_APP_NAME` drives the default profile root (LibreWolf → `~/.librewolf`, Zen → `~/.zen`). Two forks sharing Firefox's profile directory corrupt each other's `prefs.js`/`places.sqlite` on first launch — this is the #1 way an unbranded fork silently breaks a user's existing Firefox install. | LOW | Falls out of `MOZ_APP_NAME` correctly; verify explicitly in v4.0 acceptance testing rather than assuming — this is exactly the class of "breaks if missed" bug that doesn't show up until a machine already has real Firefox installed. |
| Update channel disabled or pointed at Sourcerer's own AUS endpoint — never left pointed at Mozilla's | Firefox's built-in updater (`app.update.*` prefs, `updater.ini`) will silently try to fetch Mozilla's official update XML if branding prefs aren't fully overridden, and Mozilla's update server correctly refuses/ignores unrecognized app IDs — but shipping a build that *tries* is both wasted work and a trust problem if it ever succeeds against a MITM'd channel. | LOW (v4.0: disable) / HIGH (later: own AUS) | v4.0 scope per PROJECT.md is a single-host dev build — **table stakes for v4.0 is disabling auto-update**, not standing up update infrastructure (that's a documented future cost: "we own updater infrastructure and an update channel"). Disabling is one pref (`app.update.enabled=false`) plus removing/replacing `update-settings.ini`'s public key so a spoofed URL can't validate. |
| Distribution ID set (`--with-distribution-id`) away from Mozilla default | Same trademark-adjacent surface as branding assets — telemetry pings, search-engine config loading, and some crash-reporter behavior branch on distribution id; leaving it as `org.mozilla` misattributes Sourcerer's data to Mozilla's pipeline if any of those paths are still live. | LOW | One build flag, verify no residual Mozilla telemetry endpoint is reachable (see anti-feature: no telemetry infra needed if the endpoint is simply not configured). |
| Theia-side branding: welcome/getting-started widget, About dialog, window/tab title, favicon | R1 explicitly names these two Theia surfaces. Theia IDE's own `theia-ide-product-ext` is the load-bearing precedent — it overrides `GettingStartedWidget` and the About dialog via DI rebind, not by patching `@theia/core`, which is exactly R3's "extension-based internals" constraint applied to the reference implementation itself. | LOW-MEDIUM | Build `@sourcerer/product` (or fold into `@sourcerer/branding`) shaped like `theia-extensions/product/` in the Theia IDE repo: rebind `AboutDialog`, extend `GettingStartedWidget`, set `applicationName` in the frontend module, replace `index.html` title/favicon. No core patch needed — the seam already exists. |
| Sidecar process lifecycle: spawn on browser start, health-check, restart on crash, kill on browser quit | This is R2's explicit contract for `TheiaService.sys.mjs`. Every comparable remote/local dev-server product (code-server, OpenVSCode Server, VS Code Server, Jupyter) treats "orphaned server process after client exit" and "silently-dead server the client never notices" as the two defining failure modes to design against. | MEDIUM | code-server's unauthenticated `/healthz` is the right shape: cheap liveness probe, no auth required for local-loopback-only polling. Kill-on-quit needs to handle both graceful browser exit and crash (process group / `SIGTERM` then `SIGKILL` fallback) — a leaked Node process after Firefox crashes is the concrete failure this guards against. |
| Localhost-only binding + token authentication for the sidecar | Every reference implementation researched (VS Code Server's random-port + disk-stored connection key readable only by the current user, OpenVSCode Server's `--connection-token`) treats "authenticated to this one browser instance" as non-negotiable even for pure-localhost services, because any other localhost process (or a browser tab navigating to the port) can otherwise read/write the workspace. | LOW-MEDIUM | Generate a token per-launch, pass to Theia backend via env var or CLI arg, embed in the Firefox-side load URL. Bind to `127.0.0.1` explicitly, not `0.0.0.0`. |
| Port collision handling: pick a free port at spawn time, don't hardcode | A hardcoded port (Theia's dev default 3000) collides with any other local dev server the user is running — a certainty on a developer's own machine, not an edge case. | LOW | Standard "bind to port 0, read back the OS-assigned port" pattern; every precedent researched (VS Code Server, Jupyter) does this by default now. |
| Single-instance enforcement | Firefox already has a working single-instance mechanism (profile lock file + remote-command IPC to focus the existing window) — R2 does not need Sourcerer to reinvent this, only to make sure the sidecar spawn logic is idempotent against Firefox's existing "second launch reuses first window" behavior so a second launch doesn't spawn a second orphaned Theia backend. | LOW | Table stakes is *not breaking* Firefox's native lock, not building a new one. |
| Theia loads full-window with Theia's own tab bar/menu/status bar intact | R2/R4: "Theia loads full-window as the sole GUI." No custom chrome in v4.0 means Theia's own `@theia/core` shell (menu bar, activity bar, status bar, toolbar) is the *entire* UI — none of it is suppressed. | LOW | This is the do-nothing-extra path: don't hide any Theia shell surface in v4.0, since there's no replacement chrome yet to hand those responsibilities to (menu, back/forward, terminal) — hiding them now would leave the app with no menu at all. |
| Every widget type implements `Navigatable.getResourceUri()` under its own scheme, with a registered `NavigatableWidgetOpenHandler` per scheme | This is R4b verbatim. Confirmed against Theia 1.74.1 source (`navigatable-types.ts`, `navigatable.ts`) that editors already do this and nothing else does — the seam exists, the work is per-widget-type implementation, not framework surgery. | HIGH | The "reusable prerequisite" work per this repo's own D4 decision. Scope for v4.0: settings, terminal, and whatever chat/AI view ships by v4.0 — each is its own scheme (`settings://`, `terminal://`, `chat://`). URI *semantics* (typeable? what does the path encode?) are decided per-widget at implementation time, not upfront — the parent research doc explicitly defers this as "cheap now, miserable later" but not required before v4.0 starts. |
| Runtime customization bridge (`@sourcerer/customize`) ships, visually inert by default | R4a: exists in v4.0 but changes nothing visually. Table stakes is the *seam* (CSS injection point + dev-flagged JS layer) existing and doing nothing, not that anything visible uses it yet. | MEDIUM | userChrome.css-equivalent: a stylesheet loaded after Theia's own, empty by default. The dev-flagged privileged JS layer is the harder half — needs a real gate (build flag or runtime flag checked before any privileged binding is exposed) so it can't be silently promoted to always-on later. |

### Differentiators (Nice-to-Have Within v4.0 Scope — Raise Quality, Not Required to Ship)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sidecar crash gives a visible, branded error state instead of a blank/frozen window | code-server and VS Code Server both treat "server died, client has no idea" as a real support-ticket generator. A Sourcerer-branded "the Theia backend stopped — retry" screen (rendered by Firefox chrome, not Theia, since Theia can't render if its own backend is down) is cheap relative to the support cost of silent failure. | LOW-MEDIUM | Owned by `TheiaService.sys.mjs` + a minimal chrome-side fallback page. Not required for R2 literally ("health-check, restart" is required; a *user-facing* message about it is the nice-to-have layer on top). |
| `about:sourcerer` or similar diagnostic page (sidecar port, PID, health status, log tail) | Every comparable product ships a diagnostics surface (`about:support` in Firefox, `/healthz` + logs in code-server) because "is the sidecar actually running and why not" is the first debugging question in any bug report. | LOW | Cheap to build once `TheiaService.sys.mjs` already tracks this state for health-checking — mostly a rendering exercise, not new plumbing. |
| Startup performance: sidecar spawn overlapped with Firefox chrome paint (don't block window show on Theia readiness) | Perceived launch speed matters even in a dev tool; VS Code Server and Jupyter both show *something* immediately rather than a blank window until the backend answers. | MEDIUM | Show Firefox chrome immediately, load a loading/splash state in the content area, swap to Theia once the health-check passes. Deferrable — v4.0's bar is "boots and shows Theia," not "boots fast." |
| `settings://` and `terminal://` URIs are typeable/copy-pasteable, not just internally addressable | R4b requires the `Navigatable` implementation to exist; it does *not* require the resulting URIs to be user-facing yet (no address bar exists in v4.0 — that's post-4.0 R5). Making them genuinely typeable now (vs. just structurally present) is forward-compatible polish that costs little extra once `getResourceUri()` exists, but isn't required to satisfy R4b's letter. | LOW (given table-stakes work is done) | This is explicitly the kind of decision the parent research doc flags as "decided during implementation" — worth leaning toward "yes, typeable" since it's the cheaper direction to have chosen once the chrome URL bar (R5) lands. |
| Distinct dev-build indicator (icon badge, title suffix) separating a NixOS dev build from any future packaged release | Every browser fork with a Nightly/dev channel does this (Firefox Nightly icon vs. release icon) so a developer running two builds side-by-side doesn't confuse them, and so accidental "is this the dev build or a real release" support questions don't happen once packaging exists. | LOW | Cheap now, matters more once R2's "Windows/macOS packaging follows" work starts — a purely dev/local v4.0 could defer this, but it's near-free to add alongside the rest of R1's branding pass. |

### Anti-Features (Explicitly Out of Scope for v4.0 — Do Not Build)

| Feature | Why It Looks Needed | Why It's Wrong for v4.0 | Alternative |
|---------|---------------------|--------------------------|-------------|
| Custom browser chrome — tab strip, toolbar, URL bar, panels | R4b makes every Theia tab URL-addressable, which *feels* like it wants a URL bar to display those URLs in. | PROJECT.md is explicit: "Custom browser GUI in v4.0 ... post-4.0 milestones." R4b's value in v4.0 is purely the reusable `Navigatable` plumbing — the bar that reads it is R5, a separate, later milestone with its own chrome-ownership design questions (per the shell-customization research's own "open questions" list). Building the bar now means building it twice once R5's chrome-owned tab model design lands. | Ship the URI plumbing now (table stakes above); defer any UI that surfaces it. |
| Electron packaging or dual Electron+Firefox targets | Theia's own reference distribution ships an Electron app, so it's the path of least resistance to copy. | PROJECT.md: "Electron packaging — never the plan; the Electron framing in an early requirements draft was a drafting error." The entire point of the Firefox substrate (DRM, WebExtensions, site isolation) is lost by falling back to Electron for convenience. | Build `applications/browser` (Theia's browser target), not `applications/electron` — confirmed as decision D3 in the shell-customization research. |
| Self-hosted Open VSX plugin registry / third-party extension distribution | R4b's URI scheme work and R3's extension-based internals both gesture toward "extensions" as a concept, inviting scope creep into "let's also support installing them." | This is R9 explicitly, marked post-4.0 ("when third-party distribution matters"). v4.0 has exactly the `@sourcerer/*` extensions Sourcerer itself ships — no registry, no install UI, no third-party plugin story. | Bundle `@sourcerer/*` extensions directly in the Theia workspace; no registry infrastructure. |
| Re-hosted WebExtension UI (toolbar buttons, popups, permission prompts) inside the Theia surface | R7 (inherited from Firefox substrate) makes WebExtensions *technically* available from day one, which invites "why not surface an extension button now, it's basically free." | Explicitly out of scope: "Firefox extension (WebExtensions) UI surfacing in v4.0 — the host ships inside the fork but re-hosted extension UI is sketch milestone 5." Nothing in v4.0's full-window-Theia design has anywhere to put that UI yet — it belongs to the chrome that doesn't exist until post-4.0. | None needed for v4.0; WebExtensions ride along inertly as a substrate capability, unsurfaced. |
| Full auto-update infrastructure (own AUS server, signed MAR files, rollout channels) | "Update channel handling" is genuinely table stakes for *not pointing at Mozilla's servers* — it's a short hop from there to "so let's build our own updater too." | v4.0's finish line is "a daily-drivable dev build on the Linux/NixOS host" (PROJECT.md, Out of Scope: "Windows/macOS packaging in v4.0 ... installers and multi-platform CI are a later milestone"). Owning update infrastructure is explicitly logged as an accepted *future* cost, not a v4.0 deliverable. | Disable Firefox's updater (one pref); revisit when packaging/distribution becomes a milestone. |
| Opt-in telemetry pipeline | Rebranding necessarily touches Firefox's existing telemetry plumbing (which must be disabled/repointed away from Mozilla), making it tempting to wire up "our own" telemetry while already in that code. | PROJECT.md lists this explicitly under "Open items (not yet requirements)": "Opt-in telemetry (wanted; design undecided)." Undecided design + not a requirement = do not build speculatively. | Disable/strip Mozilla's telemetry endpoints as part of the rebrand (table stakes); leave the "add our own" question for a later milestone. |
| Cross-platform (Windows/macOS) build support or installers | A "real" browser fork feels incomplete without at least a Windows build, and Firefox's own build system nominally supports it. | Out of scope by name in PROJECT.md. NixOS/Linux is the only dev and delivery target for v4.0; the artifact-build strategy chosen for speed is itself somewhat Linux/Nix-shell-specific in its tooling assumptions. | Single-platform Linux dev build; multi-platform is a named later milestone. |
| Mobile (Android/iOS) targets | Firefox's codebase technically has a GeckoView mobile path, so "what about mobile" is a natural question once the substrate choice is explained. | PROJECT.md: "Mobile — Android would be a separate GeckoView product; iOS has no shippable Gecko." Not a variant of v4.0, a different product entirely. | None — not a v4.0 concern in any form. |
| Patching/forking Theia core or Gecko to implement any v4.0 feature | Some Navigatable/shell seams may feel awkward to reach purely through extension APIs, tempting a "just patch the one file" shortcut. | Hard rule in this repo's CLAUDE.md and R3: "Never fork or patch Theia core," "Gecko itself is never modified." This is what keeps both upstreams re-pinnable/rebaseable — the entire cost model of the project depends on it. | Anti-corruption layer (`SourcererAPI.sys.mjs`) on the Firefox side, DI rebind/subclass on the Theia side (per D2 in the shell-customization research) — confirmed real seams exist for every v4.0 need identified so far. |

## Feature Dependencies

```
[MOZ_APP_NAME / MOZ_APP_DISPLAYNAME set] (R1)
    └──requires──> nothing (do first, build-config only)

[branding/ directory replaced] (R1)
    └──requires──> nothing (parallel with MOZ_APP_NAME)
    └──gates──> [legal distribution at all — trademark condition]

[Update channel disabled] (R1)
    └──requires──> [MOZ_APP_NAME set] (branding prefs cascade from app id)

[Profile directory rename] (R1)
    └──enhanced-by──> [MOZ_APP_NAME set] (falls out of it automatically)

[Sidecar spawn + health-check + restart] (R2)
    └──requires──> [Port collision handling] (spawn logic needs a free port first)
    └──requires──> [Token auth] (spawn must mint token before first load)
    └──gates──> [Theia full-window load] (nothing to show until sidecar is up)

[Theia-side branding: welcome/about/title] (R1)
    └──requires──> [Theia browser-target build exists] (R2 — needs a Theia app to extend)
    └──independent-of──> Firefox-side branding (can build/iterate via yarn watch alone,
                          per PROJECT.md's decoupled-build strategy)

[@sourcerer/customize seam] (R4a)
    └──requires──> [Theia browser-target build exists] (R2)
    └──independent-of──> R4b (no shared code, both are separate @sourcerer/* extensions)

[Navigatable.getResourceUri() per widget type] (R4b)
    └──requires──> [Theia browser-target build exists] (R2)
    └──requires──> [NavigatableWidgetOpenHandler registered per scheme] (framework seam,
                    confirmed present in Theia 1.74.1 core — no upstream work needed)
    └──enables (post-4.0)──> [R5 chrome URL bar] and [R5 unified tab strip]
    └──conflicts-with (if skipped)──> any future URL bar work, which would then need
                    to retrofit URI support per-widget under time pressure instead of
                    upfront — this is the repo's own stated rationale for pulling R4b
                    into v4.0 rather than deferring it

[Custom browser chrome / URL bar] (anti-feature, R5)
    └──conflicts-with──> shipping v4.0 as scoped; explicitly deferred
```

### Dependency Notes

- **Sidecar spawn requires port collision handling and token auth before first load:** the
  Firefox-side load URL to Theia (`http://127.0.0.1:<port>/?token=<token>`) can't be
  constructed until both are resolved, so these three table-stakes items are effectively
  one atomic unit of work, not three independent tickets.
- **Theia-side branding is independent of Firefox-side branding:** this repo's own build
  strategy note confirms it — "R1(Theia-side)/R4a/R4b iterate with yarn watch and no
  Firefox build in the loop." Plan these as parallelizable workstreams, not sequential.
- **R4b enables R5 but does not require it:** the URI plumbing ships fully self-contained
  in v4.0 with no consumer UI. This is *why* it was pulled forward (per PROJECT.md's Key
  Decisions table) — it's valuable and buildable in isolation, unlike a URL bar which has
  nowhere to live until R5's chrome-ownership design exists.
- **Anti-feature "custom chrome" conflicts with the whole v4.0 scope statement:** any
  scope discussion that starts drifting toward "let's just add a small address bar since
  we already have the URIs" should read as the conflict this dependency graph names
  explicitly.

## MVP Definition

### Launch With (v4.0 — Table Stakes Only)

- [ ] Firefox rebrand complete (`MOZ_APP_NAME`, `MOZ_APP_DISPLAYNAME`, `MOZ_APP_VENDOR`, full `branding/` tree, profile dir renamed, update channel disabled, distribution id changed) — legal and identity baseline, non-negotiable
- [ ] Theia-side branding complete (welcome widget, About dialog, window/tab title, favicon) via `@sourcerer/*` extension, no core patch
- [ ] `TheiaService.sys.mjs`: spawn, port-collision-safe bind, token-authenticated localhost, health-check, restart on crash, kill on quit
- [ ] Theia loads full-window with its own default shell (menu/status/tab bar) untouched — no suppression, no custom chrome
- [ ] `@sourcerer/customize` seam exists (CSS layer + dev-flagged JS layer), visually inert
- [ ] `Navigatable.getResourceUri()` + per-scheme `NavigatableWidgetOpenHandler` implemented for at least settings and terminal widgets (R4b's letter — "any other non-document widget" scales with whatever ships by v4.0, not a fixed list)
- [ ] Builds and runs on the NixOS dev host via the decoupled Theia/Firefox build strategy already decided (Nix flake, two dev shells, artifact builds)

### Add After Validation (nice-to-have, still v4.0-scope-compatible)

- [ ] Branded sidecar-crash error state (chrome-rendered, not Theia-rendered)
- [ ] `about:sourcerer`-style diagnostic page for sidecar status
- [ ] Overlapped startup (chrome paints before sidecar health-check passes)
- [ ] Typeable `settings://`/`terminal://` URIs, not just internally addressable
- [ ] Dev-build visual indicator (icon/title badge)

### Future Consideration (post-4.0, do not build now)

- [ ] R5 unified tab strip / chrome URL bar consuming R4b's URIs
- [ ] R6 fully customizable GUI beyond the inert R4a seam
- [ ] R7 WebExtension UI re-hosting (toolbar buttons, popups, permissions, downloads)
- [ ] R8 AI integration beyond what Theia AI ships by default
- [ ] R9 Open VSX plugin registry
- [ ] Own update/AUS infrastructure, opt-in telemetry, Windows/macOS packaging, mobile

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Firefox rebrand (name/branding/profile/update-channel/distribution-id) | HIGH | LOW | P1 |
| Theia-side branding (welcome/about/title) | HIGH | LOW-MEDIUM | P1 |
| Sidecar lifecycle (spawn/health-check/restart/kill) | HIGH | MEDIUM | P1 |
| Sidecar token auth + port collision handling | HIGH | LOW-MEDIUM | P1 |
| Theia full-window, default shell untouched | HIGH | LOW | P1 |
| `@sourcerer/customize` inert seam | MEDIUM | MEDIUM | P1 |
| R4b `Navigatable`/URI plumbing (settings, terminal, others as shipped) | HIGH (forward-compatibility value) | HIGH | P1 |
| Branded sidecar-crash error state | MEDIUM | LOW-MEDIUM | P2 |
| Diagnostics page | MEDIUM | LOW | P2 |
| Overlapped startup / perceived speed | LOW-MEDIUM | MEDIUM | P3 |
| Typeable URIs (vs. structural-only) | LOW-MEDIUM | LOW | P2 |
| Dev-build indicator | LOW | LOW | P3 |
| Custom chrome / URL bar | N/A — anti-feature | N/A | Out of scope |
| Own AUS/update infra | N/A — anti-feature | N/A | Out of scope |

**Priority key:**
- P1: Required — v4.0 does not satisfy R1–R4b without it
- P2: Should have, add once P1 is stable, still within v4.0's boundaries
- P3: Nice to have, defer without risk to the milestone

## Precedent / Comparable-Product Analysis

| Concern | Firefox forks (Zen, Floorp, LibreWolf) | VS Code remote family (code-server, OpenVSCode Server, VS Code Server) | Sourcerer's approach |
|---------|------------------------------------------|--------------------------------------------------------------------------|-----------------------|
| Rebrand mechanism | `MOZ_APP_NAME`/`MOZ_APP_DISPLAYNAME` + full custom `branding/` tree; own profile dir (`~/.zen`, `~/.librewolf`) | N/A (not a browser fork) | Same mechanism, confirmed correct by three independent precedents — no invention needed |
| Update channel | Each ships its own updater infra or disables Mozilla's | N/A | v4.0 disables; own AUS is an accepted future cost, not built now |
| Sidecar liveness | N/A | Unauthenticated `/healthz`, idle-timeout, restart-on-crash all standard | `TheiaService.sys.mjs` health-check mirrors this — same shape, different transport (Firefox process supervision vs. systemd/docker) |
| Sidecar auth | N/A | Random port + disk-stored connection token, readable only by current user; `--connection-token`/`--connection-token-file` | Token-authenticated localhost per R2's own text — directly matches OpenVSCode Server's model |
| Chrome/workbench extensibility | Full native chrome, extensively modded by these forks (workspaces, split view, vertical tabs) | VS Code's extension API has **no** workbench-toolbar insertion point (confirmed: `microsoft/vscode#41309` still open) — every marketplace "toolbar" extension is confined to sidebar/editor-title/status-bar | Theia (not VS Code) is the chosen IDE precisely because it *does* expose DI-rebindable shell seams — this is this repo's own D1–D4 finding, reconfirmed here as the reason R4b/R4a are buildable without core patches |
| Tab URI addressing | N/A (browser tabs already have URLs natively) | `vscode://` scheme exists but is extension-invocation-oriented (`vscode://{extension-id}?...`), not a "every workbench tab has a resolvable URI" model; VS Code core widgets (settings, terminal) are not URI-addressable the way editors are | R4b closes exactly this gap that VS Code has never closed — Theia's `Navigatable` interface is the enabling seam VS Code lacks |

## Sources

- [MOZ_APP_DISPLAYNAME should be Firefox when official branding is enabled — Bugzilla 525306](https://bugzilla.mozilla.org/show_bug.cgi?id=525306) — MEDIUM confidence (community/bug-tracker source, cross-checked against build-config precedent)
- [allow MOZ_APP_NAME to be set by configure — Bugzilla 649722](https://bugzilla.mozilla.org/show_bug.cgi?id=649722) — MEDIUM confidence
- [Debian–Mozilla trademark dispute — Wikipedia](https://en.wikipedia.org/wiki/Debian%E2%80%93Mozilla_trademark_dispute) — MEDIUM confidence, establishes why full rebrand (not partial) is the safe legal posture; matches PROJECT.md's own framing ("A full rename is mandatory anyway")
- [Comparison of some Firefox forks — Blue Fox](https://www.bluefoxconsultant.com/en/blog/blue-fox-articles-2/comparison-of-some-firefox-forks-193) — MEDIUM confidence, corroborates profile-directory-rename pattern across three independent forks
- [zen-conf — GitHub](https://github.com/arch-err/zen-conf) — MEDIUM confidence
- [Extending/Adopting the Theia IDE — theia-ide.org](https://theia-ide.org/docs/blueprint_documentation/) — MEDIUM-HIGH confidence (official docs)
- [Product Extension — eclipse-theia/theia-ide DeepWiki](https://deepwiki.com/eclipse-theia/theia-ide/6.1-product-extension) — MEDIUM confidence (third-party generated docs, but consistent with local Theia source structure), confirms the About-dialog/GettingStartedWidget override pattern this file recommends
- [code-server guide — coder/code-server](https://github.com/coder/code-server/blob/main/docs/guide.md) — HIGH confidence (official docs)
- [Healthcheck issue — coder/code-server Discussion #7132](https://github.com/coder/code-server/discussions/7132) — MEDIUM confidence, confirms unauthenticated `/healthz` design intent
- [Visual Studio Code Server — code.visualstudio.com](https://code.visualstudio.com/docs/remote/vscode-server) — HIGH confidence (official docs), source for random-port + disk-token-file pattern
- [GitHub - gitpod-io/openvscode-server](https://github.com/gitpod-io/openvscode-server) — HIGH confidence (official repo), source for `--connection-token`/`--connection-token-file`
- [Allow deep links for VS Code handlers to specify a minimum extension version — microsoft/vscode#239135](https://github.com/microsoft/vscode/issues/239135) — MEDIUM confidence, corroborates `vscode://{extension-id}?...` shape
- Local project sources (HIGH confidence, primary):
  `/home/chris/coding/sourcerer/.planning/PROJECT.md`,
  `/home/chris/coding/sourcerer/docs/PRODUCT-REQUIREMENTS.md`,
  `/home/chris/coding/sourcerer/docs/research/tab-management-research/05-theia-shell-customization.md`
  (verified against local Theia 1.74.1 checkout at `/home/chris/Vibe Coding/TheiaIDE/sources/`)

---
*Feature research for: branded Firefox-ESR fork + Theia full-window IDE (Sourcerer v4.0)*
*Researched: 2026-08-19*
</content>
