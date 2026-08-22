---
phase: 03-branded-firefox-fork
plan: 09
subsystem: docs+testing
tags: [gap-closure, documentation-consistency, verification-tooling]

# Dependency graph
requires:
  - phase: 03-branded-firefox-fork (plan 02, 03)
    provides: "sourcerer/endpoint-allowlist.json's three allow-dispositioned Remote Settings hosts, confirmed live by a real 35-second layer-3 capture in 03-03"
  - phase: 03-branded-firefox-fork (plan 06, 08)
    provides: "scripts/verify-phase-03.sh's aggregator CHECKS-array shape and its --quick shared block, this plan appends to"
provides:
  - "ROADMAP.md Success Criterion 4, REQUIREMENTS.md BRAND-04 and 03-CONTEXT.md D-83, all amended to name the same three-host Remote Settings carve-out with the same per-host reason, closing 03-VERIFICATION.md Gap 2's documentation half"
  - "scripts/verify-phase-03.sh's allowlist-doc-consistency gate (whole-token, non-vacuous-on-empty, sorted/deterministic output) plus its allowlist-doc-consistency-self-test, closing Gap 2's machine-checked half"
affects: [03-10]

# Actuals (#2632)
actuals:
  tokens: 21000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_allowlist_doc_consistency_impl(allowlist_path) is a shared inner helper both the real check and its self-test call, following check_allowlist_schema()'s node -e / argv-paths / PASS-FAIL-line shape -- keeps the whole-token matching logic defined exactly once."
    - "verify-phase-03.sh gained its own TEMP_PATHS/track_temp pair (mirroring verify-endpoints.sh's), called from the script's own cleanup() alongside CURRENT_CHECK_PID -- any future check that needs a scratch temp file registers it this way so both trap cleanup EXIT and trap 'cleanup; exit 130' INT TERM remove it."

key-files:
  created: []
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/03-branded-firefox-fork/03-CONTEXT.md
    - scripts/verify-phase-03.sh

key-decisions:
  - "Amended the authoritative requirement wording (ROADMAP Criterion 4, REQUIREMENTS BRAND-04, D-83) rather than writing a verification override -- direction pre-approved by the developer per the plan's reversibility_record; rated costly (not one-way) since only the description changes, not the shipped, already-verified allowlist behavior."
  - "Whole-token matching implemented as a regex requiring the character on each side of a host match to be outside the hostname character class (letters/digits/dot/hyphen) -- a plain substring search would let 'cdn.mozilla.net' pass vacuously as a suffix of two genuinely-documented hosts, which is exactly what RED demonstration B exists to prove."

patterns-established: []

requirements-completed: [BRAND-04]

coverage:
  - id: D1
    description: "ROADMAP.md Criterion 4, REQUIREMENTS.md BRAND-04 and 03-CONTEXT.md D-83 all name the same three Remote-Settings-family hosts with the same per-host reason; both 2026-08-22 amendment notes cite D-83 and 03-VERIFICATION.md Gap 2; the 2026-08-21 notes are unedited; endpoint-allowlist.json is byte-unchanged"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "for-loop grep of all three hostnames across all three docs -> ALL-THREE-PRESENT; grep -c 'only Mozilla entry' both files -> 0,0; grep -c '2026-08-22' both files -> 2,2; grep -c 'amended 2026-08-21' ROADMAP.md -> 1 (unchanged); git diff .planning/REQUIREMENTS.md shows only additions inside the original 71-104 amendment block, no removed lines; git diff --numstat sourcerer/endpoint-allowlist.json -> empty; grep -c 'Utils.sys.mjs' 03-CONTEXT.md -> 3 (unchanged before/after); grep -c '[x] **BRAND-04**' REQUIREMENTS.md -> 1 -- all executed this session"
        status: pass
    human_judgment: false
  - id: D2
    description: "allowlist-doc-consistency and allowlist-doc-consistency-self-test registered in verify-phase-03.sh's shared --quick block, whole-token matched, non-vacuous on an empty filtered set, proven red three ways (undocumented host, suffix-adjacency host, empty set) and green after each restore, deterministic across repeated runs, no residue"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-03.sh --quick -> exit 0, both new checks PASS, host count 3; RED A (sourcerer-red-demo.cdn.mozilla.net planted) -> exit 1, named, restored, re-confirmed green; RED B (cdn.mozilla.net planted) -> exit 1, named, restored, re-confirmed green; RED C (direct helper call against an empty-Mozilla-allow-set allowlist) -> exit 1, 'filter matched no allow-dispositioned...host'; two consecutive --quick runs' allowlist-doc-consistency lines byte-identical (diff empty); git status --porcelain sourcerer/endpoint-allowlist.json empty after every RED demo and after the self-test; bash scripts/verify-phase-03.sh (full) -> exit 0, 12/12 PASS, up from 10 in 03-08 -- all executed this session"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-22
status: complete
---

# Phase 3 Plan 9: Branded Firefox Fork -- Three-Host Remote Settings Carve-Out Documentation and Gate Summary

**ROADMAP.md, REQUIREMENTS.md and 03-CONTEXT.md now all describe the same three-host Remote Settings carve-out the shipped allowlist has actually enforced since 03-02/03-03, and `scripts/verify-phase-03.sh` gained a whole-token, non-vacuous `allowlist-doc-consistency` gate (with its own planted-failure self-test) so the same drift cannot recur silently -- closing 03-VERIFICATION.md's Gap 2.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Rewrote the singular-carve-out clause in `.planning/ROADMAP.md` (Success Criterion 4), `.planning/REQUIREMENTS.md` (BRAND-04) and `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md` (D-83) to the same canonical three-host formulation, each host carrying the same reason across all three documents, taken verbatim from `sourcerer/endpoint-allowlist.json`'s own `reason` fields.
- Added a 2026-08-22 amendment blockquote to both ROADMAP.md (after the existing 2026-08-21 note) and REQUIREMENTS.md (appended to the existing 2026-08-21 amendment block), each citing D-83 and `03-VERIFICATION.md` Gap 2 and the real 35-second 03-03 capture as evidence. Extended D-83's own text in 03-CONTEXT.md with a dated 2026-08-22 paragraph, keeping its original `Utils.sys.mjs` reasoning intact.
- Added `allowlist-doc-consistency` to `scripts/verify-phase-03.sh`'s shared `--quick` block: a `node -e` check (mirroring `check_allowlist_schema()`'s shape) that selects every allow-dispositioned `mozilla.com`/`mozilla.net` host from the real allowlist and requires a whole-token match in both `ROADMAP.md` and `REQUIREMENTS.md`, failing loudly (not vacuously passing) if the filtered set is ever empty.
- Added `allowlist-doc-consistency-self-test`: plants a temp copy of the real allowlist with two additional allow entries -- an undocumented host and a proper suffix of two genuinely-documented hosts (`cdn.mozilla.net`) -- and requires the shared inner helper (`_allowlist_doc_consistency_impl`) to reject both, proving whole-token rather than substring matching. The temp file is registered via a new `track_temp`/`TEMP_PATHS` pair wired into the script's own `cleanup()`, so an interrupted self-test leaves no residue and the real allowlist is never written.
- Aggregator check count: 10 (03-08's post-plan count) -> 12.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend the four documents to describe the three-host Remote Settings carve-out** - `675cd3e` (docs)
2. **Task 2: Gate the allowlist-to-document consistency, with a planted-failure self-test** - `827bc59` (feat)

_No TDD tasks in this plan; each commit is a single docs/feat commit._

## Files Created/Modified

- `.planning/ROADMAP.md` - Criterion 4 rewritten to the canonical three-host formulation; new 2026-08-22 companion amendment blockquote added after the 2026-08-21 note
- `.planning/REQUIREMENTS.md` - BRAND-04 rewritten to the canonical three-host formulation (checkbox state preserved); new 2026-08-22 amendment paragraph appended to the existing amendment block; trailing `*Last updated:*` line updated
- `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md` - D-83 extended in place with a dated 2026-08-22 paragraph naming all three hosts; original reasoning (`Utils.sys.mjs`, the rejected self-hosted mirror) unchanged
- `scripts/verify-phase-03.sh` - `_allowlist_doc_consistency_impl`, `check_allowlist_doc_consistency`, `check_allowlist_doc_consistency_self_test`, `track_temp`/`TEMP_PATHS` wired into `cleanup()`, two new `CHECKS` entries in the shared `--quick` block

## Decisions Made

- **Amended the authoritative requirement wording rather than writing an override** -- per the plan's `reversibility_record`, this direction was pre-approved by the developer before planning; no `checkpoint:decision` was inserted ahead of Task 1.
- **Whole-token matching via a character-class boundary regex**, not a plain substring search -- required to correctly reject `cdn.mozilla.net` as a documented-host suffix rather than let it pass vacuously (RED demonstration B proves this).

## Deviations from Plan

None -- plan executed exactly as written. Both tasks' acceptance criteria were met on the first implementation pass; no auto-fixes were needed.

## Issues Encountered

None.

## Verbatim Verification Output

**Canonical three-host formulation, as written into each document:**

`.planning/ROADMAP.md` (Success Criterion 4):
> 4. Running the build on a machine with real Firefox installed never reads or writes `~/.mozilla/firefox` (proven by exact-path `strace`, not a bare `.mozilla` match), and a full-session network capture contacts no host outside a documented allowlist — whose Mozilla entries are the three hosts of the one Remote Settings carve-out (D-83): `firefox.settings.services.mozilla.com` (the Remote Settings service itself, 24-hour poll), `content-signature-2.cdn.mozilla.net` (the content-signature certificate chain each downloaded collection is verified against), and `firefox-settings-attachments.cdn.mozilla.net` (the attachment CDN serving large collection blobs, including CRLite's own revocation data) — with each non-Mozilla host individually waived or disabled. Each check ships a positive control that must go red

`.planning/REQUIREMENTS.md` (BRAND-04):
> - [x] **BRAND-04**: Auto-update is disabled and a running build contacts no host outside a documented allowlist — whose Mozilla entries are the three hosts of the one Remote Settings carve-out (D-83): `firefox.settings.services.mozilla.com` (the Remote Settings service itself, 24-hour poll), `content-signature-2.cdn.mozilla.net` (the content-signature certificate chain each downloaded collection is verified against), and `firefox-settings-attachments.cdn.mozilla.net` (the attachment CDN serving large collection blobs, including CRLite's own revocation data) — with every non-Mozilla host individually waived with a stated reason or disabled

`.planning/phases/03-branded-firefox-fork/03-CONTEXT.md` (D-83, extension paragraph):
> **Extended 2026-08-22** (03-09 gap closure, `03-VERIFICATION.md` Gap 2): the carve-out named above was always three hosts, not one — `firefox.settings.services.mozilla.com` is the Remote Settings service itself; `content-signature-2.cdn.mozilla.net` is the content-signature certificate chain each downloaded collection is verified against; `firefox-settings-attachments.cdn.mozilla.net` is the attachment CDN serving large collection blobs, including CRLite's own revocation data — one of this decision's own stated reasons for keeping Remote Settings on. A real, non-control 35-second network capture in 03-03 confirmed these three and only these three resolve under the carve-out; `sourcerer/endpoint-allowlist.json` already allow-dispositions all three. This extension brings D-83's own text into agreement with the allowlist it governs; the reasoning above is unchanged.

**RED demonstration A (undocumented host, `sourcerer-red-demo.cdn.mozilla.net` planted):**
```
allowlist-doc-consistency: FAIL -- 4 Mozilla allow host(s) checked, 1 violation(s):
  sourcerer-red-demo.cdn.mozilla.net: missing from ROADMAP.md, REQUIREMENTS.md
```
(exit 1; restored, `git diff --numstat sourcerer/endpoint-allowlist.json` empty, re-confirmed green: `allowlist-doc-consistency: PASS -- 3 Mozilla allow host(s) checked, found in both ROADMAP.md (3) and REQUIREMENTS.md (3)`)

**RED demonstration B (adjacency, `cdn.mozilla.net` planted -- proper suffix of two documented hosts):**
```
allowlist-doc-consistency: FAIL -- 4 Mozilla allow host(s) checked, 1 violation(s):
  cdn.mozilla.net: missing from ROADMAP.md, REQUIREMENTS.md
```
(exit 1 -- proves whole-token matching correctly fails where a substring search would have vacuously passed; restored, re-confirmed green)

**RED demonstration C (empty set, inner helper invoked directly against a temp allowlist with zero Mozilla allow entries):**
```
allowlist-doc-consistency: FAIL -- filter matched no allow-dispositioned mozilla.com/mozilla.net host in /tmp/tmp.XWgrSzgoip
```
(exit 1 -- proves the check cannot pass vacuously on an empty filtered set)

**Determinism:** two consecutive `bash scripts/verify-phase-03.sh --quick` runs' `allowlist-doc-consistency` output lines, diffed -- empty (byte-identical).

**No residue:** `git status --porcelain sourcerer/endpoint-allowlist.json` empty after every RED demo and after the self-test; no temp allowlist file remained under `/tmp` matching the self-test's pattern.

**Aggregator check count -- before this plan (03-08's post-plan count):** 10
**Aggregator check count -- after this plan:**
```
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
12/12 PASS, exit 0 -- check count grew by exactly two, as the plan required.

**Final state:** `git diff --numstat sourcerer/endpoint-allowlist.json` produces no output after every command run in this plan -- the shipped allowlist is byte-unchanged throughout.

## Known Stubs

None -- every code path added is real and exercised by the verification above; no mock/placeholder data paths.

## Threat Flags

None -- this plan modifies planning documentation and verification tooling only (three markdown files, one bash script). No new network endpoints, auth paths, file-access patterns, or schema changes at a trust boundary.

## User Setup Required

None.

## Next Phase Readiness

- All three gaps from `03-VERIFICATION.md`'s Gaps Summary are now closed: Gap 1 (CR-01) by 03-07, Gap 3 (CR-02) by 03-08, and Gap 2 (this plan) -- documentation and machine-checked consistency both fixed.
- `bash scripts/verify-phase-03.sh` exits 0 with 12/12 PASS as of this plan's last commit; `sourcerer/endpoint-allowlist.json` is unchanged from its pre-plan state.
- Remaining open items for the phase per `03-VERIFICATION.md`'s Human Verification Required section: two Manual-Only human verifications (visual dev/release distinguishability; file-by-file branding-tree trademark review), unchanged, scoped to `03-10`.
- No blockers.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-22*

## Self-Check: PASSED

All claimed files found on disk (`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md`, `scripts/verify-phase-03.sh`, this SUMMARY.md). All claimed commits found in git history (`675cd3e`, `827bc59`).
