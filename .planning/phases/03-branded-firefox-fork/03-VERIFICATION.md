---
phase: 03-branded-firefox-fork
verified: 2026-08-22T01:57:19Z
status: gaps_found
score: 3/5 roadmap success criteria fully verified (2 partial)
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Six identity surfaces each report Sourcerer, verified by command (Success Criterion 1) -- for BOTH the dev and release variants"
    status: partial
    reason: >
      Surfaces 1 (executable), 2 (application.ini), 3 (about:support), 5
      (.desktop) and 6 (--version) are genuinely command-verified for BOTH
      variants -- independently re-run this session with
      `node scripts/verify-branding-identity.mjs --bin objdir-release/dist/bin/sourcerer
      --desktop sourcerer/sourcerer-release.desktop --config-status objdir-release/config.status`,
      confirmed each of those five surfaces reads the release binary/desktop/
      config.status it is pointed at and reports the correct release values
      (Name="Sourcerer", --version="Deocracy Sourcerer 153.1.0esr", etc).
      Surface 4 (brand-full-name) is NOT command-verified for the release
      variant: `BRAND_FTL_PATH` (verify-branding-identity.mjs:141) is a
      hardcoded constant pointing at
      `sourcerer/branding/dev/locales/en-US/brand.ftl`, and `checkBrandFullName()`
      (lines 271-280) hardcodes its expected value to the literal
      `'Sourcerer Dev'`. Neither responds to `--bin`/`--desktop`/`--config-status`.
      Confirmed by direct execution this session: the release invocation
      (`scripts/verify-phase-03.sh`'s own `verify-branding-identity-release`
      check, line 149) prints
      `PASS brand-full-name -- dev variant -brand-full-name="Sourcerer Dev" (expected "Sourcerer Dev")`
      -- it never reads `sourcerer/branding/release/locales/en-US/brand.ftl` at
      all. If that file were reverted, deleted, or made identical to dev's,
      this check would still report PASS. This is CR-01 from `03-REVIEW.md`,
      independently reproduced.
      The underlying VALUE is nonetheless correct: direct inspection of
      `sourcerer/branding/release/locales/en-US/brand.ftl:8` this session
      confirms `-brand-full-name = Sourcerer` (not "Sourcerer Dev"), so the
      release build's actual identity is right -- only the machine-checked
      proof of it is missing. 03-05-SUMMARY.md's claim that "identity surface
      4 reads two different real values from the two variants' own `brand.ftl`
      files" is false as implemented; it reads the same file and the same
      constant every time, regardless of variant.
    artifacts:
      - path: "scripts/verify-branding-identity.mjs"
        issue: "BRAND_FTL_PATH (line 141) and checkBrandFullName()'s expected literal (line 273) are both hardcoded to the dev tree/value; no --brand-ftl override exists"
      - path: "scripts/verify-phase-03.sh"
        issue: "line 149's verify-branding-identity-release invocation passes --bin/--desktop/--config-status but has no --brand-ftl flag to pass, because the target script doesn't support one"
    missing:
      - "Add a --brand-ftl <path> override to verify-branding-identity.mjs (mirroring --desktop/--config-status), and an --expect-brand-full-name (or config.status-derived expectation) so checkBrandFullName() stops hardcoding 'Sourcerer Dev'"
      - "Thread --brand-ftl sourcerer/branding/release/locales/en-US/brand.ftl (plus the release expectation) into verify-phase-03.sh's verify-branding-identity-release entry"
      - "Correct 03-05-SUMMARY.md's D3 claim that surface 4 is one of three independently-verified per-variant signals -- as implemented it is not a per-variant signal at all"
  - truth: "A full-session network capture contacts no host outside a documented allowlist, whose only Mozilla entry is the firefox.settings.services.mozilla.com Remote Settings carve-out (Success Criterion 4, verbatim)"
    status: partial
    reason: >
      The strace exact-path layer (BRAND-03) and all three positive controls
      genuinely discriminate and were independently re-run this session
      (bash scripts/verify-phase-03.sh, full run, 8/8 PASS). But
      sourcerer/endpoint-allowlist.json's allow-dispositioned host list
      currently contains THREE mozilla.com/mozilla.net hosts, not one:
      firefox.settings.services.mozilla.com, content-signature-2.cdn.mozilla.net,
      and firefox-settings-attachments.cdn.mozilla.net (confirmed by direct
      node parse of the JSON this session -- 9 allow hosts total, 3 of them
      Mozilla-owned). The two companion hosts were added in 03-02/03-03 as
      "structurally part of the Remote Settings feature D-83 already carves
      out" (content-signature verification, CRLite attachment CDN) -- a
      reasoned engineering call, and a real (non-control) 35-second capture
      in 03-03 confirms exactly these three hosts are what the built browser
      actually resolves, nothing else. But 03-CONTEXT.md's D-83 decision text
      names only ONE host, and neither ROADMAP.md's 2026-08-21 amendment note
      nor REQUIREMENTS.md's BRAND-04 entry was updated to reflect a
      multi-host Mozilla carve-out the way the other three criteria were
      explicitly amended that same day. As literally worded, the roadmap
      criterion is not met.
    artifacts:
      - path: "sourcerer/endpoint-allowlist.json"
        issue: "3 allow-dispositioned Mozilla hosts (content-signature-2.cdn.mozilla.net, firefox-settings-attachments.cdn.mozilla.net beyond the named firefox.settings.services.mozilla.com), not the 1 the roadmap criterion and REQUIREMENTS.md BRAND-04 both name"
    missing:
      - "Either amend ROADMAP.md's Success Criterion 4 and REQUIREMENTS.md's BRAND-04 text to name all three Remote-Settings-family hosts as the carve-out (matching the D-79/D-70 amendment precedent already set this same day), or accept an explicit override recording that these two companion hosts are in-scope for the same carve-out"
  - truth: "Each BRAND-04 check ships a positive control that must go red, and this remains true even if the verification run is interrupted (Success Criterion 4's stated purpose: the control is what distinguishes correctly-absent from never-ran)"
    status: partial
    reason: >
      CR-02 from 03-REVIEW.md, independently reproduced by reading
      scripts/verify-endpoints.sh: run_layer1_control (line 190-206) and
      run_layer3_impl's control path (line 313-364) both back up and mutate
      the REAL, INSTALLED $BIN_DIR/browser/defaults/preferences/firefox-branding.js
      -- not a scratch copy -- via a bare local `backup` variable, never
      registered with track_temp() or the script's own
      `trap cleanup EXIT` / `trap 'cleanup; exit 130' INT TERM` (lines 104-117),
      which restore only ACTIVE_PID and TEMP_PATHS. Layer 3's control runs a
      real backgrounded `sourcerer` process for a fixed 35-second sleep (line
      341) with the mutated pref file already written; a SIGINT during that
      window fires the INT/TERM trap, which kills the process and exits via
      `cleanup; exit 130` WITHOUT ever reaching line 362's restore -- leaving
      the real objdir binary's OpenH264 unattended-download path (and, in
      layer 1's case, the stock GMP-manager URL) silently re-enabled until
      the next full ./mach build.
      Confirmed this session that the CURRENT repo state is clean (grep of
      both objdir/dist/bin/.../firefox-branding.js and
      objdir-release/dist/bin/.../firefox-branding.js shows
      media.gmp-manager.url="" and media.gmp-gmpopenh264.enabled=false in
      both) -- no interrupt has actually corrupted the shipped state as of
      this verification. This is a latent robustness gap in the verification
      tooling's positive-control paths, not a currently-failed observable
      fact about the built browser's endpoint lockdown.
    artifacts:
      - path: "scripts/verify-endpoints.sh"
        issue: "run_layer1_control and run_layer3_impl's pref-file backup/restore is not registered with the script's own trap-covered cleanup mechanism"
    missing:
      - "Register the pref-file backup path (e.g. PREF_BACKUP_SRC/PREF_BACKUP_DST globals) with cleanup(), mirroring how ACTIVE_PID and TEMP_PATHS are already trap-covered, so a SIGINT/TERM during either control restores the real pref file before the process exits"
human_verification:
  - test: "Launch both branding variants (objdir/dist/bin/sourcerer and objdir-release/dist/bin/sourcerer) on a real desktop session and read the window title bar / taskbar icon directly"
    expected: "Dev shows 'Sourcerer Dev' in the title, release shows 'Sourcerer'; the two icon sets (badged vs unbadged) are visually distinguishable at a glance without opening about:support"
    why_human: "WebDriver BiDi's browsingContext.getTree returns content contexts only (never the chrome window's title), and xprop/xdotool/wmctrl are absent from this headless host -- confirmed absent per 03-06-SUMMARY.md's own Manual-Only table. 'Distinguishable at a glance' is inherently a human perceptual judgment; the byte-level/string-level difference is already machine-proven (MOZ_APP_DISPLAYNAME differs per config.status, and all five icon PNGs are byte-different per variant -- both re-confirmed independently this session)."
  - test: "Review sourcerer/branding/{dev,release} file-by-file against upstream/browser/branding/unofficial/ for any unrecognised Mozilla trademark asset"
    expected: "Every carried-forward file is neutral scaffolding (moz.build, configure.sh boilerplate) rather than a Mozilla mark"
    why_human: "The automated check (find for .icns/.ico/Assets.car/*.VisualElementsManifest.xml) is a filename-based regression guard against KNOWN trademark-asset shapes; confirming no unrecognised asset was carried forward needs a human reading the file list once, per 03-06-SUMMARY.md's own stated boundary. Not yet performed by any plan in this phase."
---

# Phase 3: Branded Firefox Fork Verification Report

**Phase Goal:** A Sourcerer-identity Firefox-ESR fork that rebuilds in minutes, carries no Mozilla trademark asset or endpoint, and can be rebased onto a new ESR tag by a documented procedure.
**Verified:** 2026-08-22T01:57:19Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Advisory Code Review Cross-Check

`03-REVIEW.md` (committed just before this verification) reported two
Critical findings. Both were independently reproduced against the source and
by direct execution in this session, not taken on the review's word:

- **CR-01** (`verify-branding-identity.mjs`'s brand-full-name surface never
  reads the release variant's own `brand.ftl`) — **CONFIRMED**. Reproduced by
  running the exact `verify-branding-identity-release` invocation
  `scripts/verify-phase-03.sh` uses; it printed
  `PASS brand-full-name -- dev variant -brand-full-name="Sourcerer Dev"`
  while pointed at the release binary/desktop/config.status. Direct file read
  confirms `sourcerer/branding/release/locales/en-US/brand.ftl:8` really says
  `-brand-full-name = Sourcerer`, but no code path in the checker ever reads
  that file. See Gap 1 below.
- **CR-02** (positive controls mutate the real installed pref file with no
  interrupt-safe restore) — **CONFIRMED** by reading `scripts/verify-endpoints.sh`
  directly: the `backup` variable in both `run_layer1_control` and
  `run_layer3_impl` is never registered with `track_temp()` or the script's
  own `trap cleanup EXIT` / `trap 'cleanup; exit 130' INT TERM`. Current
  on-disk state was checked and is clean (see Gap 3 below) — no interrupt has
  actually happened yet — but the gap is real and unfixed. See Gap 3 below.

Neither finding was accepted from the aggregator's green line; both were
independently re-derived by executing the actual checks and reading the
actual source this session.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria, verbatim from ROADMAP.md, amended 2026-08-21)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Six identity surfaces each report Sourcerer, verified by command (both variants) | ⚠️ PARTIAL | 5/6 surfaces genuinely command-verified for both dev and release, re-run independently this session. Surface 4 (brand-full-name) is command-verified for dev only; the release invocation is vacuous (CR-01, confirmed). The underlying release value is correct by direct file read, but not by the documented command. |
| 2 | Repo laid out as `upstream/`+`patches/`+`sourcerer/`; documented rebase replays patch stack onto a new ESR tag, failing loudly on conflict | ✓ VERIFIED | Structure confirmed (`patches/010-sourcerer-identity.patch` is the sole patch; `upstream/sourcerer` symlink resolves). `bash scripts/apply-patches.sh --self-test` re-run this session: first apply succeeds, second apply on the same tree is correctly rejected by name (D-75's non-vacuous assertion). `scripts/rebase-upstream.sh --tag ... --dry-run` re-run this session, echoes the requested tag on every path. `.github/workflows/rebase-upstream.yml` is registered on `origin/master` (`gh api .../actions/workflows` returns 2 workflows including "Rebase upstream") and a real `workflow_dispatch` run (32543353637) completed with `conclusion: success` in ~4min — independently confirmed via `gh run list` this session. |
| 3 | `check-patch-surface.sh` positive control + tiered-loop timings re-measured on this host, recorded in `docs/BUILD.md` with date/command | ✓ VERIFIED | `bash scripts/check-patch-surface.sh --self-test` re-run this session: planted compiled-file patch correctly rejected. `docs/BUILD.md` lines 189-297 name concrete example file paths per tier, state the full-build fallthrough explicitly, and every timing (1.05s / 1.84s warm / 2368s+2822s) carries its exact command and a `2026-08-2{1,2}, legion` measurement date — none inherited from research. |
| 4 | Never touches `~/.mozilla/firefox` (exact-path strace); network capture contacts no host outside a documented allowlist whose only Mozilla entry is `firefox.settings.services.mozilla.com`; every check ships a positive control that goes red | ⚠️ PARTIAL | strace exact-path layer and all three positive controls re-run this session (`bash scripts/verify-phase-03.sh`, full run, 8/8 PASS) and genuinely discriminate. But (a) the allowlist actually ships 3 Mozilla-domain `allow` hosts, not the 1 the criterion names verbatim (Gap 2), and (b) the layer-1/layer-3 positive controls mutate the real installed pref file with no interrupt-safe restore (Gap 3, CR-02 confirmed) — current on-disk state is clean, but the tool is not proven safe against a SIGINT mid-control. |
| 5 | Dev build distinguishable at a glance from a future release; shipped `branding/` tree has no Mozilla trademark asset | ✓ VERIFIED (machine-checkable parts); human judgment outstanding | `MOZ_APP_DISPLAYNAME` differs per variant's own `config.status` (`Sourcerer Dev` vs `Sourcerer`, re-confirmed this session via direct grep); all five icon PNGs are byte-different per variant (re-confirmed via `cmp` this session, all 5 sizes DIFFERENT); `find sourcerer/branding -iname '*.icns' -o -iname '*.ico' -o -iname Assets.car -o -iname '*.VisualElementsManifest.xml'` returns empty (re-run this session). The "at a glance" perceptual judgment and the file-by-file unrecognised-trademark-asset review remain human-only items (see Human Verification). |

**Score:** 3/5 truths fully verified, 2/5 partial (each with a majority of substance verified and a specific, named gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `patches/010-sourcerer-identity.patch` | Sole Gecko patch, one hunk | ✓ VERIFIED | Confirmed sole file in `patches/`; `check-patch-surface.sh` confirms no compiled-file target |
| `scripts/apply-patches.sh` | Idempotent, non-vacuous per-patch assertion | ✓ VERIFIED | `--self-test` re-run, correctly rejects an already-applied patch |
| `scripts/check-patch-surface.sh` | Compiled-file boundary guard | ✓ VERIFIED | `--self-test` re-run, planted `.cpp` patch rejected |
| `scripts/fetch-upstream.sh` | D-76 clean-tree classifier, settable `TAG` | ✓ VERIFIED | `bash scripts/fetch-upstream.sh` exits 0 against the current tree (registered in aggregator as `fetch-upstream-self-test`, PASS this session) |
| `scripts/rebase-upstream.sh` | Composes fetch/apply/check, remote tag-existence check, overlay-resolves assertion | ✓ VERIFIED | Dry-run re-executed this session against the pinned tag, echoes tag correctly |
| `.github/workflows/rebase-upstream.yml` | `workflow_dispatch`-only, no schedule/continue-on-error | ✓ VERIFIED | Grepped this session: only a `# Deliberately no schedule:` comment, no live `schedule:`/`continue-on-error`/`\|\| true` key. Registered on `origin/master` and successfully dispatched (run 32543353637). |
| `scripts/verify-branding-identity.mjs` | Six-surface identity checklist, variant-aware | ⚠️ PARTIAL | Surfaces 1,2,3,5,6 are genuinely variant-aware (re-confirmed via `--bin`/`--desktop`/`--config-status` against the release build). Surface 4 (`brand-full-name`) is NOT variant-aware — hardcoded to the dev tree (CR-01, Gap 1). |
| `sourcerer/endpoint-allowlist.json` | hosts[]/prefs[] schema, single Mozilla carve-out | ⚠️ PARTIAL | Schema valid (21 hosts, 25 prefs, re-parsed this session); 3 hosts are Mozilla-domain `allow` entries, not 1 (Gap 2) |
| `scripts/verify-endpoints.sh` | Three-layer endpoint/profile prover, interrupt-safe | ⚠️ PARTIAL | All three layers genuinely discriminate (re-run this session). Layer-1/layer-3 positive controls are not interrupt-safe (CR-02, Gap 3) |
| `sourcerer/branding/dev/`, `sourcerer/branding/release/` | Full Sourcerer branding trees, no trademark assets | ✓ VERIFIED | Both trees present, content-complete, differ in exactly `-brand-full-name` and icon set (re-confirmed via direct file read and `cmp`) |
| `sourcerer/sourcerer.desktop`, `sourcerer/sourcerer-release.desktop` | Per-variant `.desktop` entries | ✓ VERIFIED | Both exist; `verify-branding-identity.mjs`'s desktop-entry surface passes for both against their own `config.status` |
| `docs/BUILD.md` | Tier timings, compiled-file boundary, allowlist, rebase/install procedures, all re-measured with date | ✓ VERIFIED | Re-read this session; all timings dated, commanded, and distinct from research figures |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `upstream/sourcerer` symlink | `sourcerer/branding/{dev,release}` | `readlink -f` resolution | ✓ WIRED | Re-confirmed this session: resolves to the repo's `sourcerer/` directory |
| `scripts/verify-phase-03.sh` | `verify-branding-identity.mjs` (release invocation) | `--bin`/`--desktop`/`--config-status` flags | ⚠️ PARTIAL | 5 of 6 surfaces genuinely reflect the release target; surface 4 does not (CR-01) |
| `scripts/verify-endpoints.sh` cleanup | pref-file backup/restore | `trap cleanup EXIT` / `INT TERM` | ✗ NOT WIRED | Backup variable never registered with `track_temp()` or the trap handlers (CR-02) |
| `.github/workflows/rebase-upstream.yml` | `scripts/rebase-upstream.sh` | `env: REBASE_TAG` → `"$REBASE_TAG"` | ✓ WIRED | Confirmed by a real successful dispatch (run 32543353637) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Release-variant identity check is vacuous on surface 4 | `node scripts/verify-branding-identity.mjs --bin objdir-release/dist/bin/sourcerer --desktop sourcerer/sourcerer-release.desktop --config-status objdir-release/config.status` | `PASS brand-full-name -- dev variant -brand-full-name="Sourcerer Dev" (expected "Sourcerer Dev")` | ✗ FAIL (confirms CR-01) |
| Full phase aggregator | `bash scripts/verify-phase-03.sh` | `8/8 PASS`, exit 0 | ✓ PASS (as designed; does not detect CR-01/CR-02, consistent with the review's point that these checks are green while measuring the wrong thing / not measuring interrupt-safety) |
| `check-patch-surface.sh` self-test | `bash scripts/check-patch-surface.sh --self-test` | PASS | ✓ PASS |
| `apply-patches.sh` self-test | `bash scripts/apply-patches.sh --self-test` | Both sub-checks PASS | ✓ PASS |
| Rebase dry-run | `bash scripts/rebase-upstream.sh --tag FIREFOX_153_1_0esr_RELEASE --dry-run` | Echoes tag, `upstream/` untouched | ✓ PASS |
| Real CI dispatch | `gh run list --workflow=rebase-upstream.yml` | `completed / success`, run 32543353637 | ✓ PASS |
| Current pref-file state (checking for CR-02 residue) | `grep gmp-manager.url\|gmp-gmpopenh264.enabled` on both objdirs' installed pref files | `media.gmp-manager.url=""`, `media.gmp-gmpopenh264.enabled=false` in both | ✓ PASS (no current corruption, though the gap remains unfixed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| BUILD-03 | 03-01, 03-04, 03-06 | Fork structured `upstream/`+`patches/`+`sourcerer/`, documented CI-ready rebase | ✓ SATISFIED | Structure + self-tests + real successful CI dispatch, all re-confirmed this session |
| BUILD-04 | 03-01, 03-06 | Tiered incremental rebuild loop, compiled-file boundary guard | ✓ SATISFIED | `check-patch-surface.sh` self-test + `docs/BUILD.md`'s re-measured, dated timings |
| BRAND-01 | 03-02, 03-05 | Six-surface identity checklist | ⚠️ PARTIAL | 5/6 surfaces genuinely variant-aware and correct for both variants; surface 4 not variant-aware in the checker (values are correct by direct inspection, not by the documented command) — Gap 1 |
| BRAND-02 | 03-01, 03-05 | Full replacement `branding/` tree, no Mozilla trademark assets | ✓ SATISFIED | Filename-based guard re-run, empty; human file-by-file review still outstanding (Manual-Only, unchanged from 03-VALIDATION.md) |
| BRAND-03 | 03-02, 03-03 | Profile isolation from real `~/.mozilla/firefox` | ✓ SATISFIED | Exact-path strace layer re-run this session, PASS; positive control also PASS, though not interrupt-safe (Gap 3, does not affect the current PASS verdict) |
| BRAND-04 | 03-02, 03-03 | Auto-update disabled, allowlisted endpoints only | ⚠️ PARTIAL | Layers 1-3 all PASS and genuinely discriminate; the allowlist's Mozilla-host count (3, not 1) conflicts with the roadmap/REQUIREMENTS wording (Gap 2), and positive-control interrupt-safety is unproven (Gap 3) |
| BRAND-06 | 03-05 | Dev builds visibly distinguishable from release | ✓ SATISFIED (machine-checkable parts) | Display-name and icon-set differences re-confirmed independently; the specific "brand.ftl proves it reads a real per-variant source" claim is false as implemented (downstream effect of Gap 1) — the underlying distinguishability still holds via the other two signals |

No orphaned requirements: all 7 IDs (`BUILD-03`, `BUILD-04`, `BRAND-01`, `BRAND-02`, `BRAND-03`, `BRAND-04`, `BRAND-06`) mapped to Phase 3 in `REQUIREMENTS.md` are claimed by at least one of the phase's six plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/verify-branding-identity.mjs` | 141, 271-280 | Hardcoded path/constant where every sibling surface is variant-parameterised | 🛑 Blocker (already tracked as Gap 1) | Vacuous check for the release variant's identity surface 4 |
| `scripts/verify-endpoints.sh` | 190-206, 313-364 | Mutating real installed state with a cleanup path outside the script's own trap mechanism | ⚠️ Warning (tracked as Gap 3) | Latent risk of leaving OpenH264/GMP endpoints re-enabled on the real binary if interrupted mid-control |
| `scripts/verify-branding-identity.mjs` | 183-188 | `.find()` selects on trimmed line, regex matches untrimmed line (WR-01 from `03-REVIEW.md`) | ℹ️ Info | Latent fragility, not currently triggered (both `brand.ftl` files have zero leading whitespace) |
| `scripts/verify-phase-03.sh` | 180 | `eval "$cmd"` for a statically-known function name (WR-02) | ℹ️ Info | Not currently exploitable (no external input reaches `$cmd`), but wrong tool for the job |
| `scripts/verify-endpoints.sh` | 260-261 | `home_count`/`exact_count` not declared `local` (IN-02) | ℹ️ Info | Harmless today (function runs once per invocation) |
| `.github/workflows/rebase-upstream.yml` | 35 | `actions/checkout@v4` pinned by tag not SHA (IN-03) | ℹ️ Info | Standard supply-chain hardening item, low practical risk given `workflow_dispatch`'s write-access requirement |
| No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers found | — | — | — | Grepped every phase-modified script/doc/JSON this session; clean |

### Human Verification Required

See frontmatter `human_verification`. Two items outstanding, both already
flagged as Manual-Only by the phase's own `03-VALIDATION.md`/`03-06-SUMMARY.md`
and unchanged by this verification: (1) the actual visual "at a glance"
distinguishability of the two variants' window title and icon on a real
desktop session, and (2) a human file-by-file review of the branding trees
for any unrecognised (non-filename-pattern) Mozilla trademark asset.

### Gaps Summary

Three gaps, all traceable to the advisory code review's two Critical findings
plus one independently-discovered wording discrepancy:

1. **`verify-branding-identity.mjs`'s brand-full-name surface is not
   variant-aware** (CR-01, confirmed by direct execution). The release
   build's actual identity is correct (`sourcerer/branding/release/locales/en-US/brand.ftl`
   really says `Sourcerer`), but the machine-checked proof of that — the
   thing Success Criterion 1 requires ("verified by command") — does not
   exist for this one surface on the release variant. Fix is small and
   scoped: add a `--brand-ftl` override, thread it through
   `verify-phase-03.sh`'s release invocation, and correct
   `03-05-SUMMARY.md`'s now-false claim.
2. **The endpoint allowlist's "only Mozilla entry" clause is violated by
   design, not by accident** — three Mozilla-domain hosts are
   allow-dispositioned, all under a reasoned but never-formally-amended
   extension of D-83's stated single-host carve-out. This looks intentional
   and well-documented per-host; the fix is either a roadmap/REQUIREMENTS
   wording amendment (matching the precedent already set this same day for
   three other criteria) or an explicit override.
3. **CR-02's interrupt-unsafe positive controls** — a real, confirmed
   robustness gap in `verify-endpoints.sh`, not currently manifesting (the
   repo's actual installed state is clean) but unfixed. Low urgency given
   current state, but load-bearing the next time someone interrupts a
   layer-3 positive control mid-sleep.

None of the three gaps involve a Firefox internal patch, a missing artifact,
or a broken build — the fork itself is real, launchable, correctly branded on
both variants (confirmed independently across 5 of 6 surfaces plus direct
file inspection for the 6th), and the rebase mechanism is proven end-to-end
including a real, successful off-machine CI dispatch. All three gaps are in
the verification tooling's precision/robustness or in a documentation/roadmap
wording mismatch — exactly the class of finding this phase's own stated
philosophy exists to surface, not obscure.

---

_Verified: 2026-08-22T01:57:19Z_
_Verifier: Claude (gsd-verifier)_
