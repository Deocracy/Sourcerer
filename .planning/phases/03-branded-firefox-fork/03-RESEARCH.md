# Phase 3: Branded Firefox Fork - Research

**Researched:** 2026-08-21
**Domain:** Firefox/Gecko build-system branding, patch-stack mechanics, Nix toolchain
**Confidence:** HIGH for mechanics directly read from `upstream/` and empirically reproduced in the scratchpad; MEDIUM/LOW where flagged.

<user_constraints>
## User Constraints (from CONTEXT.md)

This research does not re-open any decision below. All of D-70 through D-88 are
locked; this document answers **how to implement them**, not whether to.

### Locked Decisions (D-70..D-88, verbatim intent, condensed — see 03-CONTEXT.md for full text)

- D-70: BUILD-04 rewritten to the tiered incremental loop (`./mach run` zero-build
  for symlinked files, `./mach build faster` for preprocessed files, full
  `./mach build` only after a compiled-define change). No artifact builds.
- D-71: sccache lands in the `firefox` devShell this phase (`pkgs.sccache`,
  `--with-ccache=sccache`, `RUSTC_WRAPPER=sccache`), with one required smoke test.
- D-72: `scripts/check-patch-surface.sh` is an executable guard on the suffix set
  from `emitter.py:1126-1133`; documented in the existing `docs/BUILD.md`, not a
  new `ARTIFACT-BOUNDARY.md`. `sourcerer/INTERNAL-APIS.md` is NOT created here.
- D-73: two acceptance checks — guard's positive control, and re-measured tiered
  timings written into `docs/BUILD.md` with date and exact command.
- D-74: `upstream/` stays fully disposable; `patches/` is the single source of
  truth; no parallel `--enable-application=sourcerer` project tree.
- D-75: adopted-patch detection is a post-apply assertion per patch; the
  `git apply --3way`-on-already-adopted-content experiment is **required** and
  its result changes how dangerous the assertion is (see Architecture Patterns,
  below — this has now been run).
- D-76: `fetch-upstream.sh`'s clean-tree gate evolves to allow known dirt
  (patch stack + branding overlay) and hard-fail on anything else.
- D-77: `scripts/rebase-upstream.sh` + a `workflow_dispatch`-only GitHub Actions
  entry. No cron schedule.
- D-78: `imply_option("MOZ_APP_UA_NAME", "Firefox")` — UA byte-identical to stock.
- D-79: BRAND-01 criterion rewritten as the six-item named-surface checklist
  (executable name, `application.ini` Name/Vendor, about:support fields, window
  title, `.desktop` Name/StartupWMClass, `--version` output).
- D-80: `MOZ_APP_VENDOR` patched to `"Sourcerer"` in the same hunk as D-78.
- D-81: `MOZ_APP_PROFILE` is never set; `MOZ_APP_ID` is never changed; no
  LibreWolf-style deep de-Mozilla-ing of `nsXREDirProvider.cpp` etc.
- D-82: BRAND-06 ships two branding directories, `sourcerer/branding/{dev,release}`.
- D-83: Remote Settings stays; `firefox.settings.services.mozilla.com` is a named
  carve-out in the allowlist. **Its documented polling cadence needs a correction
  — see Common Pitfalls, "The 6-hour cadence claim is wrong."**
- D-84: Removal is build-time (`browser/moz.configure` hunk) + branding pref file
  (`pref/firefox-branding.js`, filename hardcoded) + `policies.json` for the
  handful that must be locked. No autoconfig `.cfg`.
- D-85: allowlist is strict — every unlisted host fails, Mozilla or not.
- D-86: DRM (Widevine) is deliberately kept working; it is genuinely lazy on Linux.
- D-87: `media.gmp-gmpopenh264.enabled = false` and
  `extensions.systemAddon.update.enabled = false`.
- D-88: three proof layers (static grep, `strace` exact-path, `MOZ_LOG`), each
  with a working positive control (restore `aus5.mozilla.org` and confirm red).

### Claude's Discretion (research supports, does not decide)

- Branding overlay mechanism (symlink vs staged copy) — **research finding:
  symlink works, see Architecture Patterns.**
- Branding asset pipeline / icon tool — **research finding: `inkscape` (already
  on host) covers it end-to-end, see Code Examples.**
- `.desktop` file shape and install path — **research finding: template below,
  built from a real Mozilla-authored reference in-tree.**
- Which prefs go in `policies.json` vs the unlocked branding pref file.
- Plan/wave slicing — leaning: tracer slice, then Wave-0 red-by-design harness,
  then feature plans (Phase 2's proven shape).
- `--with-distribution-id` value — CONTEXT.md used `org.deocracy` as a
  placeholder; confirm before planning locks it in.

### Deferred Ideas (OUT OF SCOPE)

`sourcerer.xhtml`, `SourcererAPI.sys.mjs`, `TheiaService.sys.mjs`,
`sourcerer/INTERNAL-APIS.md`, scheduled rebase CI, own update/AUS
infrastructure, self-hosted Remote Settings mirror, Windows/macOS branding
assets and installers, opt-in telemetry, ESR major-version transition
procedure, re-hosted WebExtension UI. None of these are touched by this
research.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-03 | `upstream/` + `patches/` + `sourcerer/` layout, documented CI-ready rebase | Architecture Patterns §Patch stack mechanics; empirically-run D-75 experiment below settles the fail-loud design |
| BUILD-04 | Tiered incremental rebuild loop, guard-enforced compiled-file boundary | Architecture Patterns §check-patch-surface.sh; Validation Architecture |
| BRAND-01 | Six-surface identity checklist | Code Examples §Identity surfaces; Common Pitfalls §--version format correction |
| BRAND-02 | Full replacement `branding/` tree, no Mozilla trademark assets | Architecture Patterns §The branding directory (file-by-file classification) |
| BRAND-03 | Sourcerer's own profile dir; never touches `~/.mozilla/firefox` | Code Examples §D-88 verification layers |
| BRAND-04 | Updates disabled; documented endpoint allowlist with the one named carve-out | Don't Hand-Roll §Pref inventory; Common Pitfalls §6-hour cadence correction |
| BRAND-06 | Dev builds visibly distinguishable from packaged release | Architecture Patterns §Two branding directories |
</phase_requirements>

## Summary

Every mechanical question this phase needs was answerable by reading
`upstream/` directly and, for the two genuinely unverified claims in
CONTEXT.md (D-75's patch experiment, D-84's overlay-mechanism symlink
question), by reproducing the exact scenario in a throwaway git repo in the
scratchpad. Both experiments are now run, not just planned, and the results
change how the plan should be written:

1. **`git apply --3way` on already-adopted content exits 0 with a completely
   silent no-op** (empty `git status --porcelain`, empty `git diff HEAD`) —
   confirming D-75's fear exactly. `git apply` **without** `--3way` and
   `git am` **without** `--3way` both correctly fail (exit 1 / 128) on the
   same input; `git am --3way` also silently no-ops (exit 0, "No changes --
   Patch already applied."). **`scripts/apply-patches.sh` must use `--3way`
   for legitimate upstream drift to still apply, which means D-75's
   post-apply per-patch assertion is not optional — it is the only thing
   that will ever catch a silently-dropped patch.**

2. **The symlink overlay mechanism works, and the reason is explicit in the
   source comment, not inferred.** `is_read_allowed()` and the sandbox's
   `exec_file()` override both do pure string-prefix matching
   (`mozpath.normpath` + `basedir`) with **no** `os.path.realpath()` call —
   the code says so directly: *"realpath() is needed for true security. But,
   this isn't for security protection, so it is omitted."*
   (`reader.py:219-220`). A symlink placed inside `upstream/` (e.g.
   `upstream/sourcerer -> ../../sourcerer`) passes every check because the
   *path string* still starts with `topsrcdir`; the OS transparently follows
   the symlink for the actual file reads. Reproduced empirically below.

3. **Two claims inherited into CONTEXT.md do not survive a direct read of
   `upstream/` and must be corrected before they land in `docs/BUILD.md` or a
   verification script:**
   - Remote Settings polls **every 24 hours** (`pref("services.settings.poll_interval", 86400)`
     — `modules/libpref/init/all.js:1745`), not 6 hours. The 6-hour number
     belongs to Normandy (`app.normandy.run_interval_seconds`,
     `firefox.js:2870`), which is being disabled anyway (D-84).
   - `--version` with both `MOZ_APP_BASENAME` and `MOZ_APP_VENDOR` set to the
     literal string `"Sourcerer"` prints **`Sourcerer Sourcerer 153.1.0`**
     (vendor and name concatenated, unconditionally — `DumpVersion()`,
     `nsAppRunner.cpp:2247-2260`), not the single-token `Sourcerer 153.1.0`
     D-80 states. Confirmed against the docs/BUILD.md-recorded stock output
     `Mozilla Firefox 153.1.0esr` (vendor≠name, no duplication visible) —
     the duplication only becomes visible once vendor and basename are the
     same string, which is exactly what D-80 does.

4. The icon pipeline, the `.desktop` file content, the branding directory's
   required-file set, and the exact pref/policy names for the D-84/85/86/87
   allowlist are all backed by files read this session, quoted verbatim
   below, or a real command actually run in the scratchpad (icon export
   pipeline was executed end-to-end, producing five real PNGs).

**Primary recommendation:** build `scripts/apply-patches.sh` around
`git apply --3way` **plus** D-75's non-negotiable post-apply
`git diff --exit-code -- <touched-file>` assertion per patch; use a symlink
(not a staged copy) for the branding overlay, registered in
`upstream/.git/info/exclude`; treat the two corrected facts above as blocking
for any verification script or doc that quotes an exact string.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity strings (name/vendor/UA) | Gecko build config (`moz.configure` + branding dir) | — | Compiled defines and `application.ini`; no runtime layer touches this |
| Icon/branding assets | Gecko build config (branding dir → `FINAL_TARGET_FILES`) | — | Static files installed by the build, not generated at runtime |
| Patch-stack replay | Repo tooling (`scripts/*.sh`, outside `upstream/`) | Gecko build config (consumes the patched tree) | BUILD-03 is a source-control/CI concern layered on top of, not inside, Gecko |
| Endpoint/telemetry removal | Gecko build config (compiled `imply_option`s) | Runtime prefs (branding pref file, `policies.json`) | Build-time flags remove compiled code paths; prefs handle what's still compiled in but must default off |
| `.desktop` / OS integration | Repo tooling (hand-authored file, not build-generated) | Gecko runtime (`gdk_set_program_class`/`XSetClassHint` must match `StartupWMClass`) | Firefox's build never emits a `.desktop` file; the two systems must agree on one string (`MOZ_APP_REMOTINGNAME`) |
| Rebuild loop / sccache | Nix devShell (`flake.nix`) | Gecko build config (`--with-ccache`, `RUSTC_WRAPPER`) | Toolchain wiring lives in the shell; the build system's own opt-in flags consume it |
| Verification (D-73, D-88) | Repo tooling (bash/node scripts) | Gecko runtime (the binary under test) | Same pattern as Phase 2: scripts drive and assert against a real running/built artifact, never mocked |

## Standard Stack

No new external package-manager dependency is introduced by this phase — see
Package Legitimacy Audit below. Everything is either already-declared Nix
inputs, already-present host tools, or files this phase authors directly.

### Core

| Tool | Version (verified) | Purpose | Source |
|------|---------------------|---------|--------|
| Firefox ESR | `153.1.0esr`, `468445e58d` | The tree being branded | already pinned (Phase 1) |
| `pkgs.sccache` | **0.17.0** on `nixos-unstable` | D-71's compiler cache | `[VERIFIED: nix eval nixpkgs#sccache.version]` — well above Firefox's own `sccache_min_version = Version("0.2.13")` floor (`toolchain.configure:867`) |
| `inkscape` | **1.4.4** (`dcaf3e7d9e`, 2026-05-05) | Icon recolor + PNG export, D-82/BRAND-02's asset pipeline | `[VERIFIED: inkscape --version, already on host at /run/current-system/sw/bin/inkscape]` — no new Nix package needed |
| `git` | host-provided | Patch stack mechanics | already a Phase-1 assumption in `fetch-upstream.sh` |

### Supporting

| Tool | Purpose | When to use |
|------|---------|-------------|
| `strace` | D-88 layer 2 (filesystem exact-path check) | Wave-0 verification harness; must already be on a standard NixOS dev host — not checked this session, flagged as Open Question below |
| `MOZ_LOG=nsHostResolver:5` | D-88 layer 3 (network host resolution log) | Same harness. Log module name **verified**: `LazyLogModule gHostResolverLog("nsHostResolver");` (`netwerk/dns/nsHostResolver.cpp:83`) |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|-------------|-----------|----------|
| `inkscape` CLI recolor+export | `rsvg-convert` / ImageMagick | **Neither is installed on this host** (`[VERIFIED: which rsvg-convert / which convert / which magick` all failed]`) — would require adding a new Nix package for something `inkscape` (already present) already does end-to-end. Rejected per the phase's own instruction to prefer an already-available tool. |
| Symlinked overlay | Staged copy (build-script-driven `cp -r` into `upstream/sourcerer/branding/`) | Copy avoids relying on `is_read_allowed`'s non-realpath behavior remaining unchanged upstream, but doubles on-disk state and needs its own dirty-tree accounting; CONTEXT.md's own leaning (symlink) is confirmed workable, see Architecture Patterns |
| `git apply --3way` for patch replay | `git am --3way` | Functionally identical on the already-adopted-content question (both exit 0, both silent) — `git apply` is simpler (no commit-object machinery, no `--abort` state to manage) and matches Zen's `surfer` `git-patch.ts` model (D-74's cited precedent uses `git apply`, not `git am`) |

## Package Legitimacy Audit

**No new npm/pip/cargo packages are installed by this phase.** All tooling
recommended above is either an existing Nix flake input (`pkgs.sccache`,
verified directly against the live `nixos-unstable` channel via `nix eval`,
not a registry lookup — N/A for the SLOP/SUS/OK npm-style verdict scale) or
already present on the host (`inkscape`, `git`). The Package Legitimacy Gate
protocol (npm/PyPI/crates registry check) does not apply to this phase; the
Nix-specific verification performed is documented in the Standard Stack table
above.

**Packages removed due to SLOP verdict:** none — no packages evaluated.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### Patch stack mechanics (BUILD-03, D-74, D-75)

**File format.** `patches/*.patch` should be plain `git diff`-format patches
(the format `git apply` consumes directly), not `git format-patch` mbox files
— see the alternatives table above for why `git apply` over `git am`.
Generate one from a working edit against `upstream/` with:

```bash
cd upstream
git diff > ../patches/010-vendor-and-ua.patch   # after editing browser/moz.configure
git checkout -- browser/moz.configure           # upstream/ must return to pristine (CLAUDE.md)
```

**Naming convention for explicit order.** Zero-padded numeric prefix
(`010-`, `020-`, …), gaps left between numbers for future insertions — the
exact scheme `zen-browser/surfer`'s `git-patch.ts` and LibreWolf's
`librefox-patches.py` both use (cited in CONTEXT.md's canonical refs; not
independently re-fetched this session — `[CITED: 03-CONTEXT.md D-74's own
precedent citation]`).

**`scripts/apply-patches.sh` shape**, given `upstream/` is a `--depth 1
--branch <tag>` shallow clone with only two refs (`FIREFOX_153_1_0esr_RELEASE`,
`_BUILD1` — confirmed by `03-CONTEXT.md` C-6, not re-verified this session
since it's a git-history fact unrelated to the build-system questions this
research targets):

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/upstream"

for p in "$REPO_ROOT"/patches/*.patch; do
  name="$(basename "$p")"
  # Capture pre-apply blob hash of every file the patch touches, so a
  # silent no-op (D-75) is detectable even though `git apply --3way`
  # exits 0 on one.
  touched_files="$(grep -E '^\+\+\+ b/' "$p" | sed 's#^+++ b/##')"
  before_hashes="$(for f in $touched_files; do git hash-object "$f" 2>/dev/null || echo "MISSING:$f"; done)"

  if ! git apply --3way "$p"; then
    echo "apply-patches: FAIL -- $name did not apply (real conflict, not silent)" >&2
    exit 1
  fi

  after_hashes="$(for f in $touched_files; do git hash-object "$f" 2>/dev/null || echo "MISSING:$f"; done)"
  if [ "$before_hashes" = "$after_hashes" ]; then
    echo "apply-patches: FAIL -- $name applied with exit 0 but changed nothing (D-75: silently already-adopted or a genuine no-op patch)" >&2
    exit 1
  fi
done
echo "apply-patches: all $(ls "$REPO_ROOT"/patches/*.patch | wc -l) patches applied and verified non-vacuous"
```

**The D-75 experiment result (run this session, in
`/tmp/.../scratchpad/patchexp2`, never inside `upstream/`):**

| Command | Exit code on already-adopted content | Working-tree change |
|---|---|---|
| `git apply --3way` | **0** | **none — true silent no-op** (`git status --porcelain` empty, `git diff HEAD` empty) |
| `git apply` (no `--3way`) | 1 | fails loudly, correctly |
| `git am --3way` | 0 | none ("No changes -- Patch already applied.") |
| `git am` (no `--3way`) | 128 | fails loudly, correctly |

`[VERIFIED: empirical scratchpad experiment, this session]`. This directly
answers the open question CONTEXT.md flagged: **exit code is 0, so D-75's
post-apply assertion is not belt-and-braces — it is the only mechanism that
catches a silently-dropped patch.** The `apply-patches.sh` sketch above
implements it via before/after blob-hash comparison rather than
`git diff --exit-code`, because after a *successful, non-vacuous* apply the
working tree legitimately differs from `HEAD` (that's the whole point of a
patch) — the check needs to distinguish "changed vs before this patch ran"
(hash comparison) from "changed vs committed HEAD" (which is always true and
useless as a signal here).

### The branding directory (BRAND-01, BRAND-02, BRAND-06, C-2)

Read directly: `upstream/browser/branding/branding-common.mozbuild`,
`upstream/browser/branding/unofficial/moz.build`,
`upstream/browser/branding/unofficial/locales/`, and every file inside
`unofficial/` (the closest real precedent to a from-scratch Linux-only
branding directory — it is Mozilla's own "no logo, no trademark" branding
target, used for Nightly-alike unofficial builds).

`FirefoxBranding()` template (`branding-common.mozbuild:6-35`, quoted in
full):

```python
@template
def FirefoxBranding():
    if CONFIG["MOZ_BRANDING_DIRECTORY"] == "browser/branding/official":
        JS_PREFERENCE_PP_FILES += ["pref/firefox-branding.js"]
    else:
        JS_PREFERENCE_FILES += ["pref/firefox-branding.js"]
    if CONFIG["MOZ_WIDGET_TOOLKIT"] == "windows":
        ...  # Windows-only, out of scope (Linux-only build)
    elif CONFIG["MOZ_WIDGET_TOOLKIT"] == "gtk":
        FINAL_TARGET_FILES.chrome.icons.default += [
            "default128.png", "default16.png", "default32.png",
            "default48.png", "default64.png",
        ]
```

Since `sourcerer/branding/{dev,release}` is not `"browser/branding/official"`,
the **unpreprocessed** `JS_PREFERENCE_FILES` branch is taken — the pref file
is loaded as-is, no `#ifdef`/`@AC_DEFINE@`-style preprocessing. Filename is
**hardcoded** to `pref/firefox-branding.js` — cannot be renamed (D-84 already
notes this; confirmed by direct read).

**File-by-file classification for a Linux-only build**, from the real
`unofficial/` directory listing (`find` output, this session) filtered to
what `moz.build`/`branding-common.mozbuild` actually reference for
`MOZ_WIDGET_TOOLKIT == "gtk"`:

| File | Category | Notes |
|------|----------|-------|
| `moz.build` | (a) required, verbatim copy | `DIRS += ["content", "locales"]; DIST_SUBDIR = "browser"; include("../branding-common.mozbuild"); FirefoxBranding()` — this exact 8-line file, no changes needed |
| `configure.sh` | (a) required | Sets `MOZ_APP_DISPLAYNAME` — this is where the dev/release display-name split (D-82) lives, e.g. `MOZ_APP_DISPLAYNAME=Sourcerer Dev` vs `MOZ_APP_DISPLAYNAME=Sourcerer`. Also `MOZ_MACBUNDLE_ID` — macOS-only, irrelevant to this Linux-only build but harmless to leave present-but-unused |
| `default{16,32,48,64,128}.png` | (a) required, own content | The gtk icon set `FINAL_TARGET_FILES.chrome.icons.default` installs. **These must be Sourcerer's own recolored mark**, not Mozilla's fox — see Code Examples for the exact generation pipeline |
| `pref/firefox-branding.js` | (a) required, own content | Filename fixed. Stock `unofficial` version (quoted in full below) is itself already telemetry-light (points at `nightly.mozilla.org`, not a real product) — treat as a **template to replace**, not to reuse verbatim, since every URL in it still points at Mozilla infrastructure |
| `content/jar.mn` | (b) required-but-can-be-scaffolding | References `about.png`, `about-logo*.png/svg`, `about-wordmark.svg`, `document.ico`, `document_pdf.svg`, `firefox-wordmark.svg`, `aboutDialog.css`, plus re-exports the same `default*.png` set under `content/branding/icon*.png`. **Only reachable from about:preferences/about-dialog UI, which BRAND-01's checklist does not test and Phase 3's scope explicitly excludes** (no chrome work). Safe to ship as a minimal stub `jar.mn` that only re-exports the already-produced `default*.png` set and points `about-logo*` at the same recolored mark, skipping the Windows/Mac-only assets |
| `content/aboutDialog.css` | (b) scaffolding-copyable | Purely cosmetic layout CSS for the About dialog; not identity-bearing, safe to copy from `unofficial/` unchanged |
| `locales/en-US/brand.ftl` | (a) required, own content | Carries `-brand-shorter-name`, `-brand-short-name`, `-brand-shortcut-name`, `-brand-full-name`, `-brand-product-name`, `-vendor-short-name` — **these are the Fluent terms surfaced throughout Theia-adjacent chrome UI wherever `{ -brand-short-name }` etc. is interpolated.** Stock `unofficial/` sets all four brand terms to `Nightly` and `-vendor-short-name = Mozilla` (quoted verbatim below) — **all must be replaced** with Sourcerer strings; `-brand-product-name = Firefox` should very likely stay `Firefox` per D-78's byte-identical-UA rationale (this specific term is what a small number of compatibility strings use to say "requires Firefox"), but this is a judgment call for the plan, not settled by this research — flagged as Open Question below |
| `locales/en-US/brand.properties` | (a) required, own content | Legacy (non-Fluent) equivalent: `brandShorterName`, `brandShortName`, `brandFullName` — same three values, properties-file syntax |
| `locales/jar.mn`, `locales/moz.build` | (b) scaffolding-copyable | Boilerplate JAR/build wiring, no identity strings, verbatim-copyable |
| `Assets.car`, `*.icns`, `*.ico` (non-default*), `msix/`, `stubinstaller/`, `*.VisualElementsManifest.xml`, `wizHeader*.bmp`, `branding.nsi`, `dsstore`, `background.png` | (c) **must NOT be carried forward** | Windows/macOS/MSIX/NSIS-installer-only assets — irrelevant to a Linux-only `--enable-application=browser` build (they are referenced only from the Windows branch of `FirefoxBranding()`, never built when `MOZ_WIDGET_TOOLKIT == "gtk"`), and several (`Assets.car`, the `.icns`/`.ico` set) are literally Mozilla's fox-logo binary assets — exactly what BRAND-02 forbids carrying forward. Simplest correct action: **do not copy these files into `sourcerer/branding/` at all** rather than deleting them post-copy |

**Brand.ftl, quoted verbatim (`unofficial/locales/en-US/brand.ftl`,
`[VERIFIED: Read, this session]`):**

```
-brand-shorter-name = Nightly
-brand-short-name = Nightly
-brand-shortcut-name = Nightly
-brand-full-name = Nightly
-brand-product-name = Firefox
-vendor-short-name = Mozilla
trademarkInfo = { " " }
```

**Brand.properties, quoted verbatim:**

```
brandShorterName=Nightly
brandShortName=Nightly
brandFullName=Nightly
```

**`FINAL_TARGET_FILES.chrome.icons.default` gtk branch, quoted verbatim
(`branding-common.mozbuild:28-35`):**

```python
elif CONFIG["MOZ_WIDGET_TOOLKIT"] == "gtk":
    FINAL_TARGET_FILES.chrome.icons.default += [
        "default128.png",
        "default16.png",
        "default32.png",
        "default48.png",
        "default64.png",
    ]
```

### The overlay mechanism (D-84's discretion item, C-2)

**Empirically reproduced, not just reasoned about.** `is_read_allowed()`
(`reader.py:109-132`, quoted in full):

```python
def is_read_allowed(path, config):
    assert os.path.isabs(path)
    assert os.path.isabs(config.topsrcdir)
    path = mozpath.normpath(path)
    topsrcdir = mozpath.normpath(config.topsrcdir)
    if mozpath.basedir(path, [topsrcdir]):
        return True
    hook = config.substs.get("MOZ_BUILD_HOOK")
    if hook and path == hook:
        return True
    return False
```

`mozpath.normpath` is `posixpath.normpath(normsep(path))` — pure string
normalization, no filesystem access. `mozpath.basedir` is a pure string
prefix-match loop (`[VERIFIED: python3 -c "import inspect; ...
mozpath.basedir/.normpath"` source dump, this session]`). Separately, the
sandbox's own `exec_file()` override says outright, in its own comment
(`reader.py:219-220`, quoted verbatim):

> `# realpath() is needed for true security. But, this isn't for security`
> `# protection, so it is omitted.`

**Scratchpad reproduction** (`/tmp/.../scratchpad/symlinktest`, this
session): created `faketopsrcdir/linked -> ../realtarget` (a symlink whose
target resolves entirely outside `faketopsrcdir`), ran the exact
`normpath`/`basedir` logic against `faketopsrcdir/linked/sub/testfile.txt`:

```
is_read_allowed result: True
actual realpath of candidate: .../scratchpad/symlinktest/realtarget/sub/testfile.txt
realpath is inside topsrcdir realpath? False
file content read through symlink: hello=world
```

**Conclusion: register the symlink as `upstream/sourcerer -> ../../sourcerer`
(or scope it to just the branding subtree, `upstream/sourcerer/branding ->
../../sourcerer/branding`, matching `--with-branding=sourcerer/branding/dev`
relative to `topsrcdir`).** Either the whole `sourcerer/` tree or just its
`branding/` subtree can be symlinked in; scoping to just `branding/` is
slightly safer (nothing else under `sourcerer/` needs to satisfy
`is_read_allowed`, since only the branding path is ever handed to
`--with-branding`).

**`.git/info/exclude` interaction, also empirically reproduced**
(`/tmp/.../scratchpad/gitexcludetest`): a symlinked directory shows as
`?? sourcerer/` in `git status --porcelain` until its name is added to
`.git/info/exclude`, after which `git status --porcelain` returns empty.
`scripts/fetch-upstream.sh`'s dirty-tree gate (D-76) greps this exact output
— so the fix is a one-line addition to `upstream/.git/info/exclude` (written
by `fetch-upstream.sh` itself, right after cloning, so it survives a
`rm -rf upstream && fetch-upstream.sh` re-materialize) alongside whatever
"known dirt" list D-76 needs for the patch stack's own working-tree changes.

### Two branding directories (D-82, BRAND-06)

`configure.sh`'s `MOZ_APP_DISPLAYNAME` is the natural differentiator (already
free per CONTEXT.md's "zero-patch" list) — `sourcerer/branding/dev/configure.sh`
sets a dev-suffixed display name, `sourcerer/branding/release/configure.sh`
does not. The icon set doubling D-82 accepts as a cost is generated by running
the same pipeline twice with two different accent/badge treatments (Code
Examples, below) — there is no build-system mechanism to derive one icon set
from the other at build time; both `default*.png` sets are independent static
files per branding directory, confirmed by the `FINAL_TARGET_FILES` wiring
above (it installs whatever five PNGs exist in whichever branding directory
`--with-branding` points at, with no relationship enforced between two
directories).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Vendor/UA/Normandy/HealthReport compiled defines | A new `moz.configure` file or a second project flag mechanism | The **single existing hunk** in `browser/moz.configure` (lines 6, 10, 14-15 today) | `project_flag`'s `possible_origins=("implied",)` (`util.configure:529`) means these four variables categorically cannot be set any other way — there is no zero-patch alternative to discover, this is a hard constraint of the framework, confirmed by reading the template's own implementation |
| `.desktop` file generation | A build-system hook that emits one from `application.ini` | A hand-written static file (D-79 discretion item) | The build produces **zero** `.desktop` files on any platform — confirmed: `find . -iname "*.desktop*"` inside `upstream/` returns only test fixtures and Mozilla's own CI docker image's reference file, never a generated/templated one in the actual install manifest |
| Endpoint blocking via a custom pref-scanning layer | A bespoke "network allowlist enforcer" component | `MOZ_LOG=nsHostResolver:5` (D-88 layer 3) | Gecko already has a purpose-built, per-module logging facility whose log line format is stable and whose module name (`nsHostResolver`) is verified present in-tree; reimplementing DNS-request observation is exactly the kind of "deceptively complex, someone already solved it" problem this section exists to flag |
| Icon recoloring | A hand-rolled SVG-to-PNG rasterizer or a Python Cairo script | `sed` text substitution on the SVG's inline `<style>` block, then `inkscape --export-type=png` | The source SVG (`logo/LE logo.svg`) uses a single CSS class (`.a{fill:#fff;}`) for every shape — a one-line `sed 's/fill:#fff/fill:<hex>/'` recolors the entire mark; `inkscape` (already on host) does the rasterization. No new tool, no custom code |

**Key insight:** every "don't hand-roll" item in this phase resolves to
*"use the mechanism Firefox's own build system already exposes for this,"*
because the phase's entire job is configuring an existing build system, not
writing new application logic. The one genuine gap (`.desktop` file) is a
5-line static text file, not a problem that warrants tooling.

## Runtime State Inventory

> Rebrand phase — trigger applies. All five categories answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No Sourcerer-branded build has ever run on this host; there is no existing `~/.config/sourcerer/` profile, cache, or cookie store to migrate. This is a first build, not a rename of a live installation. | none |
| Live service config | **None.** No external service (n8n-style, Datadog-style) is configured against any Sourcerer identity string yet. | none |
| OS-registered state | **None yet** — no `.desktop` file has ever been installed to `~/.local/share/applications/`, so there is nothing stale to re-register. **Forward-looking note for the plan:** once this phase's `.desktop` file is installed for local dev testing, a *later* change to `Exec=` or `StartupWMClass=` would need `update-desktop-database ~/.local/share/applications` (or `xdg-desktop-menu forceupdate`) re-run — a code-edit concern for a future phase, not a migration this phase must perform | none this phase; document the re-registration command in `docs/BUILD.md` for future changes |
| Secrets/env vars | **None.** No secret or CI env var currently references a Firefox/Sourcerer-specific name that this phase's rebrand would break. | none |
| Build artifacts | **One real item.** `objdir/dist/bin/firefox` already exists from Phase 1's stock (unbranded) full build. Once `.mozconfig`/`browser/moz.configure` gain the branding options and the `MOZ_APP_VENDOR` patch (a **compiled define**), a full `./mach build` must re-run for those to take effect (already D-70's own "compiled-define change" tier — not new information, just confirming the *existing* `objdir/` is exactly the stale artifact D-70 anticipates). **Genuinely unverified, flagged as Open Question below:** whether `./mach build`'s incremental mode deletes the now-orphaned `objdir/dist/bin/firefox` once `MOZ_APP_NAME` changes the binary name to `sourcerer`, or leaves both binaries present on disk | full `./mach build` re-run is already planned (D-70); verify the stale-binary question empirically once the first branded build actually runs, do not assume either way |

## Common Pitfalls

### Pitfall 1: The 6-hour Remote Settings cadence claim is wrong

**What goes wrong:** `03-CONTEXT.md` D-83 states Remote Settings polls "with
its 6-hour polling cadence recorded." If that number lands in `docs/BUILD.md`
or a verification script's comment, it documents something false.

**Why it happens:** Two different Mozilla subsystems both have a periodic
timer, and they were conflated. `services.settings.poll_interval` defaults
to **86400 (24 hours)** — `[VERIFIED: modules/libpref/init/all.js:1745]`,
quoted verbatim: `pref("services.settings.poll_interval", 86400); // 24H`.
The 6-hour number is real, but belongs to **Normandy**:
`pref("app.normandy.run_interval_seconds", 21600); // 6 hours`
(`[VERIFIED: browser/app/profile/firefox.js:2870]`). Normandy is being
disabled this phase (D-84, `imply_option("MOZ_NORMANDY", False)`), so its
cadence is moot — but Remote Settings, the thing that's actually staying on,
polls once a day, not every six hours.

**How to avoid:** when the plan writes the allowlist documentation, use 24
hours / 86400s for the `firefox.settings.services.mozilla.com` carve-out's
stated cadence. The decision to keep it (D-83) is unaffected — only the
number.

**Warning signs:** a verification script or doc comment that says "6-hour"
next to `firefox.settings.services.mozilla.com`.

### Pitfall 2: `--version` prints the vendor twice when vendor equals basename

**What goes wrong:** A verification script asserting `--version` output
equals the literal string `Sourcerer 153.1.0` (as D-80 states) will
false-fail against a correctly-configured build.

**Why it happens:** `DumpVersion()` (`toolkit/xre/nsAppRunner.cpp:2247-2260`,
quoted in relevant part):

```cpp
static inline void DumpVersion() {
  if (gAppData->vendor && *gAppData->vendor) {
    printf("%s ", (const char*)gAppData->vendor);
  }
  printf("%s ", (const char*)gAppData->name);
  printf("%s", MOZ_STRINGIFY(MOZ_APP_VERSION_DISPLAY));
  ...
}
```

`gAppData->vendor` comes from `application.ini`'s `Vendor=@MOZ_APP_VENDOR@`
and `gAppData->name` from `Name=@MOZ_APP_BASENAME@`
(`[VERIFIED: build/application.ini.in]`, quoted: `Vendor=@MOZ_APP_VENDOR@` /
`Name=@MOZ_APP_BASENAME@`). With `--with-app-basename=Sourcerer` (D-82's
free option) **and** `MOZ_APP_VENDOR` patched to `"Sourcerer"` (D-80), both
strings are literally `"Sourcerer"`, and `DumpVersion()` concatenates them
unconditionally — no dedup logic exists in the function. The output is
**`Sourcerer Sourcerer 153.1.0`**.

Cross-check against the *actual recorded* stock output in `docs/BUILD.md`:
`Mozilla Firefox 153.1.0esr` = vendor(`Mozilla`) + " " + name(`Firefox`) + " "
+ version(`153.1.0esr`) — same format, confirmed against real prior build
output, no duplication visible there only because stock vendor≠name.

**How to avoid:** write BRAND-01's `--version` acceptance check against the
actual two-token string, or design around it — e.g., if a single-token
`--version` output is genuinely wanted, that requires either a different
`MOZ_APP_VENDOR` value than the basename, or accepting the duplication as a
known cosmetic property of this specific config. This is a plan decision,
not something research should silently resolve — flagged again as an Open
Question below since it interacts with D-80's own reasoning about what
`--version` should show.

**Warning signs:** an assertion string of exactly `"Sourcerer 153.1.0"`
(one token) anywhere in a verification script.

### Pitfall 3: The gtk `StartupWMClass` binding is two separate call sites, not one

**What goes wrong:** patching only `MOZ_APP_REMOTINGNAME` and assuming the
`.desktop` file's `StartupWMClass` will automatically match what the running
window actually reports.

**Why it happens:** GTK/X11 window class is set from `gAppData->remotingName`
in **two** places: `gdk_set_program_class(gAppData->remotingName)`
(`[VERIFIED: widget/gtk/nsAppShell.cpp:485]`) sets the process-wide default,
and `nsWindow.cpp`'s per-window `XSetClassHint` (`[VERIFIED:
widget/gtk/nsWindow.cpp:4664-4680]`) falls back to
`gdk_get_program_class()` **only when `mGtkWindowAppClass` is empty**
(`res_class = !mGtkWindowAppClass.IsEmpty() ? mGtkWindowAppClass.get() :
gdk_get_program_class();`). In the default (undocked, non-embedded) case
`mGtkWindowAppClass` is empty, so the program-class value wins — meaning
`MOZ_APP_REMOTINGNAME` alone is sufficient for D-79 item 5 in the normal
case, but the plan's verification should check the **actual running
window's** `WM_CLASS` via `xprop`/BiDi rather than only grepping the
`.desktop` file for a string that matches by construction.

**How to avoid:** the `.desktop` file's `StartupWMClass=` value must be set
to exactly the same string passed to `MOZ_APP_REMOTINGNAME` (an env var set
at `mach run`/spawn time, or falling back to `MOZ_APP_NAME`-derived default
per `toolkit/moz.configure:3345-3354` if unset) — verify both independently,
don't assume setting one guarantees the other.

**Warning signs:** a verification pass that only checks the `.desktop` file
text, never the live window's `WM_CLASS` property.

### Pitfall 4: `inkscape`'s `-w`/`-h` distorts a non-square source, doesn't pad

**What goes wrong:** exporting `logo/LE logo.svg` (`viewBox="0 0 99 85.9"`,
aspect ratio ≈1.153:1, not square) with both `-w N -h N` set to the same
value produces exactly an N×N PNG, but the mark itself is stretched
non-uniformly (~13% vertical compression relative to its native proportions)
to fill the square canvas.

**Why it happens:** empirically reproduced this session — exporting the
recolored SVG at a deliberately mismatched `-w 200 -h 50` produced an
*exact* 200×50 output (verified via PNG IHDR chunk dimensions), confirming
Inkscape 1.4.4's CLI forces the literal requested pixel dimensions rather
than fitting-with-letterbox.

**How to avoid:** for this specific mark (an abstract crossed-lens/dot
shape, not text or a recognizable silhouette), a ~13% vertical squish at
icon sizes (16-128px) is very likely imperceptible — acceptable as-is. If
pixel-perfect proportions matter, export at the native aspect ratio into the
larger dimension (e.g. `-w 128` alone, letting Inkscape derive height ≈111px
from the viewBox ratio) and pad the shorter axis to square in a follow-up
step. This is a cosmetic judgment call for the plan, not a blocker — flagged
so it isn't discovered by surprise when the icons render slightly squashed.

**Warning signs:** a visual regression check that fails on icon aspect ratio
without first deciding to fix vs accept it.

## Code Examples

### Icon generation — the exact, already-run pipeline

Verified end-to-end this session in the scratchpad (produced five real PNGs,
sizes confirmed via PNG IHDR chunk parsing, file sizes scale with
resolution as expected for real rendered content, not blank output):

```bash
# Recolor: the source SVG uses one CSS class for every shape.
sed 's/fill:#fff/fill:#2B6CB0/' "logo/LE logo.svg" > /tmp/recolored.svg
# (pick the real Sourcerer accent color — #2B6CB0 was an arbitrary
# placeholder used only to prove the pipeline works)

# Export the gtk icon set branding-common.mozbuild actually installs:
for size in 16 32 48 64 128; do
  inkscape /tmp/recolored.svg \
    --export-type=png \
    --export-filename="sourcerer/branding/dev/default${size}.png" \
    -w "$size" -h "$size" \
    --export-background-opacity=0
done
```

Source: `[VERIFIED: inkscape --help output for exact 1.4.4 flag names,
this session]` + the pipeline was actually executed against the real
`logo/LE logo.svg`, not simulated.

### Identity surfaces — the `browser/moz.configure` hunk

Everything D-78/D-80/D-84 need, in the one file this phase patches
(`[VERIFIED: upstream/browser/moz.configure, read in full this session]`):

```diff
--- a/browser/moz.configure
+++ b/browser/moz.configure
@@
 imply_option("MOZ_DEDICATED_PROFILES", True)
 imply_option("MOZ_BLOCK_PROFILE_DOWNGRADE", True)
-imply_option("MOZ_NORMANDY", True)
+imply_option("MOZ_NORMANDY", False)
 imply_option("MOZ_PROFILE_MIGRATOR", True)


-imply_option("MOZ_APP_VENDOR", "Mozilla")
+imply_option("MOZ_APP_VENDOR", "Sourcerer")
+imply_option("MOZ_APP_UA_NAME", "Firefox")
 imply_option("MOZ_APP_ID", "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}")
```

Line numbers as read this session: `MOZ_NORMANDY` at line 10,
`MOZ_APP_VENDOR`/`MOZ_APP_ID` at lines 14-15. `MOZ_SERVICES_HEALTHREPORT`
(D-84's other build-time flag) is at line 6, already `True` — D-84 says this
hunk also carries it; whether it becomes `False` or is left alone is a
BRAND-04 allowlist judgment call the plan should make explicit (health
report telemetry is a separate subsystem from Normandy/Shield studies, and
CONTEXT.md doesn't specify a target value for it — flagged as Open Question).

### The `.desktop` file

Built from a real Mozilla-authored reference actually found in-tree
(`taskcluster/docker/ubuntu2404-test/firefox.desktop`,
`[VERIFIED: Read, this session]`, quoted verbatim above in Architecture
Patterns) plus the freedesktop.org Desktop Entry Specification's
`StartupWMClass` key (`[CITED: freedesktop.org Desktop Entry Specification —
not re-fetched this session, this is a stable, well-known standard key]`):

```ini
[Desktop Entry]
Name=Sourcerer
Exec=/path/to/objdir/dist/bin/sourcerer %u
Terminal=false
Type=Application
Categories=Development;IDE;
StartupWMClass=sourcerer
Icon=sourcerer
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
```

`StartupWMClass` **must** equal whatever `MOZ_APP_REMOTINGNAME` resolves to
at runtime. Per `toolkit/moz.configure:3337-3354`
(`[VERIFIED: Read, this session]`, quoted):

```python
option(
    env="MOZ_APP_REMOTINGNAME",
    nargs=1,
    help="Used for the internal program name, which affects profile name "
    "and remoting. If not set, defaults to MOZ_APP_NAME if the update channel "
    "is release, and MOZ_APP_NAME-MOZ_UPDATE_CHANNEL otherwise",
)

@depends("MOZ_APP_REMOTINGNAME", moz_app_name, update_channel)
def moz_app_remotingname(value, moz_app_name, update_channel):
    if value:
        return value[0]
    if update_channel == "release":
        return moz_app_name
    return moz_app_name + "-" + update_channel
```

So an unset `MOZ_APP_REMOTINGNAME` on a non-release channel produces
`sourcerer-<channel>`, not bare `sourcerer` — confirm which update channel
the dev build configures (not checked this session; `.mozconfig` doesn't
currently set `--enable-update-channel`, meaning it takes whatever default
`moz.configure` assigns, which is a separate lookup this research did not
chase down) before hardcoding `StartupWMClass=sourcerer` — it's simpler and
more robust to `export MOZ_APP_REMOTINGNAME=sourcerer` explicitly (already
CONTEXT.md's own zero-patch recommendation) and use that literal value in
the `.desktop` file, sidestepping the channel-dependent default entirely.

`.desktop` install path: `~/.local/share/applications/sourcerer.desktop`
for local dev testing (user-scope, freedesktop XDG standard location,
`[CITED: freedesktop.org XDG Base Directory / desktop-file spec, not
re-verified this session]`) — document this path in `docs/BUILD.md` per
D-79's discretion leaning.

### The D-88 verification layers, each with its positive control

**Layer 1 — static grep** (fast, run on every build):

```bash
# Positive control: temporarily restore the real URL and confirm this goes red.
grep -E 'aus5\.mozilla\.org|normandy\.cdn\.mozilla\.net' \
  objdir/dist/bin/greprefs.js browser/defaults/preferences/*.js && echo "FAIL: allowlist violated"
```

**Layer 2 — filesystem, exact-path `strace`:**

```bash
strace -f -e trace=openat,open,stat,access -o /tmp/sourcerer-strace.log \
  objdir/dist/bin/sourcerer --headless --screenshot /tmp/out.png about:blank
# Exact-path match ONLY -- a bare `.mozilla` substring match false-fails,
# because nsXREDirProvider.cpp hardcodes literal ".mozilla" as a path
# COMPONENT (AppendNative(".mozilla"_ns), toolkit/xre/nsXREDirProvider.cpp:427,1295)
# on every build, Sourcerer included -- that's the parent of the extensions/
# compat-mode directory, not the profile root, and it is expected to appear.
grep -E "\"$HOME/\.mozilla/firefox" /tmp/sourcerer-strace.log && echo "FAIL: touched real Firefox's profile tree"
```

**Layer 3 — network, `MOZ_LOG`:**

```bash
MOZ_LOG=nsHostResolver:5 MOZ_LOG_FILE=/tmp/sourcerer-hostresolver.log \
  objdir/dist/bin/sourcerer --headless about:blank &
sleep 20  # covers the idle-task window C-4 identifies
kill %1
grep -E "mozilla\.org|mozilla\.net|mozilla\.com" /tmp/sourcerer-hostresolver.log \
  | grep -v "firefox.settings.services.mozilla.com" && echo "FAIL: unlisted Mozilla host resolved"
```

Positive control for all three: manually restore `media.gmp-manager.url`
(or any one blanked pref) to its stock `aus5.mozilla.org` value and confirm
each layer's grep actually matches — this is D-88's requirement, and per
Phase 2's own lesson (`02-LEARNINGS.md`), a negative check without a
demonstrated-red positive control is not trustworthy.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `-brand-product-name = Firefox` (in `brand.ftl`) should stay `Firefox` rather than become `Sourcerer` | Architecture Patterns §branding directory | Low functional risk (affects only a handful of "requires Firefox"-style compatibility strings), but a genuine open judgment call, not verified against how many/which strings actually consume this specific term |
| A2 | `MOZ_SERVICES_HEALTHREPORT` should be set to `False` alongside `MOZ_NORMANDY` in the same hunk | Code Examples §the moz.configure hunk | If left `True`, a compiled-in health-report code path may still exist even though its pref-level defaults are inert; low risk since D-84 already gates runtime behavior via prefs regardless, but the compiled-define question itself is unresolved by this research |
| A3 | The dev build's update channel is whatever `moz.configure` defaults to (unconfirmed) rather than something `.mozconfig` should explicitly set via `--enable-update-channel` | Code Examples §.desktop file | If the channel defaults to something other than `release`, `MOZ_APP_REMOTINGNAME`'s auto-derived fallback (`moz_app_name + "-" + update_channel`) changes the profile/remoting name string, which the `.desktop` file's `StartupWMClass` must match — mitigated by explicitly exporting `MOZ_APP_REMOTINGNAME=sourcerer` rather than relying on the default, per CONTEXT.md's own zero-patch leaning |
| A4 | `strace` is available on the reference NixOS dev host | Standard Stack, Validation Architecture | If absent, D-88 layer 2 needs `nix develop` to pull in `pkgs.strace` explicitly — not checked this session (out of the phase's tool-verification scope, but load-bearing for the verification harness) |
| A5 | `.desktop` file naming/numeric-prefix convention for `patches/` follows Zen/LibreWolf's own scheme exactly (zero-padded numeric prefix) | Architecture Patterns §patch stack | Purely cosmetic if wrong — any consistent, sortable naming works equally well for `apply-patches.sh`'s glob-based ordering |

**If this table is empty:** not applicable — five items above need
confirmation before being locked into a plan.

## Open Questions

1. **Does `MOZ_SERVICES_HEALTHREPORT` get flipped to `False`, or left `True`?**
   - What we know: it's `imply_option("MOZ_SERVICES_HEALTHREPORT", True)` at
     line 6 today, in the same file/hunk D-84 already touches for
     `MOZ_NORMANDY`.
   - What's unclear: D-84's text names it alongside `MOZ_NORMANDY` as a
     build-time flag to flip, but doesn't state the target value explicitly
     the way it does for `MOZ_NORMANDY`.
   - Recommendation: flip to `False` for consistency with "code that is not
     compiled cannot be re-enabled at runtime" (D-84's own stated rationale),
     unless the plan finds a reason health-report specifically needs to stay
     compiled in.

2. **Does a full `./mach build` leave a stale `objdir/dist/bin/firefox`
   binary behind once `MOZ_APP_NAME` changes it to `sourcerer`?**
   - What we know: `mach build` is incremental by default; this session's
     instructions explicitly forbade running a real full build (54-minute
     cost) to check.
   - What's unclear: whether Firefox's build system's incremental mode
     removes build products whose install path changed, or whether a
     `mach clobber`/manual `rm -rf objdir` is needed after the branding
     patch lands, to avoid a stale `dist/bin/firefox` silently passing a
     "does firefox still exist" check that should now be negative.
   - Recommendation: the plan's first branded-build task should check for
     `objdir/dist/bin/firefox`'s continued existence immediately after the
     first successful branded build and decide then whether a clobber step
     is needed — cheap to check, expensive to assume either way without
     checking.

3. **Which update channel does this dev build actually configure?**
   - What we know: `.mozconfig` sets no `--enable-update-channel`; the
     default channel selection logic lives elsewhere in
     `toolkit/moz.configure` and was not chased down this session (out of
     this research's declared 8-question scope).
   - What's unclear: whether it defaults to `release`, `nightly`, or
     something else, which matters only if the plan relies on
     `MOZ_APP_REMOTINGNAME`'s auto-derived fallback instead of explicitly
     setting it (mitigated already, see A3).
   - Recommendation: not blocking, given the explicit-export mitigation; a
     planner who wants certainty can check with
     `./mach configure 2>&1 | grep -i channel` in the `firefox` devShell.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pkgs.sccache` (Nix) | D-71 | ✓ | 0.17.0 on `nixos-unstable` | — |
| `inkscape` | Icon generation (D-82/BRAND-02) | ✓ | 1.4.4 (already on host, not a flake input) | `rsvg-convert`/ImageMagick if ever needed, neither currently installed |
| `gimp` | (not needed — inkscape covers the whole pipeline) | ✓ (incidentally present) | not checked | n/a |
| `strace` | D-88 layer 2 | **not checked this session** | — | add `pkgs.strace` to the `firefox` devShell if absent — flagged as Open Question / A4 |
| `git` | Patch stack (BUILD-03) | ✓ | host-provided, already load-bearing for Phase 1 | — |

**Missing dependencies with no fallback:** none confirmed missing; `strace`
is unverified, not confirmed absent.

**Missing dependencies with fallback:** none needed at this time.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None conventional (no pytest/jest) — bash + Node scripts driving real processes, matching Phase 1/2's established pattern (`scripts/verify-*.mjs`, `scripts/smoke-*.sh`, `scripts/lib/firefox-bidi.mjs`) |
| Config file | none — see Wave 0 Gaps |
| Quick run command | `bash scripts/check-patch-surface.sh` (D-73's positive control, seconds); `node scripts/verify-branding-identity.mjs` (once written, BiDi-driven, needs a built binary but no build itself) |
| Full suite command | `bash scripts/verify-phase-03.sh` (aggregator, follows `verify-phase-02.sh`'s pattern — to be created) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-03 | Patch replays cleanly; a dropped/already-adopted patch fails loudly | integration (scratch git clone) | `bash scripts/apply-patches.sh` against a deliberately pre-adopted scratch upstream | ❌ Wave 0 — script doesn't exist yet |
| BUILD-04 | Guard rejects a compiled-file patch; tiered timings hold | unit (guard) + manual (timing) | `bash scripts/check-patch-surface.sh` (guard, seconds); tiered-loop timing is manual-only per D-73, same class as Phase 1's `smoke-firefox.sh` "WARNING: runs a full Gecko compile" pattern | ❌ Wave 0 — `check-patch-surface.sh` doesn't exist yet |
| BRAND-01 | Six-surface checklist all report Sourcerer | smoke (needs built binary) | extend `scripts/lib/firefox-bidi.mjs` (parameterize `FIREFOX_BIN`, see below) + a new `verify-branding-identity.mjs` | ❌ Wave 0 — needs the parameterization fix plus a new script |
| BRAND-02 | No Mozilla trademark asset in shipped `branding/` tree | static (fast) | `find sourcerer/branding -iname "*.icns" -o -iname "Assets.car"` — should return nothing; the recommendation itself is "don't copy them," so this is a regression guard, not a build-driven check | ❌ Wave 0 |
| BRAND-03 | Profile never touches `~/.mozilla/firefox` | smoke (exact-path strace) | Layer 2 script, Code Examples above | ❌ Wave 0 |
| BRAND-04 | Endpoint allowlist holds; each layer has a positive control | smoke (3 layers) | Layers 1-3, Code Examples above | ❌ Wave 0 |
| BRAND-06 | Dev vs release builds visibly differ | smoke (two builds) | compare `about:support`/window-title output between `--with-branding=sourcerer/branding/dev` and `.../release` builds | ❌ Wave 0 (needs both branding directories to exist first) |

### Sampling Rate

- **Per task commit:** `bash scripts/check-patch-surface.sh` (guard only — the
  one check genuinely cheap enough to run on every patch-touching commit)
- **Per wave merge:** the full BRAND-01/03/04 smoke layers, against the
  latest incremental build (not a full rebuild each time — D-70's tiered
  loop already covers that)
- **Phase gate:** full `bash scripts/verify-phase-03.sh` green, plus D-73's
  two acceptance checks (guard positive control + re-measured timings in
  `docs/BUILD.md`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/check-patch-surface.sh` — does not exist; D-72/D-73's core deliverable
- [ ] `scripts/apply-patches.sh` — does not exist; sketch provided in Architecture Patterns
- [ ] `patches/`, `sourcerer/branding/{dev,release}` directories — do not exist yet
- [ ] `scripts/lib/firefox-bidi.mjs` — `FIREFOX_BIN` (line 32) is a hardcoded
      module-level `const`, used by both `captureScreenshot(url, outputPath,
      {...})` and `withFirefoxPage(url, callback)`. Parameterize by adding
      `binPath = FIREFOX_BIN` to each function's options object and using the
      local `binPath` instead of the module constant inside the body — keeps
      `export const FIREFOX_BIN` as the default so existing Phase 2 callers
      (which pass no override) are unaffected
- [ ] `.desktop` file and its install script/step — do not exist
- [ ] `scripts/verify-phase-03.sh` aggregator — does not exist; follows
      `scripts/verify-phase-02.sh`'s pattern

## Sources

### Primary (HIGH confidence — read/executed directly this session)

- `upstream/browser/moz.configure` — full file read
- `upstream/browser/branding/branding-common.mozbuild` — full file read
- `upstream/browser/branding/unofficial/*` — directory listing + every
  identity-bearing file read in full (`brand.ftl`, `brand.properties`,
  `configure.sh`, `pref/firefox-branding.js`, `moz.build`, `content/jar.mn`,
  `locales/jar.mn`)
- `upstream/python/mozbuild/mozbuild/frontend/reader.py` —
  `is_read_allowed`, `exec_file` sandbox override, both read directly
- `upstream/python/mozbuild/mozbuild/artifacts.py` — `GeckoJobConfiguration`,
  `LinuxArtifactJob` (cross-checking C-1, already locked, not re-litigated)
- `upstream/build/moz.configure/util.configure` — `project_flag` template
- `upstream/build/moz.configure/init.configure` — `--with-app-basename`
- `upstream/toolkit/moz.configure` — `--with-distribution-id`,
  `--with-branding`, `MOZ_APP_REMOTINGNAME`, `--enable-crashreporter`
- `upstream/build/application.ini.in` — full file read
- `upstream/toolkit/xre/nsAppRunner.cpp` — `DumpVersion`, `MOZ_APP_REMOTINGNAME`
  env handling, `g_set_prgname`/`gRemoteService->SetProgram` call sites
- `upstream/widget/gtk/nsWindow.cpp`, `nsAppShell.cpp` — WM_CLASS/program-class wiring
- `upstream/toolkit/xre/nsXREDirProvider.cpp` — `.mozilla` hardcoded paths,
  `MOZ_APP_PROFILE` branch
- `upstream/modules/libpref/init/all.js`, `upstream/browser/app/profile/firefox.js` —
  every pref cited in Common Pitfalls and the D-84/85/86/87 inventory
- `upstream/toolkit/content/gmp-sources/widevinecdm.json`,
  `openh264.json` — real GMP source manifests, confirming exact hosts
- `upstream/services/settings/Utils.sys.mjs`,
  `RemoteSettingsComponents.sys.mjs` — Remote Settings override refusal and
  poll-interval comment
- `upstream/browser/components/enterprisepolicies/schemas/policies-schema.json` —
  full policy-name enumeration grepped
- `upstream/netwerk/dns/nsHostResolver.cpp` — `LazyLogModule` name confirmed
- `upstream/build/moz.configure/toolchain.configure` — ccache/sccache/RUSTC_WRAPPER wiring
- `upstream/taskcluster/docker/ubuntu2404-test/firefox.desktop` — real
  Mozilla-authored `.desktop` reference
- `nix eval nixpkgs#sccache.version` — 0.17.0, live `nixos-unstable`
- `git apply --3way` / `git am --3way` (and non-`--3way` variants) on
  already-adopted content — full four-way experiment run in
  `/tmp/.../scratchpad/patchexp2`
- `is_read_allowed`/`basedir`/`normpath` symlink-outside-topsrcdir scenario —
  reproduced in `/tmp/.../scratchpad/symlinktest`
- `.git/info/exclude` hiding a symlinked overlay from `git status --porcelain` —
  reproduced in `/tmp/.../scratchpad/gitexcludetest`
- Icon recolor+export pipeline — actually executed against the real
  `logo/LE logo.svg`, five PNGs produced and dimension-verified
- `inkscape --help` — exact 1.4.4 CLI flag names
- `which rsvg-convert`/`convert`/`magick`/`resvg` — confirmed absent;
  `inkscape`/`gimp` confirmed present at `/run/current-system/sw/bin/`

### Secondary (MEDIUM confidence)

- `.desktop` install path (`~/.local/share/applications/`) and
  `StartupWMClass` key semantics — freedesktop.org Desktop Entry
  Specification, not re-fetched this session (stable, well-known standard)
- Patch-file numeric-naming convention — CONTEXT.md's own citation of
  Zen `surfer`/LibreWolf precedent, not independently re-fetched

### Tertiary (LOW confidence / not verified this session)

- Whether `strace` is present on the reference host (A4)
- Whether `./mach build`'s incremental mode deletes a renamed stale binary
  (Open Question 2)
- The dev build's actual default update channel (Open Question 3)

## Metadata

**Confidence breakdown:**
- Patch stack mechanics (D-75 experiment): HIGH — empirically run, exit codes and working-tree state directly observed
- Overlay symlink mechanism (C-2/D-84): HIGH — both the source-level reasoning and a live filesystem reproduction agree
- Branding directory file classification: HIGH — every file read directly, categorization follows directly from `branding-common.mozbuild`'s own conditional logic
- Icon generation pipeline: HIGH — actually executed, not just described
- Pref/policy inventory: HIGH for names and exact values (all read from source); MEDIUM for which specific policies the plan should choose to lock (a judgment call, not a fact)
- `.desktop` file content: MEDIUM — built from a real in-tree reference plus a standard external spec not re-fetched this session
- Two corrected claims (Remote Settings cadence, `--version` duplication): HIGH — both are direct reads of the exact code paths in question, cross-checked against independently-recorded real output where available

**Research date:** 2026-08-21
**Valid until:** tied to `FIREFOX_153_1_0esr_RELEASE` remaining the pinned
tag — any ESR rebase should re-verify line numbers cited here, though the
mechanisms themselves (is_read_allowed's non-realpath design, DumpVersion's
concatenation, the project_flag origin restriction) are structural and
unlikely to change within an ESR line. Treat as valid through this phase's
execution; re-check before the first post-v4.0 ESR rebase.

---
*upstream/ verified clean at research end: `git -C upstream status --porcelain` empty, HEAD `468445e58d` unchanged.*
