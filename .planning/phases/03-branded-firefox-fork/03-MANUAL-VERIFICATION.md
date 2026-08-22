---
phase: 03-branded-firefox-fork
date: 2026-08-22
status: item-a-failed-item-b-passed
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
| `Assets.car` | — | — | yes | N/A — not carried forward |
| `background.png` | — | — | yes | N/A — not carried forward |
| `branding.nsi` | — | — | yes | N/A — not carried forward |
| `configure.sh` | yes | yes | yes | Neutral scaffolding — build plumbing carrying per-variant `MOZ_APP_DISPLAYNAME`; opened, no Mozilla mark |
| `content/aboutDialog.css` | yes | yes | yes | Neutral scaffolding — colors/spacing only (custom `#130829`), no imagery; opened |
| `content/about-logo@2x.png` | — | — | yes | N/A — not carried forward |
| `content/about-logo.png` | — | — | yes | N/A — not carried forward |
| `content/about-logo-private@2x.png` | — | — | yes | N/A — not carried forward |
| `content/about-logo-private.png` | — | — | yes | N/A — not carried forward |
| `content/about-logo.svg` | — | — | yes | N/A — not carried forward |
| `content/about.png` | — | — | yes | N/A — not carried forward |
| `content/about-wordmark.svg` | — | — | yes | N/A — not carried forward |
| `content/document_pdf.svg` | — | — | yes | N/A — not carried forward |
| `content/firefox-wordmark.svg` | — | — | yes | N/A — not carried forward |
| `content/jar.mn` | yes | yes | yes | Sourcerer-authored — stub shipping only the five Sourcerer icons, explicitly refusing Mozilla about-logo/wordmark references; opened |
| `content/moz.build` | yes | yes | yes | Neutral scaffolding; opened, no Mozilla mark |
| `default128.png` | yes | yes | yes | Sourcerer-authored — blue Sourcerer crossed-staves glyph, dev variant adds orange corner dot; both variants viewed |
| `default16.png` | yes | yes | yes | Sourcerer-authored — same glyph as above; both variants viewed |
| `default22.png` | — | — | yes | N/A — not carried forward |
| `default24.png` | — | — | yes | N/A — not carried forward |
| `default256.png` | — | — | yes | N/A — not carried forward |
| `default32.png` | yes | yes | yes | Sourcerer-authored — same glyph as above; both variants viewed |
| `default48.png` | yes | yes | yes | Sourcerer-authored — same glyph as above; both variants viewed |
| `default64.png` | yes | yes | yes | Sourcerer-authored — same glyph as above; both variants viewed |
| `disk.icns` | — | — | yes | N/A — not carried forward |
| `document.icns` | — | — | yes | N/A — not carried forward |
| `document.ico` | — | — | yes | N/A — not carried forward |
| `document_pdf.ico` | — | — | yes | N/A — not carried forward |
| `dsstore` | — | — | yes | N/A — not carried forward |
| `firefox64.ico` | — | — | yes | N/A — not carried forward |
| `firefox.icns` | — | — | yes | N/A — not carried forward |
| `firefox.ico` | — | — | yes | N/A — not carried forward |
| `firefox.VisualElementsManifest.xml` | — | — | yes | N/A — not carried forward |
| `locales/en-US/brand.ftl` | yes | yes | yes | Sourcerer-authored, with one recognised and documented textual use of `Firefox`: `-brand-product-name = Firefox` in both variants, deliberate per decision D-78 (compatibility strings / UA parity) — a textual product-name reference, not a carried-forward trademark asset; opened, both variants |
| `locales/en-US/brand.properties` | yes | yes | yes | Sourcerer-authored; opened, both variants |
| `locales/jar.mn` | yes | yes | yes | Neutral scaffolding; opened, no Mozilla mark |
| `locales/moz.build` | yes | yes | yes | Neutral scaffolding; opened, no Mozilla mark |
| `moz.build` | yes | yes | yes | Neutral scaffolding; opened, no Mozilla mark |
| `msix/Assets/Document44x44.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/LargeTile.scale-200.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/MedTile.scale-200.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/SmallTile.scale-200.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/Square150x150Logo.scale-200.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/Square44x44Logo.altform-lightunplated_targetsize-256.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/Square44x44Logo.altform-unplated_targetsize-256.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/Square44x44Logo.scale-200.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/Square44x44Logo.targetsize-256.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/StoreLogo.scale-200.png` | — | — | yes | N/A — not carried forward |
| `msix/Assets/Wide310x150Logo.scale-200.png` | — | — | yes | N/A — not carried forward |
| `newtab.ico` | — | — | yes | N/A — not carried forward |
| `newwindow.ico` | — | — | yes | N/A — not carried forward |
| `pbmode.ico` | — | — | yes | N/A — not carried forward |
| `pref/firefox-branding.js` | yes | yes | yes | Sourcerer-authored — endpoint-neutering prefs; filename contains "firefox" only because `branding-common.mozbuild` hardcodes it; opened, both variants |
| `PrivateBrowsing_150.png` | — | — | yes | N/A — not carried forward |
| `PrivateBrowsing_70.png` | — | — | yes | N/A — not carried forward |
| `private_browsing.VisualElementsManifest.xml` | — | — | yes | N/A — not carried forward |
| `stubinstaller/bgstub.jpg` | — | — | yes | N/A — not carried forward |
| `stubinstaller/installing_page.css` | — | — | yes | N/A — not carried forward |
| `stubinstaller/profile_cleanup_page.css` | — | — | yes | N/A — not carried forward |
| `VisualElements_150.png` | — | — | yes | N/A — not carried forward |
| `VisualElements_70.png` | — | — | yes | N/A — not carried forward |
| `wizHeader.bmp` | — | — | yes | N/A — not carried forward |
| `wizHeaderRTL.bmp` | — | — | yes | N/A — not carried forward |
| `wizWatermark.bmp` | — | — | yes | N/A — not carried forward |

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

**VERDICT: PASSED. Every carried-forward file is neutral scaffolding or
Sourcerer-authored; zero files classified as a Mozilla trademark asset.**

- Reviewed file count: **15 of 15** carried-forward files (every file present
  in `sourcerer/branding/dev/` or `sourcerer/branding/release/`), each
  reviewed in **both** variant copies. This review was performed
  interactively in the orchestrator session: all 8 text files were dumped in
  full with dev-vs-release diffs, and all 10 icon PNGs (5 sizes × 2 variants)
  were rendered and viewed. None was judged by filename alone.
- Mozilla-mark count (stated explicitly, zero if zero): **0 — explicitly
  zero.** No file under `sourcerer/branding/{dev,release}` carries Mozilla or
  Firefox trademark imagery or identity. The upstream trademark assets
  (`Assets.car`, `about-logo*`, `about-wordmark.svg`, `firefox-wordmark.svg`,
  etc.) were confirmed present only in `upstream/browser/branding/unofficial/`
  and absent from both Sourcerer trees — see the table's "N/A — not carried
  forward" rows.
- Files opened (not judged by filename) for the neutral-scaffolding verdict:
  all six — `moz.build`, `content/moz.build`, `locales/moz.build`,
  `locales/jar.mn`, `configure.sh`, `content/aboutDialog.css`. Each was read
  in full, not inferred from its name.
- Per-row tally against the table above: **6 neutral scaffolding**, **9
  Sourcerer-authored** (`content/jar.mn`, `pref/firefox-branding.js`, the 5
  icon PNGs, `locales/en-US/brand.ftl`, `locales/en-US/brand.properties`),
  **0 Mozilla marks** — sums to all 15 carried-forward rows.
  **Discrepancy noted, not silently resolved:** the reviewer's dictated
  summary stated the category counts as "Neutral scaffolding (7)" and
  "Sourcerer-authored (8)" (7 + 8 = 15, matching the total), but the reviewer's
  own itemised file lists under each label enumerate only 6 and 7 files
  respectively (`locales/en-US/brand.ftl` and `locales/en-US/brand.properties`
  are covered by neither itemised list, only by the separate D-78 textual-use
  note). This worksheet's per-row tally (6 / 9 / 0) is what the table above
  actually encodes and is the version this record treats as authoritative,
  since every row has an explicit verdict; the "(7)"/"(8)" figures are
  recorded here verbatim as the reviewer's stated counts rather than quietly
  adjusted to match. The Mozilla-mark count — the fact this checkpoint exists
  to establish — is unaffected either way: zero under both readings.
- One recognised-and-documented textual use: `-brand-product-name = Firefox`
  in both variants' `brand.ftl`, deliberate per decision D-78 (compatibility
  strings / UA parity). A textual product-name reference, not a carried-forward
  trademark asset — not counted toward the Mozilla-mark tally.
- Findings (if any file lands in the Mozilla-mark category): **none.**
- Date: 2026-08-22
- Reviewer: Christopher Colantuono

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
