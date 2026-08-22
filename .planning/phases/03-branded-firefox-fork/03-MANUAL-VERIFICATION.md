---
phase: 03-branded-firefox-fork
date: 2026-08-22
status: pending
---

# Phase 3: Manual Verification Record

Durable evidence record for Phase 3's two human-only verification items,
carried in `03-VERIFICATION.md`'s `human_verification` frontmatter and listed
as Manual-Only in `03-VALIDATION.md`. Built by `03-10` Task 1. Both outcome
blocks below are filled by a human performing the item, not by this task —
see Tasks 2 and 3 of `03-10-PLAN.md`.

## Item A — Dev vs release at a glance

**Test (verbatim from `03-VERIFICATION.md`):** Launch both branding variants
(`objdir/dist/bin/sourcerer` and `objdir-release/dist/bin/sourcerer`) on a
real desktop session and read the window title bar / taskbar icon directly.

**Expected (verbatim):** Dev shows "Sourcerer Dev" in the title, release
shows "Sourcerer"; the two icon sets (badged vs unbadged) are visually
distinguishable at a glance without opening `about:support`.

**Why human (verbatim):** WebDriver BiDi's `browsingContext.getTree` returns
content contexts only (never the chrome window's title), and
`xprop`/`xdotool`/`wmctrl` are absent from this headless host — confirmed
absent per `03-06-SUMMARY.md`'s own Manual-Only table. "Distinguishable at a
glance" is inherently a human perceptual judgment; the byte-level/string-level
difference is already machine-proven (`MOZ_APP_DISPLAYNAME` differs per
`config.status`, and all five icon PNGs are byte-different per variant — both
re-confirmed independently this session).

**Launch commands** (run from the repository root, `/home/chris/coding/sourcerer`):

1. Dev variant: `objdir/dist/bin/sourcerer`
2. Release variant: `objdir-release/dist/bin/sourcerer`

### Outcome (filled by Task 2)

**VERDICT: FAILED. Item A's expected outcome (dev and release distinguishable
at a glance) did not hold.**

- Observed: window title, dev variant (literal string): **none visible.**
  Both `sourcerer` builds draw tabs-in-titlebar (client-side decorations), so
  the WM title bar that would carry the display name is never painted on this
  desktop. No window title text was displayed for either variant in normal use.
- Observed: window title, release variant (literal string): **none visible.**
  Same client-side-decoration cause as dev; no title text rendered.
- Observed: icon badge present, dev variant (yes/no): **inconclusive.** The
  observer saw "a dot in one and not the other" but could not tell whether it
  was an intentional badge or a rendering artifact.
- Observed: icon badge present, release variant (yes/no): **inconclusive** —
  same uncertainty, no dot observed on this variant per the observer's report.
- Observed: distinguishable at a glance (yes / description of difficulty):
  **NO — not distinguishable.** Observer's verbatim words: "well besites the
  logo having a dot in one and not the other I dont see much difrence (and
  even that I dont know if that is a notise or something)" and "I dont really
  see a diffrece."
- `about:support` used to reach the verdict: **No** — not opened at any point,
  per instruction.
- Date: 2026-08-22
- Observer: Christopher Colantuono

**Procedure deviation:** the plan's steps 1-6 describe launching dev, closing
it, then launching release sequentially. This verification instead launched
both variants concurrently and visible side by side on a real Wayland desktop
session (dev pid 1605330 from `objdir/dist/bin/sourcerer`, release pid 1605762
from `objdir-release/dist/bin/sourcerer`, both with `-no-remote`). Simultaneous
side-by-side comparison is a stricter test of "distinguishable at a glance"
than sequential viewing — the result was still a failure under the stricter
test, so the deviation does not undermine the verdict.

**Supporting evidence gathered after the verdict** (explains, does not
substitute for, the human judgment above):

1. `sourcerer/branding/dev/locales/en-US/brand.properties` contains
   `brandFullName=Sourcerer` — unsuffixed, not "Sourcerer Dev".
2. `diff` of dev vs release `brand.properties` shows the two files are
   byte-identical — no brand string differs between variants in
   `.properties` at all.
3. `diff` of dev vs release `brand.ftl` shows exactly one differing line
   (`-brand-full-name`: "Sourcerer Dev" vs "Sourcerer"); `-brand-short-name`
   and `-brand-shorter-name` are identical ("Sourcerer") in both variants.
4. Therefore dev's own `brand.ftl` (`-brand-full-name = Sourcerer Dev`) and
   dev's own `brand.properties` (`brandFullName=Sourcerer`) contradict each
   other within the same variant — this is a real, pre-existing defect in the
   branding tree, not an artifact of how the check was run.
5. `MOZ_APP_DISPLAYNAME` in `config.status` is correct per variant
   ("Sourcerer Dev" vs "Sourcerer") — the build-level name is right; the
   user-visible brand strings that a person can actually see are what fail.
6. All five icon PNGs differ byte-wise, but visual inspection of
   `default128.png` shows the only difference is a small orange dot in the
   top-right corner. Base glyph, hue, and silhouette are identical. At
   16-32px (favicon/taskbar size) this is a few pixels — consistent with the
   observer's inability to confidently read it as a badge.
7. Startup log for both variants: `Missing chrome or resource URL:
   chrome://branding/content/about-logo@2x.png` — neither branding tree ships
   the 2x about-dialog logo. Separate defect from Item A, recorded here as an
   observation only.

**Why the automated 12/12 gate passed while this human check failed:** the
automated `verify-branding-identity-brand-ftl-control` check (added 03-07)
reads `brand.ftl` only. Nothing in the automated suite checks
`brand.properties`, nothing checks short/shorter-name divergence, and nothing
checks perceptual icon distinctiveness or whether a window title is even
rendered on a given desktop environment. The automated suite proves the
strings it reads differ; it does not and cannot prove a person can tell the
two builds apart, which is exactly why this item is human-only.

## Item B — Branding tree trademark-asset review

**Test (verbatim from `03-VERIFICATION.md`):** Review
`sourcerer/branding/{dev,release}` file-by-file against
`upstream/browser/branding/unofficial/` for any unrecognised Mozilla
trademark asset.

**Expected (verbatim):** Every carried-forward file is neutral scaffolding
(`moz.build`, `configure.sh` boilerplate) rather than a Mozilla mark.

**Why human (verbatim):** The automated check (find for
`.icns`/`.ico`/`Assets.car`/`*.VisualElementsManifest.xml`) is a
filename-based regression guard against KNOWN trademark-asset shapes;
confirming no unrecognised asset was carried forward needs a human reading
the file list once, per `03-06-SUMMARY.md`'s own stated boundary. Not yet
performed by any plan in this phase.

**Automated filename-pattern trademark guard — live output, re-run for this
record (2026-08-22):**

```
$ find sourcerer/branding -iname '*.icns' -o -iname '*.ico' -o -iname Assets.car -o -iname '*.VisualElementsManifest.xml'
(empty — exit 0)
```

This is what the automated guard already covers: none of the four known
trademark-asset filename shapes are present anywhere under
`sourcerer/branding`. What is left for the human reviewer below is every file
that shape-based guard cannot recognise — i.e., everything actually present.

**Three-tree file comparison** (generated by `find` over all three trees,
sorted, relative paths; regenerating this table twice produced byte-identical
output — confirmed this session):

| File | Dev | Release | Upstream (unofficial) | Verdict |
|------|-----|---------|------------------------|---------|
| `Assets.car` | — | — | yes |  |
| `background.png` | — | — | yes |  |
| `branding.nsi` | — | — | yes |  |
| `configure.sh` | yes | yes | yes |  |
| `content/aboutDialog.css` | yes | yes | yes |  |
| `content/about-logo@2x.png` | — | — | yes |  |
| `content/about-logo.png` | — | — | yes |  |
| `content/about-logo-private@2x.png` | — | — | yes |  |
| `content/about-logo-private.png` | — | — | yes |  |
| `content/about-logo.svg` | — | — | yes |  |
| `content/about.png` | — | — | yes |  |
| `content/about-wordmark.svg` | — | — | yes |  |
| `content/document_pdf.svg` | — | — | yes |  |
| `content/firefox-wordmark.svg` | — | — | yes |  |
| `content/jar.mn` | yes | yes | yes |  |
| `content/moz.build` | yes | yes | yes |  |
| `default128.png` | yes | yes | yes |  |
| `default16.png` | yes | yes | yes |  |
| `default22.png` | — | — | yes |  |
| `default24.png` | — | — | yes |  |
| `default256.png` | — | — | yes |  |
| `default32.png` | yes | yes | yes |  |
| `default48.png` | yes | yes | yes |  |
| `default64.png` | yes | yes | yes |  |
| `disk.icns` | — | — | yes |  |
| `document.icns` | — | — | yes |  |
| `document.ico` | — | — | yes |  |
| `document_pdf.ico` | — | — | yes |  |
| `dsstore` | — | — | yes |  |
| `firefox64.ico` | — | — | yes |  |
| `firefox.icns` | — | — | yes |  |
| `firefox.ico` | — | — | yes |  |
| `firefox.VisualElementsManifest.xml` | — | — | yes |  |
| `locales/en-US/brand.ftl` | yes | yes | yes |  |
| `locales/en-US/brand.properties` | yes | yes | yes |  |
| `locales/jar.mn` | yes | yes | yes |  |
| `locales/moz.build` | yes | yes | yes |  |
| `moz.build` | yes | yes | yes |  |
| `msix/Assets/Document44x44.png` | — | — | yes |  |
| `msix/Assets/LargeTile.scale-200.png` | — | — | yes |  |
| `msix/Assets/MedTile.scale-200.png` | — | — | yes |  |
| `msix/Assets/SmallTile.scale-200.png` | — | — | yes |  |
| `msix/Assets/Square150x150Logo.scale-200.png` | — | — | yes |  |
| `msix/Assets/Square44x44Logo.altform-lightunplated_targetsize-256.png` | — | — | yes |  |
| `msix/Assets/Square44x44Logo.altform-unplated_targetsize-256.png` | — | — | yes |  |
| `msix/Assets/Square44x44Logo.scale-200.png` | — | — | yes |  |
| `msix/Assets/Square44x44Logo.targetsize-256.png` | — | — | yes |  |
| `msix/Assets/StoreLogo.scale-200.png` | — | — | yes |  |
| `msix/Assets/Wide310x150Logo.scale-200.png` | — | — | yes |  |
| `newtab.ico` | — | — | yes |  |
| `newwindow.ico` | — | — | yes |  |
| `pbmode.ico` | — | — | yes |  |
| `pref/firefox-branding.js` | yes | yes | yes |  |
| `PrivateBrowsing_150.png` | — | — | yes |  |
| `PrivateBrowsing_70.png` | — | — | yes |  |
| `private_browsing.VisualElementsManifest.xml` | — | — | yes |  |
| `stubinstaller/bgstub.jpg` | — | — | yes |  |
| `stubinstaller/installing_page.css` | — | — | yes |  |
| `stubinstaller/profile_cleanup_page.css` | — | — | yes |  |
| `VisualElements_150.png` | — | — | yes |  |
| `VisualElements_70.png` | — | — | yes |  |
| `wizHeader.bmp` | — | — | yes |  |
| `wizHeaderRTL.bmp` | — | — | yes |  |
| `wizWatermark.bmp` | — | — | yes |  |

Generation command (relative to repo root):

```
DEV=$(find sourcerer/branding/dev -type f | sed 's#^sourcerer/branding/dev/##')
REL=$(find sourcerer/branding/release -type f | sed 's#^sourcerer/branding/release/##')
UP=$(find upstream/browser/branding/unofficial -type f | sed 's#^upstream/browser/branding/unofficial/##')
printf '%s\n%s\n%s\n' "$DEV" "$REL" "$UP" | sort -u
```

Rows present in Dev/Release but not Upstream (the 15 files Sourcerer's two
trees actually ship: `configure.sh`, `content/aboutDialog.css`,
`content/jar.mn`, `content/moz.build`, `default128.png`, `default16.png`,
`default32.png`, `default48.png`, `default64.png`, `locales/en-US/brand.ftl`,
`locales/en-US/brand.properties`, `locales/jar.mn`, `locales/moz.build`,
`moz.build`, `pref/firefox-branding.js`) are the carried-forward candidates
the review below is most concerned with, since every one of them shares a
name with an upstream file. The remaining ~50 upstream-only rows (icons,
`.icns`/`.ico` variants, `msix/`, `stubinstaller/`, NSIS installer assets)
are not present in either Sourcerer tree at all — they were never carried
forward — but are listed for completeness so the table is a full three-way
comparison, not a filtered one.

### Outcome (filled by Task 3)

- Reviewed file count: _pending_
- Mozilla-mark count (stated explicitly, zero if zero): _pending_
- Files opened (not judged by filename) for the neutral-scaffolding verdict: _pending_
- Findings (if any file lands in the Mozilla-mark category): _pending_
- Date: _pending_
- Reviewer: _pending_

## Final phase gate

Verbatim `bash scripts/verify-phase-03.sh` output, run as part of this task
(not copied from an earlier plan's summary).

**Run date:** 2026-08-22T04:03:00Z (approx; captured at Task 1 execution time)
**Exit code:** 0
**Check count:** 12

Arithmetic reconciling the check count: the pre-gap-closure count (recorded
in `03-06-SUMMARY.md`, end of the phase's main build-out) was 8. `03-07`
added `verify-branding-identity-brand-ftl-control` (+1, closing Gap 1 /
CR-01). `03-08` added `verify-endpoints-interrupt-self-test` (+1, closing
Gap 3 / CR-02). `03-09` added `allowlist-doc-consistency` and
`allowlist-doc-consistency-self-test` (+2, closing Gap 2). 8 + 1 + 1 + 2 = 12,
matching the live run below exactly — no mismatch.

```
verify-phase-03: running check-patch-surface...
check-patch-surface: PASS -- no compiled-file target paths in 1 patch(es)
verify-phase-03: running check-patch-surface-self-test...
check-patch-surface: --self-test PASS -- planted compiled-file patch (900-bad.patch, nsGlobalWindowInner.cpp) was correctly rejected
verify-phase-03: running apply-patches-self-test...
apply-patches: --self-test PASS -- first apply of 010-sourcerer-identity.patch succeeded and changed the file
apply-patches: --self-test PASS -- second apply of 010-sourcerer-identity.patch was correctly rejected by name
verify-phase-03: running fetch-upstream-self-test...
self-test: pristine PASS
self-test: fully-applied PASS
self-test: unaccounted-dirt PASS (correctly rejected, names fileC + remediation)
self-test: missing-patch PASS (correctly rejected, names 020-b.patch)
verify-phase-03: running allowlist-schema...
allowlist-schema: PASS -- 21 host(s), 25 pref(s)
verify-phase-03: running allowlist-doc-consistency...
allowlist-doc-consistency: PASS -- 3 Mozilla allow host(s) checked, found in both ROADMAP.md (3) and REQUIREMENTS.md (3)
verify-phase-03: running allowlist-doc-consistency-self-test...
allowlist-doc-consistency-self-test: PASS -- both planted hosts (undocumented control, suffix-adjacency) correctly rejected
verify-phase-03: running verify-branding-identity-dev...
verify-branding-identity: PASS executable -- /home/chris/coding/sourcerer/objdir/dist/bin/sourcerer executable=true; /home/chris/coding/sourcerer/objdir/dist/bin/firefox absent=true
verify-branding-identity: PASS application-ini -- Name="Sourcerer" (expected "Sourcerer"), Vendor="Deocracy" (expected "Deocracy")
verify-branding-identity: PASS about-support -- application-box="Sourcerer" (expected "Sourcerer"), version-box="153.1.0esr" (expected "153.1.0esr")
verify-branding-identity: PASS brand-full-name -- variant=dev brand.ftl=/home/chris/coding/sourcerer/sourcerer/branding/dev/locales/en-US/brand.ftl -brand-full-name="Sourcerer Dev" (expected "Sourcerer Dev")
verify-branding-identity: PASS desktop-entry -- Name="Sourcerer Dev" (expected "Sourcerer Dev"), StartupWMClass="sourcerer" (expected "sourcerer")
verify-branding-identity: PASS version -- --version output="Deocracy Sourcerer 153.1.0esr" (expected "Deocracy Sourcerer 153.1.0esr")
verify-branding-identity: PASS -- all six surfaces correct
verify-phase-03: running verify-branding-identity-release...
verify-branding-identity: PASS executable -- /home/chris/coding/sourcerer/objdir-release/dist/bin/sourcerer executable=true; /home/chris/coding/sourcerer/objdir-release/dist/bin/firefox absent=true
verify-branding-identity: PASS application-ini -- Name="Sourcerer" (expected "Sourcerer"), Vendor="Deocracy" (expected "Deocracy")
verify-branding-identity: PASS about-support -- application-box="Sourcerer" (expected "Sourcerer"), version-box="153.1.0esr" (expected "153.1.0esr")
verify-branding-identity: PASS brand-full-name -- variant=release brand.ftl=/home/chris/coding/sourcerer/sourcerer/branding/release/locales/en-US/brand.ftl -brand-full-name="Sourcerer" (expected "Sourcerer")
verify-branding-identity: PASS desktop-entry -- Name="Sourcerer" (expected "Sourcerer"), StartupWMClass="sourcerer" (expected "sourcerer")
verify-branding-identity: PASS version -- --version output="Deocracy Sourcerer 153.1.0esr" (expected "Deocracy Sourcerer 153.1.0esr")
verify-branding-identity: PASS -- all six surfaces correct
verify-phase-03: running verify-branding-identity-brand-ftl-control...
verify-branding-identity: PASS -- positive control for 'brand-full-name' correctly reported FAILURE against the stock Firefox value (variant=release brand.ftl=/home/chris/coding/sourcerer/sourcerer/branding/dev/locales/en-US/brand.ftl -brand-full-name="Sourcerer Dev" (expected "Sourcerer"))
verify-phase-03: running verify-endpoints...
verify-endpoints: layer 1 (static prefs)...
  PASS media.gmp-manager.url
  PASS extensions.systemAddon.update.url
  PASS extensions.systemAddon.update.enabled
  PASS media.gmp-gmpopenh264.enabled
  PASS toolkit.telemetry.unified
  PASS toolkit.telemetry.server
  PASS datareporting.healthreport.uploadEnabled
  PASS datareporting.policy.dataSubmissionEnabled
  PASS network.captive-portal-service.enabled
  PASS captivedetect.canonicalURL
  PASS app.normandy.enabled
  PASS app.shield.optoutstudies.enabled
  PASS browser.newtabpage.activity-stream.discoverystream.enabled
  PASS browser.newtabpage.activity-stream.showSponsored
  PASS browser.newtabpage.activity-stream.showSponsoredTopSites
  PASS browser.topsites.contile.enabled
  PASS browser.region.network.url
  PASS dom.push.serverURL
  PASS network.connectivity-service.enabled
  PASS extensions.getAddons.cache.enabled
  PASS extensions.getAddons.get.url
  PASS extensions.getAddons.langpacks.url
  PASS extensions.getAddons.discovery.api_url
  PASS extensions.getAddons.browserMappings.url
  PASS extensions.addonAbuseReport.url
verify-endpoints: layer 1 PASS
verify-endpoints: layer 2 (filesystem, strace)...
verify-endpoints: layer 2 PASS -- $HOME activity observed (1051 line(s)), zero touches to $HOME/.mozilla/firefox
verify-endpoints: layer 3 (network, MOZ_LOG)...
*** You are running in headless mode.
Crash Annotation GraphicsCriticalError: |[0][GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt (t=0.654565) [GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt
Exiting due to channel error.
Exiting due to channel error.
Exiting due to channel error.
Exiting due to channel error.
Exiting due to channel error.
Exiting due to channel error.
verify-endpoints: layer 3 PASS -- all resolved hosts are allowlisted
verify-endpoints: PASS
verify-phase-03: running verify-endpoints-interrupt-self-test...
verify-endpoints: interrupt self-test...
verify-endpoints: interrupt self-test observed the mutated pref after 1s -- sending SIGINT to the control's process group
verify-endpoints: interrupt self-test PASS -- pref file digest unchanged after interrupt (727009586545c3b325f19d4e780a5e8b7332f360c65715ab2f3172331def2e02)

verify-phase-03: summary
  check-patch-surface: PASS
  check-patch-surface-self-test: PASS
  apply-patches-self-test: PASS
  fetch-upstream-self-test: PASS
  allowlist-schema: PASS
  allowlist-doc-consistency: PASS
  allowlist-doc-consistency-self-test: PASS
  verify-branding-identity-dev: PASS
  verify-branding-identity-release: PASS
  verify-branding-identity-brand-ftl-control: PASS
  verify-endpoints: PASS
  verify-endpoints-interrupt-self-test: PASS
verify-phase-03: PASS -- all checks passed
```

Exit code confirmed: `echo $?` immediately after the run above printed `0`.
