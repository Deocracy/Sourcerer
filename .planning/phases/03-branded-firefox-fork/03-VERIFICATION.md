---
phase: 03-branded-firefox-fork
verified: 2026-08-22T05:30:00Z
status: gaps_found
score: 4/5 roadmap success criteria verified, 1/5 FAILED
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5 (2 partial)
  gaps_closed:
    - "Gap 1 (CR-01): verify-branding-identity.mjs's brand-full-name surface is now variant-aware (VARIANTS descriptor, --variant/--brand-ftl override); verify-phase-03.sh runs a dedicated cross-variant positive control (verify-branding-identity-brand-ftl-control). Independently reproduced in 03-REVIEW.md's re-review and in the live 12/12 verify-phase-03.sh run recorded in 03-MANUAL-VERIFICATION.md, which shows release variant reading its own brand.ftl (`-brand-full-name=\"Sourcerer\"`) rather than the dev constant."
    - "Gap 2 (allowlist wording): ROADMAP.md Success Criterion 4, REQUIREMENTS.md BRAND-04, and 03-CONTEXT.md's D-83 were all amended 2026-08-22 to name the three-host Remote Settings carve-out. A new allowlist-doc-consistency check (plus its own self-test) is registered in verify-phase-03.sh and passes (3 Mozilla allow hosts, found in both ROADMAP.md and REQUIREMENTS.md). Independently spot-checked this session: sourcerer/endpoint-allowlist.json parses to 21 hosts."
    - "Gap 3 (CR-02): scripts/verify-endpoints.sh now has track_pref_backup/restore_pref_backup registered against the script's own trap cleanup() (EXIT and INT/TERM), plus a --interrupt-self-test that sends a real SIGINT into a live layer-3 control and asserts the pref file survives byte-identical. Confirmed fixed by 03-REVIEW.md's independent re-review and by the live run's `verify-endpoints-interrupt-self-test: PASS` line."
  gaps_remaining: []
  regressions:
    - "NEW gap surfaced by this phase's own human-verification step (03-10), not present in the prior VERIFICATION.md: Success Criterion 5 / BRAND-06 (dev vs release distinguishable at a glance) was human-tested on 2026-08-22 and recorded FAILED. This is not a regression in the sense of a previously-passing check breaking; it is the first time this specific truth was ever human-tested (it was Manual-Only/deferred in the prior verification), and the test came back negative. Root cause: sourcerer/branding/{dev,release}/locales/en-US/brand.properties are byte-identical (`brandFullName=Sourcerer` in both), contradicting brand.ftl's per-variant `-brand-full-name`; both variants also draw client-side window decorations so no WM title bar renders on this desktop; the icon badge (small orange corner dot) was not reliably perceptible. Independently re-confirmed this session: `diff` of the two brand.properties files is empty (byte-identical, both read `brandFullName=Sourcerer`)."
gaps:
  - truth: "A dev build is distinguishable at a glance from a future packaged release (title suffix or icon badge) — Success Criterion 5, BRAND-06"
    status: failed
    reason: >
      Human-verified FAILED on 2026-08-22 (03-MANUAL-VERIFICATION.md Item A,
      03-10-PLAN.md Task 2). Both variants were launched concurrently side by
      side on a real Wayland desktop session. No window title text rendered
      for either variant (client-side decorations draw tabs-in-titlebar, so
      the WM title bar that would carry MOZ_APP_DISPLAYNAME is never
      painted). The icon badge (an orange corner dot on the dev variant) was
      reported "inconclusive" by the observer, who could not confidently
      distinguish it from a rendering artifact. Observer's verbatim
      conclusion: "I dont really see a diffrece." Root cause independently
      re-confirmed this session: `sourcerer/branding/dev/locales/en-US/brand.properties`
      and `sourcerer/branding/release/locales/en-US/brand.properties` are
      byte-identical (`diff` returns empty, both files read
      `brandFullName=Sourcerer`), even though `brand.ftl` correctly diverges
      per variant (`-brand-full-name = Sourcerer Dev` vs `Sourcerer`). Any UI
      surface still reading the legacy `brand.properties` string bundle (it
      is packaged via `locales/jar.mn` in both trees, confirmed by
      03-REVIEW.md's WR-01) renders "Sourcerer" for both variants,
      identically. REQUIREMENTS.md's own BRAND-06 line and ROADMAP.md's
      Phase 3 tracking table already record this as reverted from Complete
      to Gap; STATE.md records it as an open blocker requiring a follow-up
      gap-closure plan. 03-10-SUMMARY.md itself closes with `status: halted`
      (not `complete`) for exactly this reason and states outright: "Phase
      3's human-verification gate is NOT satisfied."
    artifacts:
      - path: "sourcerer/branding/dev/locales/en-US/brand.properties"
        issue: "brandFullName=Sourcerer (unsuffixed) — should read 'Sourcerer Dev' to match brand.ftl and make the dev variant distinguishable wherever the legacy properties bundle is read instead of the Fluent term"
      - path: "sourcerer/branding/release/locales/en-US/brand.properties"
        issue: "byte-identical to the dev copy above — no per-variant divergence exists in this file at all"
      - path: "scripts/verify-branding-identity.mjs"
        issue: "brand-full-name surface (fixed for CR-01 to read brand.ftl per-variant) never reads brand.properties, so this exact defect is invisible to the automated 12/12 gate — a green run does not prove the two variants are visually distinguishable everywhere the requirement needs them to be (03-REVIEW.md WR-01)"
    missing:
      - "Make brand.properties per-variant (brandFullName=Sourcerer Dev in the dev tree), matching brand.ftl"
      - "Add a brand.properties-aware surface (or extend the existing brand-full-name surface) to verify-branding-identity.mjs so this regression is machine-caught in future, not just human-caught"
      - "Address the underlying 'no visible title bar at all' finding (client-side decorations on this desktop hide MOZ_APP_DISPLAYNAME regardless of the properties fix) and/or make the icon badge more perceptible, then re-run Item A per 03-10-SUMMARY.md's own stated next step"
human_verification: []
---

# Phase 3: Branded Firefox Fork Verification Report

**Phase Goal:** A Sourcerer-identity Firefox-ESR fork that rebuilds in minutes, carries no Mozilla trademark asset or endpoint, and can be rebased onto a new ESR tag by a documented procedure.
**Verified:** 2026-08-22T05:30:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (this run re-verifies against the prior 03-VERIFICATION.md, which recorded 3 gaps and 2 human-verification items)

## Summary

Gap-closure plans 03-07, 03-08, and 03-09 genuinely closed the three gaps
recorded in the prior verification (CR-01 variant-blindness, allowlist
wording mismatch, CR-02 interrupt-unsafe positive controls) — confirmed
independently in this session via 03-REVIEW.md's re-review, the live 12/12
`verify-phase-03.sh` output recorded in `03-MANUAL-VERIFICATION.md`, and two
direct spot-checks (`check-patch-surface.sh`, `endpoint-allowlist.json`
parse) run in this session. Plan 03-10 then performed both previously
Manual-Only human-verification items and recorded them durably. Item B
(BRAND-02 trademark review) PASSED. **Item A (BRAND-06, Success Criterion 5)
FAILED** — the two branding variants are not distinguishable at a glance on
a real desktop session, and the root cause (`brand.properties` byte-identical
between variants) was independently re-confirmed by direct `diff` in this
session.

This is not a case of the SUMMARY narrative overselling completion: the
phase's own artifacts already say the same thing. `REQUIREMENTS.md` marks
BRAND-06 as an open `[ ]` Gap with an explicit "human-verified FAILED
2026-08-22" annotation. `ROADMAP.md`'s Phase 3 tracking table lists BRAND-06
as "Gap -- human-verification FAILED 2026-08-22." `STATE.md` records an open
blocker requiring a follow-up gap-closure plan. `03-10-SUMMARY.md` closes
with `status: halted` and states outright "Phase 3's human-verification gate
is NOT satisfied." This verification independently confirms all of that is
accurate — the phase goal ("carries no Mozilla trademark asset" is satisfied;
"a dev build is distinguishable at a glance" is not) is not yet fully
achieved, and the automated 12/12 aggregator being green does not change
that, since nothing in the automated suite reads `brand.properties`.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria, verbatim from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Six identity surfaces each report Sourcerer, verified by command (both variants) | ✓ VERIFIED | Gap 1 (CR-01) closed. Live 12/12 run (`03-MANUAL-VERIFICATION.md`) shows `verify-branding-identity-release` reading the release tree's own `brand.ftl` (`variant=release brand.ftl=.../release/locales/en-US/brand.ftl -brand-full-name="Sourcerer"`), plus a dedicated `verify-branding-identity-brand-ftl-control` cross-variant positive control, both PASS. 03-REVIEW.md's re-review independently confirms the `VARIANTS` descriptor and `--variant`/`--brand-ftl` override exist in `scripts/verify-branding-identity.mjs`. |
| 2 | Repo laid out as `upstream/`+`patches/`+`sourcerer/`; documented rebase replays patch stack onto a new ESR tag, failing loudly on conflict | ✓ VERIFIED | Unchanged from prior verification (already fully verified, re-confirmed this session: `check-patch-surface.sh` self-test PASS, sole patch present). No new evidence needed — carried forward. |
| 3 | `check-patch-surface.sh` positive control + tiered-loop timings re-measured, recorded in `docs/BUILD.md` with date/command | ✓ VERIFIED | Unchanged from prior verification (already fully verified). Spot-checked this session: `bash scripts/check-patch-surface.sh` PASS, exit 0. |
| 4 | Never touches `~/.mozilla/firefox`; network capture contacts no host outside the documented allowlist whose Mozilla entries are the three named Remote Settings hosts; every check ships a positive control that goes red | ✓ VERIFIED | Gap 2 closed. ROADMAP.md Criterion 4 and REQUIREMENTS.md BRAND-04 both now name the three-host carve-out (amended 2026-08-22). Live run shows `allowlist-doc-consistency: PASS -- 3 Mozilla allow host(s) checked, found in both ROADMAP.md (3) and REQUIREMENTS.md (3)` plus its own self-test PASS. Gap 3 (CR-02) also closed: `verify-endpoints-interrupt-self-test: PASS -- pref file digest unchanged after interrupt`, independently confirmed fixed in 03-REVIEW.md's re-review (`track_pref_backup`/`restore_pref_backup` now registered against the script's own `trap cleanup`). Spot-checked this session: `endpoint-allowlist.json` parses to 21 hosts, consistent with the claimed schema. |
| 5 | A dev build is distinguishable at a glance from a future packaged release; shipped `branding/` tree has no Mozilla trademark asset | ✗ FAILED (distinguishability half) / ✓ VERIFIED (trademark half) | **Trademark half PASSED**: Item B human review (`03-MANUAL-VERIFICATION.md`), 15/15 carried-forward files opened and reviewed in both variants, 0 Mozilla marks found. **Distinguishability half FAILED**: Item A human review, performed on a real desktop session 2026-08-22, recorded FAILED — no window title rendered for either variant (client-side decorations), icon badge "inconclusive." Root cause (`brand.properties` byte-identical between variants) independently re-confirmed this session via direct `diff` (empty output — files are byte-identical, both read `brandFullName=Sourcerer`). Since Criterion 5 is a conjunction ("distinguishable... AND no trademark asset"), the criterion as a whole is FAILED. |

**Score:** 4/5 roadmap success criteria fully verified, 1/5 FAILED (Criterion 5 / BRAND-06)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/verify-branding-identity.mjs` | Six-surface identity checklist, variant-aware | ✓ VERIFIED | Now variant-aware for all six surfaces including brand-full-name (Gap 1 closed); does not read `brand.properties` (see Gap below — this is why the properties-file defect is invisible to it) |
| `sourcerer/endpoint-allowlist.json` | hosts[]/prefs[] schema, documented Mozilla carve-out | ✓ VERIFIED | 21 hosts, 25 prefs (live run); 3 Mozilla hosts now match amended ROADMAP/REQUIREMENTS wording |
| `scripts/verify-endpoints.sh` | Three-layer endpoint/profile prover, interrupt-safe | ✓ VERIFIED | `track_pref_backup`/`restore_pref_backup` registered against `trap cleanup`; `--interrupt-self-test` PASS in live run |
| `sourcerer/branding/dev/`, `sourcerer/branding/release/` | Full Sourcerer branding trees, no trademark assets, distinguishable per variant | ⚠️ PARTIAL | Trademark-free (Item B PASSED); NOT distinguishable per variant in `brand.properties` — byte-identical between the two trees (independently confirmed via `diff` this session), contradicting `brand.ftl` |
| `03-MANUAL-VERIFICATION.md` | Durable record of both human-verification items | ✓ VERIFIED | Exists, both items recorded with verdicts, launch commands, observer, date |
| `docs/BUILD.md` | Tier timings, compiled-file boundary, allowlist, rebase/install procedures | ✓ VERIFIED | Unchanged from prior verification (already fully verified) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/verify-phase-03.sh` | `verify-branding-identity.mjs` (release invocation) | `--bin`/`--desktop`/`--config-status`/`--variant` flags | ✓ WIRED | Now genuinely variant-parameterised for all 6 surfaces (Gap 1 closed) |
| `scripts/verify-endpoints.sh` cleanup | pref-file backup/restore | `trap cleanup EXIT` / `INT TERM` | ✓ WIRED | `track_pref_backup` registered, `--interrupt-self-test` demonstrates real SIGINT survival |
| `locales/jar.mn` | `brand.properties` | packaged into `browser.jar` under `locale/branding/` | ⚠️ WIRED but content is not per-variant | The file IS packaged and reachable at runtime (unlike the separate `aboutDialog.css` dead-file finding in 03-REVIEW.md WR-02) — the defect is that its content is identical across variants, not that it's unwired |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| BUILD-03 | 03-01, 03-04, 03-06, 03-08 | Fork structured `upstream/`+`patches/`+`sourcerer/`, documented CI-ready rebase | ✓ SATISFIED | Unchanged from prior verification; re-confirmed this session |
| BUILD-04 | 03-01, 03-06 | Tiered incremental rebuild loop, compiled-file boundary guard | ✓ SATISFIED | Unchanged from prior verification; `check-patch-surface.sh` spot-checked PASS this session |
| BRAND-01 | 03-02, 03-05, 03-07 | Six-surface identity checklist | ✓ SATISFIED | Gap 1 closed — all six surfaces now genuinely variant-aware for both dev and release |
| BRAND-02 | 03-01, 03-05, 03-10 | Full replacement `branding/` tree, no Mozilla trademark assets | ✓ SATISFIED | Item B human review PASSED (15/15 files, 0 marks) |
| BRAND-03 | 03-02, 03-03, 03-08 | Profile isolation from real `~/.mozilla/firefox` | ✓ SATISFIED | Unchanged from prior verification; strace layer PASS in live run |
| BRAND-04 | 03-02, 03-03, 03-08, 03-09 | Auto-update disabled, allowlisted endpoints only | ✓ SATISFIED | Gaps 2 and 3 both closed |
| BRAND-06 | 03-05, 03-07, 03-10 | Dev builds visibly distinguishable from release | ✗ BLOCKED | Item A human review FAILED. `REQUIREMENTS.md` and `ROADMAP.md` themselves already record this requirement as reverted to Gap status as of 2026-08-22. Root cause identified (`brand.properties` parity, CSD hiding title bar, weak icon badge) but not fixed by any plan in this phase — 03-10 was explicitly scoped as evidence-only (`must_haves.prohibitions`: "No source file, script, or requirement document is modified by this plan"). |

No orphaned requirements: all 7 IDs (`BUILD-03`, `BUILD-04`, `BRAND-01`, `BRAND-02`, `BRAND-03`, `BRAND-04`, `BRAND-06`) mapped to Phase 3 in `REQUIREMENTS.md` are claimed by at least one of the phase's ten plans (`grep -n "^requirements:"` across all ten `-PLAN.md` files confirms every ID appears at least once).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `sourcerer/branding/{dev,release}/locales/en-US/brand.properties` | 7 | Byte-identical values across variants where the sibling `brand.ftl` correctly diverges | 🛑 Blocker (this phase's live gap — BRAND-06) | Direct cause of the FAILED distinguishability human check; independently re-confirmed via `diff` this session |
| `scripts/verify-branding-identity.mjs` | — | No surface reads `brand.properties` at all | ⚠️ Warning (03-REVIEW.md WR-01, unfixed) | The exact regression above is invisible to the automated 12/12 gate — a green run gives false assurance about visual distinguishability |
| `sourcerer/branding/{dev,release}/content/aboutDialog.css` | — | Shipped file never mapped in `content/jar.mn`; unreachable at the `chrome://branding/content/aboutDialog.css` URI Firefox's own `aboutDialog.xhtml` requests | ⚠️ Warning (03-REVIEW.md WR-02, unfixed) | Not required by any of the 5 roadmap success criteria; dead code / silently-broken About-dialog styling, does not block this phase's goal |
| `sourcerer/distribution/policies.json` | — | No `moz.build` wiring; no automated build-time or verify-time proof it lands in a built objdir | ⚠️ Warning (03-REVIEW.md WR-03, unfixed) | The three lockdown policies it encodes (`DisableAppUpdate`/`DisableTelemetry`/`DisableFirefoxStudies`) have zero automated coverage; a clobber+rebuild without the documented manual copy step would silently drop them and nothing in the phase's verification suite would catch it. Does not currently fail Criterion 4 (the strace/network layers independently prove the equivalent lockdown via prefs), but is a standing operational risk. |
| `scripts/lib/firefox-bidi.mjs` | 1-3 | Stale header comment (references old `firefox` binary name, superseded by a correct comment further down) | ℹ️ Info (03-REVIEW.md IN-01, unfixed) | Cosmetic only |
| No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers found in phase-modified files | — | — | — | Confirmed clean by 03-REVIEW.md's file-by-file review this same day |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `check-patch-surface.sh` reports PASS (fast, no build) | `bash scripts/check-patch-surface.sh` | `PASS -- no compiled-file target paths in 1 patch(es)`, exit 0 | ✓ PASS |
| `endpoint-allowlist.json` parses and has the claimed host count | `node -e "..."` parsing the file | `21` hosts | ✓ PASS (matches the live-run's `allowlist-schema: PASS -- 21 host(s), 25 pref(s)`) |
| `brand.properties` is genuinely byte-identical across variants (independent re-confirmation of the gap's root cause) | `diff sourcerer/branding/{dev,release}/locales/en-US/brand.properties` | Empty diff, exit 0 — both files read `brandFullName=Sourcerer` | ✗ FAIL as expected — confirms the gap, not a regression in this verification's own tooling |
| Full 12/12 aggregator (requires a built Firefox binary and a ~35s network capture; not re-run in this verification to avoid duplicating a build-dependent, multi-minute run already recorded verbatim in `03-MANUAL-VERIFICATION.md` from earlier the same day) | `bash scripts/verify-phase-03.sh` | Not independently re-executed in this pass — relying on `03-MANUAL-VERIFICATION.md`'s verbatim 12/12 PASS transcript (same-day, same repo state, cross-checked against `03-REVIEW.md`'s independent source-level re-review of the same two fixes) | ? SKIP (see note) |

### Human Verification Required

None outstanding for this verification pass — both previously Manual-Only
items (Item A, Item B) were performed by 03-10 and are durably recorded in
`03-MANUAL-VERIFICATION.md`. Item A's outcome is the gap recorded above, not
a new pending human-verification item; per `03-10-SUMMARY.md`, fixing the
root cause and re-running Item A is exactly the deliverable of the
gap-closure plan this VERIFICATION.md's gap section calls for.

### Gaps Summary

**One open gap: Success Criterion 5 / BRAND-06 (dev vs release distinguishable
at a glance) is FAILED**, confirmed both by the phase's own human-verification
record (`03-MANUAL-VERIFICATION.md` Item A, performed 2026-08-22 on a real
desktop session) and by this verification's independent re-confirmation of
the root cause (`brand.properties` byte-identical between variants). This is
a genuine, unfixed defect in the branding tree's content, not a tooling gap
and not a false negative — the phase's own artifacts (`REQUIREMENTS.md`,
`ROADMAP.md`, `STATE.md`, `03-10-SUMMARY.md`) already record it as an open
blocker requiring a follow-up gap-closure plan, and this verification agrees.

The three gaps carried over from the prior `03-VERIFICATION.md`
(brand-full-name variant-blindness / CR-01, allowlist wording mismatch, and
interrupt-unsafe positive controls / CR-02) are all genuinely closed —
confirmed independently in this session via `03-REVIEW.md`'s source-level
re-review, the live 12/12 `verify-phase-03.sh` transcript recorded the same
day in `03-MANUAL-VERIFICATION.md`, and two direct spot-checks run in this
verification pass (`check-patch-surface.sh`, allowlist JSON parse).

The phase goal's other three clauses — rebuilds in minutes (tiered loop),
carries no Mozilla trademark asset, and can be rebased onto a new ESR tag by
a documented procedure — are all fully achieved and verified, including via
a real successful off-machine CI dispatch recorded in the prior verification
and unchanged since. The remaining work is narrowly scoped: fix
`brand.properties` to diverge per variant (matching `brand.ftl`), address the
client-side-decoration title-bar visibility and icon-badge perceptibility
findings, add a `brand.properties`-aware automated surface so this exact
regression cannot silently recur, then re-run Item A.

---

_Verified: 2026-08-22T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
