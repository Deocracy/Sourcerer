# Phase 3: Branded Firefox Fork - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the stock `FIREFOX_153_1_0esr_RELEASE` checkout at `upstream/` into a
Sourcerer-identity browser: own name, icons, profile directory and distribution
id; no Mozilla trademark assets; no Mozilla update or telemetry endpoint
contacted; a patch stack that replays onto a new ESR tag and fails loudly rather
than silently dropping a patch; and a rebuild loop fast enough to develop in.

Covers **BUILD-03, BUILD-04, BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-06**.

This phase ships **no** `sourcerer.xhtml`, **no** `SourcererAPI.sys.mjs`, **no**
`TheiaService.sys.mjs`, and **no** Theia-side work. Those are Phases 4 and 2.
The built artifact at the end of this phase is a Sourcerer-branded browser that
still shows stock Firefox chrome — architecture-sketch build-order milestone 1
("Firefox ESR builds under our branding, stock UI").

**Two requirements are amended by this discussion** (see `<decisions>` D-70 and
D-83). `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` must be updated
before or during planning:

1. **BUILD-04** — the artifact-build mechanism it names is provably incompatible
   with BRAND-01. Rewritten to the tiered incremental loop.
2. **BRAND-01 / ROADMAP success criterion 1** — "a search for a residual
   'firefox' identity string comes back empty" is unachievable on any correct
   build. Rewritten as a runnable named-surface checklist.

</domain>

<decisions>
## Implementation Decisions

Numbering continues from Phase 2 (which ended at D-69).

### Research corrections — read these first

Six premises that would otherwise drive this phase were checked empirically
against the local `upstream/` tree and refuted. Planning must not reintroduce
them.

- **C-1:** Artifact builds **do** work for ESR 153 — the Taskcluster namespace
  `gecko.v2.mozilla-esr153.shippable.revision.468445e58d3acc7e4e059be99856daff1f2ae8f1.firefox.linux64-opt`
  returns HTTP 200 with an 86,178,792-byte `public/build/target.tar.xz`. They are
  nonetheless **useless here**: `GeckoJobConfiguration.product` is hardcoded
  `"firefox"` (`upstream/python/mozbuild/mozbuild/artifacts.py:92`),
  `LinuxArtifactJob` installs `firefox/firefox` → `dist/bin/firefox` (`:632`,
  `:663`), and `MOZ_APP_NAME` / `MOZ_APP_VENDOR` are compiled **defines** baked
  into the downloaded `libxul.so`. With `MOZ_APP_NAME=sourcerer`, `./mach run`
  raises `BinaryNotFoundException` (`mozbuild/base.py:584-590`) and
  `mach package` fails on `@BINPATH@/@MOZ_APP_NAME@`
  (`browser/installer/package-manifest.in:169,171`). Mozilla needed a bespoke
  `ThunderbirdJobConfiguration` class to support one renamed product. Drives D-70.
- **C-2:** The branding directory **cannot** live at repo root. `topsrcdir` is
  `/home/chris/coding/sourcerer/upstream` (`objdir/config.status:857`), so
  `--with-branding=sourcerer/branding` resolves to `upstream/sourcerer/branding`.
  A repo-root path is rejected by `is_read_allowed`
  (`upstream/python/mozbuild/mozbuild/frontend/reader.py:1279-1284`). The tree
  must be **inside** `upstream/`, as a real directory or a symlink. Drives D-84.
- **C-3:** Waterfox is precedent **against** the dual-token User-Agent, not for
  it. Their current ESR153 tree sets `imply_option("MOZ_APP_UA_NAME", "Firefox")`
  (BrowserWorks/Waterfox `waterfox/moz.configure:7`) — UA byte-identical to
  Firefox — after their issue #345 flagged the custom token as a fingerprinting
  liability. Drives D-78.
- **C-4:** **Widevine is not a BRAND-04 tension.** `media.eme.enabled` defaults
  **false** on `XP_LINUX`
  (`upstream/modules/libpref/init/StaticPrefList.yaml:12162-12175`), so
  `GMPUtils.isPluginHidden` filters Widevine out of the idle task
  (`GMPInstallManager.sys.mjs:606-609`). The actual unattended startup traffic
  at the 20s idle mark is (a) an AUS ping to `aus5.mozilla.org/update/3/GMP/…`
  and (b) an **OpenH264 download** (`gmp-gmpopenh264`, visible and enabled
  unconditionally, `firefox.js:2393-2394`). Drives D-86, D-87.
- **C-5:** `--disable-updater` leaves **21 update-named files** in `dist/bin`.
  None carry user-visible brand strings, so this is not a branding hazard — but
  a verification check written as "no update files remain" would **false-fail a
  correct build**. Drives D-79.
- **C-6:** `upstream/.git` is **1.1 GB** (shallow, exactly two refs:
  `FIREFOX_153_1_0esr_RELEASE` and `_BUILD1`). The 5.6 GB figure in
  `01-03-SUMMARY.md` is the **working-tree** size. A second `--depth 1` tag fetch
  therefore costs roughly +1.1 GB of pack, not a doubling of 5.6 GB.

**Process note for the planner:** during this phase's research,
`upstream/browser/moz.configure` was edited in place to run empirical configure
tests, violating CLAUDE.md's never-modify-Gecko rule, and one build-timing
measurement was contaminated as a result. The tree was restored and verified
pristine (HEAD `468445e58d` == the tag, clean `git status`,
`fetch-upstream.sh` gate green). **No timing number from that research round is
trustworthy** — D-73 exists to force real measurement.

### Fast rebuild loop (BUILD-04)

- **D-70:** **BUILD-04 is rewritten.** The artifact-build mechanism it names is
  replaced by the tiered incremental loop, which already works on this host:
  - `./mach run` for the 7450 of 7784 files in `dist/bin` that are **symlinks
    into `upstream/`** (every `.js`, `.ftl`, branding PNG) — **zero build**.
    `./mach run` is registered `category="post-build"` and never builds. There
    is no `omni.ja` in `dist/bin`; the source-symlink dev workflow is the
    default, not something to enable.
  - `./mach build faster` for preprocessed files (`browser.xhtml`, `firefox.js`)
    — **2.55s warm**.
  - Full `./mach build` only after a compiled-define change (i.e. after touching
    the `browser/moz.configure` patch).

  Accepted and documented cost: **a clean clone has no minutes-to-runnable path**
  — first build is ~54 minutes. ROADMAP success criterion 3 is rewritten to
  match. LibreWolf and Zen both do full builds with `--with-app-name`; neither
  enables artifact builds. — **Reversibility:** costly — this is a requirements
  edit; reverting means re-litigating BUILD-04 against BRAND-01, which C-1 shows
  cannot both hold.

- **D-71:** **sccache lands in the `firefox` devShell in this phase.**
  `pkgs.sccache`, with `--with-ccache=sccache` and `RUSTC_WRAPPER=sccache` —
  Zen's mozconfig wires it exactly this way. Rationale: Phase 3 is the phase that
  repeatedly changes `browser/moz.configure`, those values are compiled defines,
  each change invalidates `config.status` and cascades into a broad C++
  recompile. This is where sccache pays for itself or never does.
  **Known risk requiring one smoke test:** Nix's bash clang-wrapper — Phase 1
  already had to override `stdenv` to `pkgs.llvmPackages.stdenv` and unset the
  bintools-wrapper tool variables to make `mach` work at all (see
  `01-CONTEXT.md` and `flake.nix` comments); sccache sits in that same path.
  — **Reversibility:** reversible — removing it is a `flake.nix` and mozconfig edit.

- **D-72:** The artifact/patch-surface boundary is an **executable guard**, not
  prose: `scripts/check-patch-surface.sh` fails on any patch touching
  `.c .cc .cxx .cpp .h .hh .hpp .inc .m .mm .rs .s .S .asm .webidl .idl .ipdl
  .ipdlh Cargo.*` (suffix set from `upstream/python/mozbuild/mozbuild/frontend/emitter.py:1126-1133`;
  `.idl` belongs because xpidl generation is gated on `COMPILE_ENVIRONMENT`).
  A section in the **existing `docs/BUILD.md`** points at the script as the
  single source of truth.
  **Explicitly not created:** `sourcerer/ARTIFACT-BOUNDARY.md` (the name is wrong
  the moment artifact builds are dropped) and **do not** pull
  `sourcerer/INTERNAL-APIS.md` forward from Phase 4 — its purpose is cataloguing
  `SourcererAPI.sys.mjs` touchpoints, none of which exist until Phase 4.

- **D-73:** Rewritten success criterion 3 has **two** acceptance checks:
  1. `check-patch-surface.sh` exits **non-zero** on a deliberately-planted
     compiled-file patch — a working positive control, not just a green run.
  2. The tiered-loop timings are **re-measured on this host at phase end** and
     written into `docs/BUILD.md` with the date and the exact command.
  Rationale: Phase 2 recorded a `docs/BUILD.md` "measured" figure that was never
  measured and was carried forward a whole phase (02-LEARNINGS.md, Surprises).
  D-70's 2.55s and ~54min numbers are inherited from research and **must be
  re-measured**, not copied.

### Fork layout and rebase procedure (BUILD-03)

- **D-74:** **`upstream/` stays fully disposable.** `patches/` is the single
  source of truth. A new ESR tag means: re-run `scripts/fetch-upstream.sh` with
  the new `TAG`, then `scripts/apply-patches.sh` replays `patches/*.patch`. No
  commits ever live inside `upstream/`. This preserves Phase 1's D-01 and D-04
  unchanged. Precedent: LibreWolf (`patch -p1 -i` driven by
  `scripts/librewolf-patches.py`, exits 1 on failure, plus a dedicated
  `check-patchfail.sh`) and `zen-browser/surfer`'s `git-patch.ts`.
  **Explicitly rejected:** a parallel `--enable-application=sourcerer` project
  tree. It converts a 2-line conflicting patch into a ~55-line silently-drifting
  copy with no conflict detection, and `MOZ_BUILD_APP` changes behaviour in at
  least four places (devtools `DIST_SUBDIR`, `MOZ_BUILD_APP_IS_BROWSER`,
  `faster/rules.mk`, system-headers). That is PITFALLS #8 by construction.
  — **Reversibility:** reversible — a stateful rebase branch can be reconstructed
  from `patches/` at any later point if the first real rebase proves it necessary.

- **D-75:** **Adopted-patch detection is a post-apply assertion per patch.**
  After replaying the stack, assert that every patch in `patches/` actually
  changed something; a patch that applies as a no-op, or that git reports as
  already-applied, **fails the run by name**.
  This exists because the mechanism BUILD-03 criterion 2 is written against is
  genuinely dangerous: default `git rebase --onto` and `git am --3way` both
  **exit 0 while silently deleting a patch upstream has adopted**. Only
  `git rebase --reapply-cherry-picks --empty=stop` exits non-zero, and that
  requires the stateful model D-74 rejects.
  **One cheap experiment the planner must run and record:** does
  `git apply --3way` on already-adopted content exit 0 or 1? Nobody has measured
  it. If it exits 1, the assertion is belt-and-braces; if 0, the assertion is the
  only thing standing between us and a silent patch drop.

- **D-76:** `scripts/fetch-upstream.sh`'s clean-tree gate **gates on unexpected
  changes only**. Phase 3 necessarily makes `upstream/` dirty (patch stack +
  branding overlay), so the current unconditional hard-fail must evolve: dirt
  accounted for by the patch stack and the branding overlay passes; anything else
  still hard-fails. This preserves the gate's original intent (CLAUDE.md's
  never-modify-Gecko rule; BUILD-03 assuming a known upstream state) and depends
  on D-75's post-apply state being computable.

- **D-77:** **CI: script now, workflow now, no schedule.**
  `scripts/rebase-upstream.sh` plus a `.github/workflows` entry that is
  **`workflow_dispatch`-only**, not cron. Shape cribbed from
  `zen-browser/desktop`'s `sync-upstream.yml`. The repo does have a remote
  (`origin` → `https://github.com/Deocracy/Sourcerer.git`), so this is real, not
  a stub — it proves the procedure runs off this machine, satisfying BUILD-03's
  "CI-ready" honestly, without a scheduled job going red on a repo that has no
  ESR point release to react to yet.
  PITFALLS #8's ~4-weekly cadence is a **standing operational item for after
  v4.0**, not a Phase 3 deliverable — a red scheduled job with nobody watching is
  the failure mode PITFALLS #8 itself warns about.

### Identity surfaces (BRAND-01, BRAND-02, BRAND-03, BRAND-06)

**The mechanism split, verified by real configure runs.**

Free — settable with **zero patch**: `--with-app-basename=Sourcerer`,
`--with-app-name=sourcerer`, `--with-distribution-id=<id>`,
`--with-branding=<dir inside upstream/>`, `export MOZ_APP_REMOTINGNAME=sourcerer`.
`MOZ_APP_DISPLAYNAME` and the `-brand-*-name` strings come from our own branding
directory's `configure.sh` and `brand.ftl`. **`MOZ_APP_NAME` derives from
basename automatically — do not pass both.**

Costs a patch — `MOZ_APP_VENDOR`, `MOZ_APP_ID`, `MOZ_APP_UA_NAME`,
`MOZ_APP_PROFILE` are all `project_flag`s with `possible_origins=("implied",)`
(`upstream/build/moz.configure/util.configure:529`), rejected from environment,
command line, mozconfig, **and** branding confvars alike.

- **D-78:** **The User-Agent is byte-identical to stock Firefox.** Add
  `imply_option("MOZ_APP_UA_NAME", "Firefox")` to the `browser/moz.configure`
  hunk.
  This is not cosmetic. `MOZ_APP_BASENAME=Sourcerer` is **required** for
  about:support's Name field, and it produces
  `Mozilla/5.0 (X11; Linux x86_64; rv:153.0) Gecko/20100101 Sourcerer/153.1.0` —
  the `Firefox/153.0` token gone. AMO's frontend gates the install button on
  `userAgentInfo.browser.name === 'Firefox'` (addons-frontend
  `src/amo/utils/compatibility.js:71-78`), so **extension installation dies** —
  directly attacking the "we inherit WebExtensions from Firefox" rationale for
  choosing Firefox over Electron.
  **Rejected:** the dual-token route (`general.useragent.compatMode.firefox`),
  which is zero-patch but which Waterfox abandoned as a fingerprinting liability
  (C-3) — a `Sourcerer/` token seen by near-zero other Linux users is close to a
  unique identifier. Unanimous LibreWolf / Zen / current-Waterfox precedent is
  byte-identical.
  Accepted cost: **no Sourcerer identity in the UA at all.**
  — **Reversibility:** reversible — one line in a hunk we already own.

- **D-79:** **BRAND-01 / criterion 1 is rewritten as a runnable named-surface
  checklist**, each item verified by a command:
  1. executable name in `dist/bin`
  2. `application.ini` `Name` and `Vendor` fields
  3. about:support identity fields
  4. window title
  5. the `.desktop` file's `Name` and `StartupWMClass`
  6. `--version` output

  The open `grep -ri firefox` it replaces is **unachievable**: a correctly
  branded, unpackaged build still ships **39 files with `firefox` in the
  filename and 32 more containing the string**, all upstream feature names — plus
  the 21 update-named files from C-5. A criterion that can only ever fail is not
  a criterion.

- **D-80:** **`MOZ_APP_VENDOR` is patched to `"Deocracy"`** —
  `upstream/browser/moz.configure:14`. Yields the profile at
  `~/.config/deocracy/sourcerer`, `application.ini` `Vendor=Deocracy`, and
  `--version` printing `Deocracy Sourcerer 153.1.0`.
  **Amended 2026-08-21 after research.** D-80 originally set vendor to
  `"Sourcerer"`. `DumpVersion()` prints vendor then name unconditionally
  (`toolkit/xre/nsAppRunner.cpp:2247-2249`), so vendor and basename both being
  `Sourcerer` yields the doubled `Sourcerer Sourcerer 153.1.0`. Vendor is the
  organisation and basename is the product — the split Mozilla itself uses
  (`Vendor=Mozilla`, `Name=Firefox`) — and `Deocracy` matches the repo remote
  (`github.com/Deocracy/Sourcerer`) and the `org.deocracy` distribution id.
  Same one patched line, no extra cost.
  **Criterion 1's `--version` checklist item must expect `Deocracy Sourcerer
  153.1.0`,** and its profile-path check `~/.config/deocracy/sourcerer`.
  Without any vendor patch: profile at `~/.config/mozilla/sourcerer`,
  `Vendor=Mozilla`, `--version` printing `Mozilla Sourcerer 153.1.0` —
  BRAND-03's literal wording is satisfied either way, but BRAND-01's
  about:support identity fields are not. No surveyed fork ships with vendor
  still Mozilla.
  Same file, same hunk as D-78 and D-86, so the **marginal rebase cost is zero
  extra files**. LibreWolf (`patches/moz-configure.patch`) and Zen
  (`src/toolkit/moz-configure.patch`) both patch the equivalent — in the
  4400-line `toolkit/moz.configure`; the 54-line `browser/moz.configure` is a
  cheaper target.

- **D-81:** **Two things are deliberately NOT done**, and planning must not
  quietly add them:
  - **`MOZ_APP_PROFILE` is never set.** It bypasses XDG placement and puts a
    visible `$HOME/sourcerer` directory on disk
    (`upstream/toolkit/xre/nsXREDirProvider.cpp:1495-1536`).
  - **`MOZ_APP_ID` is never changed.** It is what makes AMO and WebExtensions
    treat the build as Firefox. Changing it is a paper win and an ecosystem loss.
  Also rejected: **LibreWolf-style deep de-Mozilla-ing** (`nsXREDirProvider.cpp`,
  `nsDBusRemoteServer.cpp`, `nsAppRunner.cpp`) — six files, two among the hottest
  in the tree, buying the `org.mozilla` DBus prefix and `/usr/lib/mozilla`,
  neither of which any success criterion names. LibreWolf sustains 47 patches
  with dedicated repair tooling; Sourcerer is one developer.

- **D-82:** **BRAND-06 ships two branding directories** —
  `sourcerer/branding/dev` and `sourcerer/branding/release`, selected by
  `--with-branding`. This is Firefox's own nightly/official pattern, so it is the
  mechanism the build system is designed around, and it gives a distinct display
  name **and** a distinct icon badge in one move.
  Two accepted costs, both deliberate: the Linux icon set is generated **twice**,
  and because the dev display name differs, **dev and release builds do not share
  a profile**.

### Endpoint and telemetry removal (BRAND-04)

- **D-83:** **Remote Settings stays; `firefox.settings.services.mozilla.com` is a
  named, documented carve-out** in BRAND-04's allowlist, with its 24-hour polling
  cadence recorded (`services.settings.poll_interval` = 86400,
  `modules/libpref/init/all.js:1745` — the 6-hour figure sometimes quoted is
  `app.normandy.run_interval_seconds`, which D-84 disables anyway). There is no third option: `services/settings/Utils.sys.mjs:52-84`
  **refuses any `services.settings.server` override off Nightly**, so the only
  alternative is the `DisableRemoteSettingsAndAcceptSecurityConsequences` policy —
  which also stops CRLite certificate-revocation data, intermediate-certificate
  preloading, and tracking-protection list updates, on a substrate whose entire
  pitch is that it is a real browser.
  Criterion 4 therefore reads "zero Mozilla endpoints **except this one, for
  these reasons**" — stated plainly in the phase docs, never quietly.
  Self-hosting a Remote Settings mirror was rejected: it needs a patch anyway
  (the override is refused) and is DIST-01-shaped work, out of scope for v4.0.

- **D-84:** **Removal is build-time + branding pref file + policies.json. No
  autoconfig.**
  - Build-time, folded into the **same `browser/moz.configure` hunk** as D-78 and
    D-80 (marginal cost: zero extra files): `imply_option("MOZ_NORMANDY", False)`
    **and `imply_option("MOZ_SERVICES_HEALTHREPORT", False)`** — confirmed safe
    2026-08-21: the flag is referenced only by a telemetry pref gate
    (`modules/libpref/init/all.js:3734`) and by `MOZ_DATA_REPORTING`
    (`toolkit/moz.configure:3498`); nothing functional depends on it. Code that is not compiled cannot be
    re-enabled at runtime. `.mozconfig` already carries `--disable-updater`;
    `--disable-crashreporter` joins it.
  - Runtime defaults: our own branding pref file. Note the filename is
    **hardcoded** as `pref/firefox-branding.js` by
    `branding-common.mozbuild:13-15` — it is read from *our* branding directory,
    so this is still a zero-patch mechanism, but the filename cannot be renamed.
  - `distribution/policies.json` only for the handful that genuinely must be
    locked.
  - **Prefs stay unlocked** so the developer can debug their own product.
  **Rejected: the autoconfig `.cfg` + `defaults/pref/autoconfig.js` pair**
  (LibreWolf's pattern). It is privileged JS evaluated at startup where a typo
  can quit the app before it opens (`nsReadConfig.cpp:96-110`) — a harsh failure
  mode for lock semantics `policies.json` already provides where needed.

- **D-85:** **The allowlist is strict: any unlisted host fails the check,
  Mozilla or not.** Every third-party callout — Google Safe Browsing, Google's
  `edgedl.me.gvt1.com`, Cisco's OpenH264 host — must be either explicitly waived
  with a stated reason or turned off. Rationale: it catches endpoints nobody
  thought to enumerate and makes the DRM and codec trade-offs visible decisions
  rather than inherited defaults.

- **D-86:** **DRM is deliberately kept working.** Blank
  `media.gmp-manager.url`, leave `media.gmp-manager.allowLocalSources` true; the
  in-tree `widevinecdm.json` still installs the CDM from Google's
  `edgedl.me.gvt1.com` with **no Mozilla host involved**. Per C-4 this costs
  nothing at startup, because Widevine is genuinely lazy on Linux.
  For reference, the actual fetch triggers are `media.eme.enabled` →
  `onPrefEMEGlobalEnabledChanged` → `checkForUpdates(10s)`
  (`GMPProvider.sys.mjs:544`) and the automatic `EMEVideo:CDMMissing` observer →
  `checkForUpdates(0)` (`:636`). `media.gmp-widevinecdm.enabled` is **not** a
  trigger — it routes to `onPrefEnabledChanged`, which never fetches
  (`:576-580`), and already defaults true on Linux.

- **D-87:** **`media.gmp-gmpopenh264.enabled = false`** — OpenH264 is the one
  genuinely unattended download at startup (`firefox.js:2393-2394`, visible and
  enabled unconditionally). Also set
  `extensions.systemAddon.update.enabled = false`, which kills the system-addon
  callout **before the URL is ever read** (`AddonManager.sys.mjs:1355`) — lazier
  and more robust than blanking the URL.

- **D-88:** **Criterion 4's two negative assertions get three proof layers, each
  with a working positive control.** Phase 2 shipped a negative check that was
  green for the wrong reason across three plans (`verify-dev-flag-off`); a check
  without a failing control proves nothing.
  1. **Static** — grep `objdir/dist/bin/greprefs.js` and
     `browser/defaults/preferences/*.js` against the allowlist. Cheap enough to
     run every build.
  2. **Filesystem** — `strace` with an **exact-path** match on
     `$HOME/.mozilla/firefox`. **Never a bare `.mozilla`**:
     `nsXREDirProvider.cpp:427` and `:1295` hardcode `~/.mozilla` on every build,
     so a loose match false-fails a correct build.
  3. **Network** — `MOZ_LOG=nsHostResolver:5` over a full session.
  Positive control for all three: restore the `aus5.mozilla.org` URL and confirm
  each check goes red.

### Claude's Discretion

The user did not specify these; the planner should treat the leanings as
defaults, not constraints.

- **Branding overlay mechanism** — how `sourcerer/branding/{dev,release}` gets
  *inside* `upstream/` (C-2 requires it be inside topsrcdir). Options: a symlink
  registered in `upstream/.git/info/exclude`, or a copy staged by the build
  script. Leaning: symlink — smaller, and it keeps the editable source under
  version control at the repo root while satisfying `is_read_allowed`. Whichever
  is chosen must be accounted for by D-76's "expected dirt" set.
- **Branding asset pipeline** — the Linux set is
  `default16/32/48/64/128.png` (per
  `upstream/browser/branding/branding-common.mozbuild`, the `MOZ_WIDGET_TOOLKIT
  == "gtk"` branch; Windows `.ico` / macOS `.icns` are not needed for a
  Linux-only build). Source is `logo/LE logo.svg` — 527 bytes, three crossed lens
  shapes plus three dots, **`fill:#fff` so it must be recoloured** or it is
  invisible (Phase 2 D-36). Leaning: generate with a tool already in the Nix
  shell rather than adding one.
- **The `.desktop` file** — the build produces none, so it is hand-written.
  `StartupWMClass` **must equal `MOZ_APP_REMOTINGNAME`** or window grouping
  breaks. Leaning: ship it under `sourcerer/`, install path documented in
  `docs/BUILD.md`.
- **Which prefs go in `policies.json` vs the branding pref file** (D-84's "the
  handful that must be locked"). Leaning: keep `policies.json` as small as
  possible; anything the developer might want to flip while debugging belongs in
  the unlocked pref file.
- **Plan/wave slicing.** Leaning: follow Phase 2's proven shape — a tracer slice
  first (one end-to-end proof: branding overlay in place, one patched line
  applied, a rebuilt binary reporting Sourcerer), then a Wave-0 red-by-design
  verification harness, then the feature plans. Both patterns are recorded in
  `02-LEARNINGS.md` and both paid off there.
- **`--with-distribution-id` value.** Settled: `org.deocracy`, consistent with
  D-80's `MOZ_APP_VENDOR=Deocracy`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative requirements and architecture
- `docs/PRODUCT-REQUIREMENTS.md` — R1–R9, CONFIRMED 2026-08-19. R1 (Rebrand) and
  R2 (Own build) are what this phase delivers.
- `docs/research/sourcerer-architecture.md` §"Repo & build strategy" and
  §"Build order" — the Zen model (`upstream/` + `patches/` + `sourcerer/`) and
  milestone 1 ("Firefox ESR builds under our branding, stock UI"), which is
  exactly this phase.
- `.planning/REQUIREMENTS.md` — BUILD-03, BUILD-04, BRAND-01/02/03/04/06.
  **Requires amendment** per D-70 and D-79.
- `.planning/ROADMAP.md` §"Phase 3: Branded Firefox Fork" — the five success
  criteria. **Criteria 1 and 3 require amendment** per D-79 and D-70.

### Pitfalls that drive decisions here
- `.planning/research/PITFALLS.md` §Pitfall 3 — the artifact-build ceiling; an
  artifact build does **not** error on a forbidden change, it silently produces a
  build that does not reflect it. Drives D-72.
- `.planning/research/PITFALLS.md` §Pitfall 8 — patch-set drift makes a fork
  unrebaseable; prefer new files under `sourcerer/` over editing `upstream/`.
  Drives D-74, D-80, D-81.
- `.planning/research/PITFALLS.md` §Pitfall 2 — cbindgen/rustc FFI drift,
  re-verified every ESR rebase. `toolchain-baseline.txt` is the Phase 1 baseline
  the rebase CI (D-77) diffs against.
- `.planning/research/PITFALLS.md` §Pitfall 10 — scope creep into chrome/GUI
  work. Phase 3 must not touch `browser.xhtml`.
- `.planning/research/PITFALLS.md` §"UX Pitfalls" — rebrand at the
  `moz-app-name`/vendor/update-URL/profile-directory level, not just visible
  strings. Drives D-80.

### Prior phases
- `.planning/phases/01-build-infrastructure/01-CONTEXT.md` — D-01/D-02 (`upstream/`
  gitignored, shallow git checkout), D-03 (`upstream/` is the reserved name),
  D-04 (one documented command), D-11/D-12 (full compile proven; artifact builds
  deferred *to here*), D-13 (toolchain baseline), D-15 (`firefox-esr-153-unwrapped`,
  never the alias).
- `.planning/phases/01-build-infrastructure/01-03-SUMMARY.md` — the proven build:
  3224s wall, 14 GB objdir, `objdir/dist/bin/firefox` launchable. Note its 5.6 GB
  figure is the working tree, not the pack (C-6).
- `.planning/phases/02-sourcerer-theia-extensions/02-CONTEXT.md` — D-36 (the logo
  asset and its `fill:#fff` problem), D-37 (BRAND-06 deferred *to here*), D-69
  (the BiDi verification harness).
- `.planning/phases/02-sourcerer-theia-extensions/02-LEARNINGS.md` — **required
  reading.** The verification patterns this phase reuses: tracer slice as the
  first plan; Wave-0 red-by-design harness; every negative assertion ships with a
  working positive control; non-vacuous proof by deliberately breaking the thing;
  extend the single verification script rather than adding a sibling. Also the
  standing environment note on orphaned `/tmp/sourcerer-firefox-bidi-*` profiles
  and the sandbox's `rm -rf` guard (use `find -delete`).

### Build docs and scripts in this repo
- `docs/BUILD.md` §"Firefox half" and §"Toolchain baseline" — gains the D-72
  boundary section and the D-73 re-measured timings.
- `flake.nix` — the `firefox` devShell; gains sccache per D-71. Its existing
  comments explain the clang-stdenv override and the bintools env-var unsets that
  D-71's smoke test must not break.
- `.mozconfig` — already carries `--disable-updater`; gains
  `--disable-crashreporter` and the branding/basename options per D-84 and the
  identity split.
- `scripts/fetch-upstream.sh` — the clean-tree gate D-76 modifies.
- `scripts/lib/firefox-bidi.mjs` — the zero-dependency WebDriver BiDi driver
  from Phase 2; reusable here, with the caveat that in Phase 3 the browser under
  test is itself the thing being changed.

### Firefox internals verified during discussion (file:line, in `upstream/`)
- `browser/moz.configure:14-15` — `imply_option("MOZ_APP_VENDOR", "Mozilla")` and
  `MOZ_APP_ID`. The single patch target (D-78, D-80, D-84).
- `build/moz.configure/util.configure:529` — `possible_origins=("implied",)`,
  which is *why* those four variables need a patch.
- `build/moz.configure/init.configure` §"Branding" — `--with-app-basename` /
  `MOZ_APP_BASENAME`, and its default-to-`Firefox` behaviour.
- `toolkit/moz.configure:93` — `--with-distribution-id`, default `org.mozilla`.
- `browser/branding/branding-common.mozbuild` — the `FirefoxBranding()` template;
  `JS_PREFERENCE_FILES` wiring at `:13-15` and the gtk icon set.
- `python/mozbuild/mozbuild/frontend/reader.py:1279-1284` — `is_read_allowed`,
  which rejects a repo-root branding directory (C-2).
- `python/mozbuild/mozbuild/frontend/emitter.py:1126-1133` — the compiled-suffix
  set behind D-72's guard.
- `python/mozbuild/mozbuild/artifacts.py:92,632,663` — hardcoded `"firefox"`
  product and install paths (C-1).
- `modules/libpref/init/StaticPrefList.yaml:12162-12175` — `media.eme.enabled`
  false on Linux (C-4).
- `modules/libpref/init/all.js:534,3474` — `toolkit.telemetry.server`,
  `media.gmp-manager.url`.
- `browser/app/profile/firefox.js:55,2393-2394,2866-2876` —
  `extensions.systemAddon.update.url`, OpenH264 prefs, Normandy/Shield prefs.
- `services/settings/Utils.sys.mjs:52-84` — the Remote Settings override refusal
  (D-83).
- `toolkit/xre/nsXREDirProvider.cpp:427,1295,1495-1536` — hardcoded `~/.mozilla`
  paths (D-88's exact-match rule) and the `MOZ_APP_PROFILE` branch (D-81).

### Project rules
- `CLAUDE.md` — never modify Gecko; the space-free-path constraint; Theia is the
  only GUI in v4.0 (no chrome work in this phase).
- `.claude/CLAUDE.md` — the stack table and the "What NOT to Use" list, including
  the artifact-revision caveat that C-1 has now superseded with a measurement.

### External precedent (fetch only if the planner needs the pattern)
- `zen-browser/desktop` `.github/workflows/sync-upstream.yml` — the shape D-77
  cribs.
- `zen-browser/surfer` `git-patch.ts` — the patch replay model D-74 follows.
- LibreWolf `scripts/librewolf-patches.py` and `check-patchfail.sh` — the
  fail-loudly-on-patch-failure precedent behind D-74/D-75.
- BrowserWorks/Waterfox `waterfox/moz.configure:7` — the
  `MOZ_APP_UA_NAME="Firefox"` precedent behind D-78, and their issue #345 for
  why the dual token was abandoned.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/lib/firefox-bidi.mjs`** — Phase 2's zero-dependency WebDriver BiDi
  driver over Node's global `WebSocket`, with `withFirefoxPage`, `waitFor`, and
  a same-session `screenshot()`. Directly usable for the about:support and
  window-title items of D-79's checklist. Caveat: it drives
  `objdir/dist/bin/firefox`, which in this phase **is the thing under test** and
  whose path changes when `MOZ_APP_NAME` becomes `sourcerer` — the driver's
  binary path needs to become a parameter, not a constant.
- **`scripts/fetch-upstream.sh`** — already re-runnable and already does
  commit-SHA identity checking (not `git describe`, which ties non-deterministically
  between the `_RELEASE` and `_BUILD1` tags on this commit). D-76 extends its
  dirty-tree branch; the identity logic stays.
- **`scripts/smoke-firefox.sh`** — Phase 1's Wave-0 gate for BUILD-02. The
  natural place to extend for the rebranded binary rather than adding a sibling
  (02-LEARNINGS.md: "Extend the single verification script, never add a sibling").
- **`objdir/`** — a complete 14 GB build of stock 153.1.0esr already exists, so
  the first branded rebuild is incremental, not cold. Do not clobber it casually.
- **`toolchain-baseline.txt`** — Phase 1's resolved rustc/cbindgen record, which
  D-77's rebase CI diffs against per PITFALLS #2.
- **`logo/LE logo.svg`** — the source mark for D-82's two icon sets. Needs
  recolouring (Phase 2 D-36).

### Established Patterns
- **Verification is written before the code and is red by design** (Phase 2 Wave
  0). Applies directly to D-73's guard positive control and D-88's three layers.
- **Every negative assertion ships with a working positive control.** D-88 is
  built on this; it is the pattern Phase 2 learned the hard way.
- **One re-runnable script per concern, extended rather than forked.**
- **`.gitignore` rules are anchored** — Phase 2 found an unanchored `lib/` rule
  silently swallowing hand-written source. Any new ignore rule for the branding
  overlay must be anchored and verified with `git check-ignore -v`.
- **Nix shells override `stdenv` deliberately.** `flake.nix`'s `firefox` shell
  uses `pkgs.mkShell.override { stdenv = pkgs.llvmPackages.stdenv; }` and unsets
  the bintools-wrapper tool variables. D-71's sccache addition sits inside that
  fragile arrangement.

### Integration Points
- `upstream/browser/moz.configure` — **the single Gecko file this phase patches.**
  One hunk carries D-78 (`MOZ_APP_UA_NAME`), D-80 (`MOZ_APP_VENDOR`), and D-84's
  build-time flags.
- `upstream/` receives the branding overlay (C-2 requires it be inside
  topsrcdir); `patches/` and `sourcerer/` are created at the repo root per
  BUILD-03's layout.
- `.mozconfig` — where every zero-patch identity option lands.
- `flake.nix` `firefox` devShell — D-71.
- `docs/BUILD.md` — D-72's boundary section, D-73's re-measured timings, the
  `.desktop` install path.
- `.github/workflows/` — created in this phase for the first time (D-77).
- **Phase 4 consumes this phase's output**: `sourcerer.xhtml` replaces
  `browser.xhtml` on top of this branded build, and `sourcerer/INTERNAL-APIS.md`
  is created there, not here (D-72).

### Environment constraint
Repo must stay at the space-free path `/home/chris/coding/sourcerer` —
`mkShell` appends `-rpath $PWD/outputs/out/lib` to the space-separated
`NIX_LDFLAGS`, and a space makes the cc-wrapper split it, failing every native
link step.

</code_context>

<specifics>
## Specific Ideas

### Verification performed during this discussion (2026-08-21)

Checked live against the local tree and the network, not assumed. Each was then
independently re-checked by an adversarial verifier; the seven that did not
survive are recorded as C-1 through C-6 in `<decisions>`.

| Claim | Result |
|---|---|
| Taskcluster artifacts exist for ESR 153 | ✅ HTTP 200, taskId `SdVnPeCjS12I7p6TThaCYw`, 86,178,792-byte `target.tar.xz`, expires 2027-08-11 |
| Artifact builds can produce a renamed binary | ❌ `product` hardcoded `"firefox"` (`artifacts.py:92`); `MOZ_APP_NAME` is a compiled define |
| `MOZ_APP_VENDOR` settable from `.mozconfig` | ❌ `possible_origins=("implied",)` — patch required |
| `MOZ_APP_BASENAME` settable from `.mozconfig` | ✅ `--with-app-basename` |
| Branding dir can live at repo root | ❌ rejected by `is_read_allowed`; must be inside `upstream/` |
| `MOZ_APP_BASENAME=Sourcerer` strips the Firefox UA token | ✅ observed in a real configure + run |
| Widevine fetched at startup on Linux | ❌ `media.eme.enabled` defaults false; genuinely lazy |
| `services.settings.server` overridable on our channel | ❌ refused off Nightly (`Utils.sys.mjs:52-84`) |
| `./mach build faster` warm timing | 2.55s — **inherited, must be re-measured (D-73)** |
| `dist/bin` files that are symlinks into `upstream/` | 7450 of 7784 |
| `upstream/.git` size / refs | 1.1 GB, shallow, exactly 2 tags |
| Repo has a GitHub remote | ✅ `origin` → `https://github.com/Deocracy/Sourcerer.git` |

### The shape of the phase

The through-line worth preserving through planning: **the entire Gecko patch
surface is one hunk in a 54-line file.** `browser/moz.configure` carries the
vendor line, the UA line, and BRAND-04's build-time flags together — so BRAND-04's
marginal rebase cost is exactly zero additional files, and BUILD-03's
rebase-conflict surface is as small as it can be made without giving up
requirements. Any planning proposal that grows the patch count should have to
justify itself against that.

</specifics>

<deferred>
## Deferred Ideas

- **`sourcerer.xhtml`, `SourcererAPI.sys.mjs`, `TheiaService.sys.mjs`** — Phase 4.
  This phase's build shows stock Firefox chrome and that is correct.
- **`sourcerer/INTERNAL-APIS.md`** — Phase 4 creates it (D-72). Its threat section
  inherits Phase 2's D-29 (`ai-terminal` arbitrary execution) and D-66
  (token/origin notes).
- **Scheduled ~4-weekly rebase CI** — post-v4.0 standing operational item, not a
  Phase 3 deliverable (D-77). Phase 3 ships `workflow_dispatch`-only.
- **Own update channel / AUS infrastructure** — DIST-01, post-4.0. v4.0's
  deliverable is disabling the updater, not replacing it.
- **Self-hosted Remote Settings mirror** — rejected for v4.0 (D-83); it needs a
  patch and is DIST-01-shaped infrastructure work.
- **Windows `.ico` / macOS `.icns` branding assets, `mach package`, installers** —
  DIST-02/DIST-03, post-4.0. Linux-only in v4.0, so the branding directories
  carry only the gtk icon set (D-82).
- **Opt-in telemetry pipeline** — explicitly out of scope; v4.0 strips Mozilla
  endpoints and builds nothing to replace them.
- **ESR major-version transition procedure** — PITFALLS #9. v4.0 pins one ESR tag
  and never crosses a major boundary; budget it separately for whichever future
  milestone first does.
- **Re-hosted WebExtension UI** — SURF-01, post-4.0. D-78's byte-identical UA and
  D-81's unchanged `MOZ_APP_ID` are what keep that landable.

</deferred>

---

*Phase: 3-Branded Firefox Fork*
*Context gathered: 2026-08-21*
