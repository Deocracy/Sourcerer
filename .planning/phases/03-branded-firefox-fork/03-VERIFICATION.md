---
phase: 03-branded-firefox-fork
verified: 2026-08-22T19:15:00Z
status: passed
score: 5/5 roadmap success criteria verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5 roadmap success criteria verified, 1/5 FAILED
  gaps_closed:
    - "Success Criterion 5 / BRAND-06: dev `brand.properties` `brandFullName` was byte-identical to release's, contradicting `brand.ftl`'s per-variant divergence. Gap-closure plan 03-11 suffixed the dev value to `Sourcerer Dev` (release stays `Sourcerer`, byte-unchanged, confirmed by `git diff --stat` over the plan's commit range). Independently re-confirmed this session: `diff` of the two `brand.properties` files now reports exactly one changed line."
    - "Success Criterion 5 / BRAND-06: neither variant painted a window title bar on this desktop (both drew client-side decorations), so no divergence was ever visible regardless of the string fix. 03-11 added a dev-only `browser.tabs.inTitlebar=0` default (release carries no such default, confirmed absent by grep), giving the dev window a real title bar reading the suffixed brand name while release remains undecorated."
    - "The regression was previously invisible to the automated suite (03-REVIEW.md WR-01: nothing read `brand.properties`). 03-11 extended `verify-branding-identity.mjs`'s `brand-full-name` surface to read both `brand.ftl` and `brand.properties` per variant, and added a `branding-variant-divergence` check (+ self-test) to `verify-phase-03.sh`'s base CHECKS array. Independently re-run this session: `bash scripts/verify-phase-03.sh` exits 0 with 14/14 checks PASS, including `branding-variant-divergence: PASS` and `branding-variant-divergence-self-test: PASS`."
    - "Human re-verification of Item A (BRAND-06) was performed 2026-08-22 on a real desktop session with both variants launched side by side and recorded PASS in `03-MANUAL-VERIFICATION.md`'s 'Item A — re-verification after 03-11 gap closure' section: dev window title read literally 'Sourcerer Dev' with a real title bar painted; release painted no title bar; observer's verbatim verdict 'Looks like a PASS.' `REQUIREMENTS.md` BRAND-06 flipped from Gap back to Complete the same day, citing this re-verification."
  gaps_remaining: []
  regressions: []
---

# Phase 3: Branded Firefox Fork Verification Report

**Phase Goal:** A Sourcerer-identity Firefox-ESR fork that rebuilds in minutes, carries no Mozilla trademark asset or endpoint, and can be rebased onto a new ESR tag by a documented procedure.
**Verified:** 2026-08-22T20:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (this run re-verifies against the prior `03-VERIFICATION.md`, which recorded 4/5 criteria verified and Success Criterion 5 / BRAND-06 FAILED at human verification)

## Summary

Gap-closure plan 03-11 closed the single remaining Phase 3 gap (Success
Criterion 5 / BRAND-06, human-verified FAILED on 2026-08-22 by plan 03-10).
Two root causes were diagnosed and both were fixed in the actual codebase,
not just narrated in a SUMMARY:

1. `sourcerer/branding/dev/locales/en-US/brand.properties` was byte-identical
   to `sourcerer/branding/release/locales/en-US/brand.properties`, silently
   contradicting `brand.ftl`'s correct per-variant divergence. Independently
   re-confirmed this session: `diff` of the two files now shows exactly one
   changed line (`brandFullName=Sourcerer Dev` vs `brandFullName=Sourcerer`).
2. Neither variant painted a window title bar at all on this desktop
   (client-side decorations on both), so no string divergence could ever be
   perceived. A dev-only `browser.tabs.inTitlebar=0` default was added
   (confirmed present via `grep` in the dev pref file, confirmed absent in
   the release pref file), giving the dev window a real title bar.

The regression that let this ship silently the first time — no automated
surface read `brand.properties` — was itself closed: `verify-branding-identity.mjs`'s
`brand-full-name` surface now reads both `brand.ftl` and `brand.properties`
per variant (confirmed by this session's live run of the script), and a new
`branding-variant-divergence` check plus a both-directions self-test were
registered in `verify-phase-03.sh`'s base CHECKS array.

This verification independently re-ran `bash scripts/verify-phase-03.sh` in
its own process (not trusting the SUMMARY's claimed output) and observed
exit code 0 with all 14 checks reporting PASS, matching the plan's claimed
12+2 arithmetic exactly. The human re-verification of Item A is durably
recorded in `03-MANUAL-VERIFICATION.md` with literal observations (dev title
"Sourcerer Dev", release painted no title bar), a PASS verdict, the date,
and the observer — with the original 2026-08-22 FAILED record left intact
above it as history, per the plan's own explicit non-negotiable requirement.
`REQUIREMENTS.md` and `STATE.md` were both updated consistently: BRAND-06 is
`[x]` Complete, and the Phase 3 Blockers/Concerns entry for this gap is
removed.

All prohibitions the gap-closure plan committed to were independently
verified as honored: `git diff --stat` over the plan's full commit range
shows zero changes under `upstream/`, `patches/`, or
`sourcerer/branding/release/` — no Gecko file, no patch, and no release
branding asset was touched.

**All 5 roadmap Success Criteria are now verified. Phase goal achieved.**

## Goal Achievement

### Observable Truths (Roadmap Success Criteria, verbatim from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Six identity surfaces each report Sourcerer, verified by command (both variants) | ✓ VERIFIED | Unchanged from prior verification (already fully verified pre-03-11). Re-confirmed this session: live `verify-phase-03.sh` run shows `verify-branding-identity-dev: PASS` and `verify-branding-identity-release: PASS`, both reporting "all six surfaces correct", plus `verify-branding-identity-brand-ftl-control: PASS`. |
| 2 | Repo laid out as `upstream/`+`patches/`+`sourcerer/`; documented rebase replays patch stack onto a new ESR tag, failing loudly on conflict | ✓ VERIFIED | Unchanged from prior verification. Not touched by 03-11 (its own `git diff --stat upstream/ patches/` is empty, independently confirmed this session). |
| 3 | `check-patch-surface.sh` positive control + tiered-loop timings re-measured, recorded in `docs/BUILD.md` with date/command | ✓ VERIFIED | Unchanged from prior verification. Re-confirmed this session: live run shows `check-patch-surface: PASS` and `check-patch-surface-self-test: PASS`. |
| 4 | Never touches `~/.mozilla/firefox`; network capture contacts no host outside the documented allowlist whose Mozilla entries are the three named Remote Settings hosts; every check ships a positive control that goes red | ✓ VERIFIED | Unchanged from prior verification. Re-confirmed this session: live run shows `verify-endpoints: PASS` (layer 2 "zero touches to $HOME/.mozilla/firefox", layer 3 "all resolved hosts are allowlisted") and `verify-endpoints-interrupt-self-test: PASS`. |
| 5 | A dev build is distinguishable at a glance from a future packaged release; shipped `branding/` tree has no Mozilla trademark asset | ✓ VERIFIED | **Both halves now PASS.** Trademark half: unchanged, Item B PASSED (15/15 files, 0 Mozilla marks, `03-MANUAL-VERIFICATION.md`). Distinguishability half: previously FAILED, now closed by 03-11 and independently re-verified this session — (a) `diff` of the two `brand.properties` files shows exactly one changed line, dev reads `Sourcerer Dev`; (b) `grep inTitlebar` shows the dev pref file sets `browser.tabs.inTitlebar` to 0 and the release pref file has no such line; (c) live `verify-phase-03.sh` run shows `branding-variant-divergence: PASS` and its self-test PASS; (d) human re-verification recorded PASS in `03-MANUAL-VERIFICATION.md`'s new "Item A — re-verification after 03-11 gap closure" section with literal title-bar observations, date, and observer. |

**Score:** 5/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/verify-branding-identity.mjs` | Six-surface identity checklist, variant-aware, brand-full-name surface reads both `brand.ftl` and `brand.properties` | ✓ VERIFIED | Live run confirms `brand-full-name` PASS lines report both file paths and both values for dev and release; `readBrandPropertiesFullName` and `BRAND_PROPERTIES_PATH` present per plan. |
| `sourcerer/endpoint-allowlist.json` | hosts[]/prefs[] schema, documented Mozilla carve-out | ✓ VERIFIED | Unchanged from prior verification; `allowlist-schema: PASS` in live run. |
| `scripts/verify-endpoints.sh` | Three-layer endpoint/profile prover, interrupt-safe | ✓ VERIFIED | Unchanged from prior verification; live run confirms interrupt self-test PASS. |
| `scripts/verify-phase-03.sh` | Aggregator including `branding-variant-divergence` + self-test in base CHECKS array | ✓ VERIFIED | Independently re-run this session: exit 0, 14/14 checks PASS, both new checks present and PASS. |
| `sourcerer/branding/dev/`, `sourcerer/branding/release/` | Full Sourcerer branding trees, no trademark assets, distinguishable per variant | ✓ VERIFIED | Trademark-free (Item B PASSED, unchanged). Now genuinely distinguishable: `brand.properties` diverges (dev `Sourcerer Dev` / release `Sourcerer`), `firefox-branding.js` diverges (dev sets `browser.tabs.inTitlebar=0`, release does not). Release tree confirmed byte-unchanged by this session's `git diff --stat` over the plan's commit range. |
| `docs/BUILD.md` | Section describing the dev-vs-release indicator and the check that gates it | ✓ VERIFIED | `## Telling a dev build from a release build (BRAND-06)` section present, positioned between the endpoints section and the rebase/desktop-install section, matches the plan's required content (three divergence points, icon-badge deliberate-skip note, no-rebuild note). |
| `03-MANUAL-VERIFICATION.md` | Durable record of both human-verification items, plus Item A re-verification | ✓ VERIFIED | Original Item A FAILED section intact (git history preserved as required); new "Item A — re-verification after 03-11 gap closure" section present with filled outcome block (literal titles, PASS verdict, date, observer); Item B PASSED section unchanged. Frontmatter `status: item-a-failed-then-passed-on-reverification-item-b-passed`. |
| `.planning/REQUIREMENTS.md` | BRAND-06 marked Complete with re-verification annotation | ✓ VERIFIED | Line 24: `[x] **BRAND-06**` with "human-verified PASS 2026-08-22 on re-verification" annotation naming the 03-11 mechanism; status table row `BRAND-06 \| Phase 3 \| Complete`; footer records the Gap→Complete flip. |
| `.planning/STATE.md` | Phase 3 BRAND-06 blocker removed | ✓ VERIFIED | Blockers/Concerns section no longer lists a BRAND-06 entry; only unrelated Phase 1/4 items remain. Changelog records the 03-11 gap closure. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `sourcerer/branding/dev/locales/en-US/brand.properties` | `objdir/dist/bin/browser/chrome/en-US/locale/branding/brand.properties` | symlink (D-70 tier 1) | ✓ WIRED | `readlink -f` on the installed path resolves inside `sourcerer/branding/dev/`, confirmed this session — the source edit reaches the built/running tree with no rebuild. |
| `sourcerer/branding/dev/pref/firefox-branding.js` | `objdir/dist/bin/browser/defaults/preferences/firefox-branding.js` | symlink (D-70 tier 1) | ✓ WIRED | Same `readlink -f` confirmation; the titlebar pref default reaches the built tree. |
| `scripts/verify-phase-03.sh` CHECKS array | `check_branding_variant_divergence` / `_self_test` | bare function-name dispatch | ✓ WIRED | Both appear in the live run's summary table, both PASS; not orphaned entries — they execute and produce real evidence lines naming both properties values and the resolved titlebar pref. |
| `scripts/verify-branding-identity.mjs` `VARIANTS` descriptor | `brand.properties` per variant | `brandProperties` path + `--brand-properties` override | ✓ WIRED | Live run's `brand-full-name` PASS line for both dev and release names the properties path and value alongside the `brand.ftl` path and value — genuinely reading both files, not one. |
| `03-11-PLAN.md` prohibitions | actual commit diff | `git diff --stat` over the plan's commit range | ✓ HELD | Independently confirmed this session: zero changes under `upstream/`, `patches/`, `sourcerer/branding/release/` across commits `5cd7293..51993b9`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase aggregator exits 0 with 14 checks | `bash scripts/verify-phase-03.sh` (run in this verifier's own process, not a re-quote of the SUMMARY) | Exit 0; summary lists 14 checks, all PASS, including `branding-variant-divergence: PASS` and `branding-variant-divergence-self-test: PASS` | ✓ PASS |
| `brand.properties` divergence is real, not just claimed | `diff sourcerer/branding/{dev,release}/locales/en-US/brand.properties` | Exactly one changed line: `brandFullName=Sourcerer Dev` (dev) vs `brandFullName=Sourcerer` (release) | ✓ PASS |
| Titlebar pref divergence is real | `grep inTitlebar sourcerer/branding/{dev,release}/pref/firefox-branding.js` | Dev: `pref("browser.tabs.inTitlebar", 0);` present. Release: no match. | ✓ PASS |
| No debt markers in phase-modified files | `grep -n "TBD\|FIXME\|XXX"` across `verify-phase-03.sh`, `verify-branding-identity.mjs`, dev pref/properties files, `docs/BUILD.md` | No matches | ✓ PASS |
| Claimed commits exist | `git log --oneline --all \| grep -E "5cd7293\|6590b1d\|34d2174\|51993b9"` | All four commits present | ✓ PASS |
| Prohibitions held (no Gecko/patch/release-branding edits) | `git diff --stat 5cd7293^ 51993b9 -- upstream/ patches/ sourcerer/branding/release/` | Empty output | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| BUILD-03 | 03-01, 03-04, 03-06, 03-08 | Fork structured `upstream/`+`patches/`+`sourcerer/`, documented CI-ready rebase | ✓ SATISFIED | Unchanged from prior verification. |
| BUILD-04 | 03-01, 03-06 | Tiered incremental rebuild loop, compiled-file boundary guard | ✓ SATISFIED | Unchanged from prior verification. |
| BRAND-01 | 03-02, 03-05, 03-07, 03-11 | Six-surface identity checklist | ✓ SATISFIED | 03-11 extended the brand-full-name surface to also read `brand.properties`, strengthening this requirement's coverage; live run confirms both dev and release PASS. |
| BRAND-02 | 03-01, 03-05, 03-10 | Full replacement `branding/` tree, no Mozilla trademark assets | ✓ SATISFIED | Item B human review PASSED (15/15 files, 0 marks), unchanged. |
| BRAND-03 | 03-02, 03-03, 03-08 | Profile isolation from real `~/.mozilla/firefox` | ✓ SATISFIED | Unchanged from prior verification. |
| BRAND-04 | 03-02, 03-03, 03-08, 03-09 | Auto-update disabled, allowlisted endpoints only | ✓ SATISFIED | Unchanged from prior verification. |
| BRAND-06 | 03-05, 03-07, 03-10, 03-11 | Dev builds visibly distinguishable from release | ✓ SATISFIED | Gap closed. Human re-verification PASS 2026-08-22, `REQUIREMENTS.md` reflects Complete, root-cause fix independently confirmed in the codebase this session. |

No orphaned requirements: all 7 IDs (`BUILD-03`, `BUILD-04`, `BRAND-01`, `BRAND-02`, `BRAND-03`, `BRAND-04`, `BRAND-06`) mapped to Phase 3 in `REQUIREMENTS.md` are claimed by at least one of the phase's eleven plans (`grep -n "^requirements:"` across all eleven `-PLAN.md` files confirms every ID appears at least once, including 03-11).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `sourcerer/branding/{dev,release}/content/aboutDialog.css` | — | Shipped file never mapped in `content/jar.mn`; unreachable at the `chrome://branding/content/aboutDialog.css` URI (03-REVIEW.md WR-02) | ⚠️ Warning, carried forward unfixed | Not required by any of the 5 roadmap success criteria; dead code / silently-broken About-dialog styling, does not block this phase's goal. 03-11 was scoped to BRAND-06 only and correctly did not touch this. |
| `sourcerer/distribution/policies.json` | — | No `moz.build` wiring; no automated build-time or verify-time proof it lands in a built objdir (03-REVIEW.md WR-03) | ⚠️ Warning, carried forward unfixed | Standing operational risk (a clobber+rebuild without the documented manual copy step would silently drop it), but does not currently fail any criterion — the strace/network layers independently prove equivalent lockdown via prefs. Out of 03-11's scope. |
| `scripts/lib/firefox-bidi.mjs` | 1-3 | Stale header comment (03-REVIEW.md IN-01) | ℹ️ Info, carried forward unfixed | Cosmetic only. |
| `.planning/ROADMAP.md` | 28 | Phase 3's top-level overview checkbox (`- [ ] **Phase 3: Branded Firefox Fork**`) is still unchecked even though all 5 success criteria and all 11 plans are now marked complete/`[x]` | ℹ️ Info | Cosmetic/bookkeeping inconsistency in the roadmap overview list, not a functional gap — the phase-level detail section, plans list, and requirements table are all internally consistent and correctly marked complete. Likely flipped by a later `/gsd` workflow step (e.g. ship/complete-milestone) rather than by a phase plan; does not affect goal achievement. |
| No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers found in phase-modified files (03-11 scope) | — | — | — | Confirmed clean by this session's direct grep. |

### Human Verification Required

None. Both previously-required human-verification items are durably recorded
with PASS verdicts:

- **Item B** (BRAND-02, trademark review): PASSED 2026-08-22, `03-MANUAL-VERIFICATION.md`.
- **Item A** (BRAND-06, dev-vs-release distinguishability): originally FAILED
  2026-08-22 (record left intact as history), then re-verified PASS the same
  day after gap-closure plan 03-11 fixed the root causes, recorded in
  `03-MANUAL-VERIFICATION.md`'s "Item A — re-verification after 03-11 gap
  closure" section with literal observations, the date, and the observer
  (Christopher Colantuono, verdict relayed with screenshot evidence of both
  windows side by side).

### Gaps Summary

No open gaps. The one gap carried over from the prior `03-VERIFICATION.md`
(Success Criterion 5 / BRAND-06, distinguishability half FAILED) is closed:
independently re-confirmed in this session via direct inspection of
`brand.properties` and `firefox-branding.js` (real, on-disk divergence, not
just a plan claim), an independently re-run `bash scripts/verify-phase-03.sh`
(exit 0, 14/14 checks PASS, run in this verifier's own process), and the
durable human re-verification record in `03-MANUAL-VERIFICATION.md`.
`REQUIREMENTS.md` and `STATE.md` are both internally consistent with this
outcome (BRAND-06 Complete, blocker removed).

Three low-severity items remain open from the prior code review
(03-REVIEW.md WR-02, WR-03, IN-01) — none of them map to any of the 5
roadmap success criteria or the 7 requirement IDs, and 03-11 correctly left
them untouched since they were out of its scope. They do not block phase
completion. A cosmetic inconsistency also remains in `ROADMAP.md`'s
top-level Phase 3 overview checkbox (still `[ ]` despite the phase's own
detail section, criteria, and plan list all being complete) — flagged for
whichever later workflow step owns that top-level list, not a phase-goal gap.

**Phase goal achieved: a Sourcerer-identity Firefox-ESR fork exists that
rebuilds in minutes (tiered loop, unchanged from prior verification), carries
no Mozilla trademark asset (Item B PASS) or endpoint (allowlist + interrupt-
safe positive controls, unchanged from prior verification) beyond the
documented three-host Remote Settings carve-out, can be rebased onto a new
ESR tag by a documented procedure (unchanged from prior verification), and is
now — following 03-11's gap closure — distinguishable at a glance between dev
and release builds, confirmed by both machine check and human re-verification.**

---

_Verified: 2026-08-22T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
