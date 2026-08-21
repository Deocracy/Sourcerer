---
phase: 3
slug: branded-firefox-fork
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `03-RESEARCH.md` § "Validation Architecture". The Per-Task
> Verification Map is filled by `gsd-planner` once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None conventional (no pytest/jest/vitest). Bash + Node scripts driving real processes — the pattern Phases 1 and 2 established (`scripts/smoke-*.sh`, `scripts/verify-*.mjs`, `scripts/lib/firefox-bidi.mjs`). Per Phase 2 D-69, no new test dependency is introduced. |
| **Config file** | none — see Wave 0 Requirements |
| **Quick run command** | `bash scripts/check-patch-surface.sh` |
| **Full suite command** | `bash scripts/verify-phase-03.sh` |
| **Estimated runtime** | quick ~2s; full suite ~60–120s against an already-built binary (excludes any Gecko compile) |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/check-patch-surface.sh` — the
  only check cheap enough to run on every patch-touching commit.
- **After every plan wave:** Run the BRAND-01 / BRAND-03 / BRAND-04 smoke layers
  against the latest incremental build. Do **not** force a full rebuild per wave
  — D-70's tiered loop is what makes this affordable.
- **Before `/gsd-verify-work`:** `bash scripts/verify-phase-03.sh` green, plus
  D-73's two acceptance checks (guard positive control fires; tiered-loop
  timings re-measured and written into `docs/BUILD.md` with date and command).
- **Max feedback latency:** 2s for the per-commit guard; ~120s for the full
  suite.

---

## Per-Task Verification Map

*Filled by `gsd-planner` 2026-08-21. Task IDs are `{plan}-T{task}`. A row with
two IDs means the check is **authored** in the first and driven **green** in the
second — the Wave-0 red-by-design split.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 → 03-02-T3 | 03-01, 03-02 | 1, 2 | BUILD-03 | — | N/A | integration | `bash scripts/apply-patches.sh --self-test` (mktemp git fixture with one patch pre-adopted; no 1.1 GB clone) | ❌ W0 | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | BUILD-03 | — | N/A | integration | `bash scripts/fetch-upstream.sh --self-test` (four classifier cases) and `bash scripts/fetch-upstream.sh` against the patched tree | ❌ W0 | ⬜ pending |
| 03-04-T1 → 03-04-T2 | 03-04 | 2 | BUILD-03 | — | N/A | integration | `bash scripts/rebase-upstream.sh --tag <TAG> --dry-run` · a real `gh workflow run` | ❌ W0 | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | BUILD-04 | — | N/A | unit | `bash scripts/check-patch-surface.sh && bash scripts/check-patch-surface.sh --self-test` | ❌ W0 | ⬜ pending |
| 03-06-T1 | 03-06 | 5 | BUILD-04 | — | N/A | manual (timing) | three tier measurements on this host, recorded in `docs/BUILD.md` with command, units and date | ❌ W0 | ⬜ pending |
| 03-02-T1 → 03-05-T2/T3 | 03-02, 03-05 | 2, 4 | BRAND-01 | — | N/A | smoke | `node scripts/verify-branding-identity.mjs [--bin …] [--config-status …] [--desktop …]`, plus `--positive-control <surface>` | ❌ W0 | ⬜ pending |
| 03-01-T1, 03-05-T1 | 03-01, 03-05 | 1, 4 | BRAND-02 | — | N/A | static | `find sourcerer/branding -iname "*.icns" -o -iname "*.ico" -o -iname "Assets.car" -o -iname "*.VisualElementsManifest.xml"` → must be empty | ❌ W0 | ⬜ pending |
| 03-02-T2 → 03-03-T2 | 03-02, 03-03 | 2, 3 | BRAND-03 | — | Profile isolation from a co-installed real Firefox | smoke | `bash scripts/verify-endpoints.sh --layer 2` (exact-path `strace` on `$HOME/.mozilla/firefox`, plus a positive `.mozilla`-component observation) | ❌ W0 | ⬜ pending |
| 03-02-T2 → 03-03-T1/T2 | 03-02, 03-03 | 2, 3 | BRAND-04 | — | No Mozilla update/telemetry endpoint outside the documented allowlist | smoke (3 layers) | `bash scripts/verify-endpoints.sh` — pref assertion · exact-path `strace` · `MOZ_LOG=nsHostResolver:5` | ❌ W0 | ⬜ pending |
| 03-05-T1 → 03-05-T3 | 03-05 | 4 | BRAND-06 | — | N/A | smoke (two builds) | `node scripts/verify-branding-identity.mjs` run against both `objdir/` and `objdir-release/`, plus a byte-difference check on the two installed icon sets | ❌ W0 | ⬜ pending |
| 03-06-T3 | 03-06 | 5 | all seven | — | N/A | aggregate | `bash scripts/verify-phase-03.sh` (and `--quick`, under 120s) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Positive controls (mandatory — not optional extras)

Every check above whose passing state is "the thing is absent" ships a
deliberate modification that must make it **fail**. Phase 2 shipped a negative
check (`verify-dev-flag-off`) that was green for the wrong reason across three
plans; the control is what distinguishes "correctly absent" from "the check
never ran" (02-LEARNINGS.md, Patterns).

| Check | Positive control that must go red |
|-------|-----------------------------------|
| `check-patch-surface.sh` | a deliberately-planted patch touching a `.cpp` file |
| `apply-patches.sh` adopted-patch assertion | a scratch upstream with one patch's content pre-applied — verified necessary: `git apply --3way` exits **0** with a silent no-op in exactly this case |
| BRAND-01 six-surface checklist | `node scripts/verify-branding-identity.mjs --positive-control <surface>` — runs one surface with the stock Firefox value as the expectation and exits 0 only if that surface then FAILS. **Revised by `gsd-planner` 2026-08-21:** literally reverting an identity option costs a full ~54min rebuild (they are compiled defines) and this phase's budget is two builds. Inverting the expectation proves the same two things — the reader produced a real live value, and the comparison discriminates — at zero build cost |
| BRAND-04 layer 1 (static pref grep) | restore the `aus5.mozilla.org` URL in the pref file |
| BRAND-04 layer 2 (`strace`) / BRAND-03 | run the whole layer inside a `mktemp -d` redirected `HOME` with a `.mozilla/firefox` directory pre-created inside that sandbox, launching with `--profile` pointing into it so the binary genuinely touches that exact path; require the layer to go red. **Revised by `gsd-planner` 2026-08-21:** reverting the vendor patch is a compiled-define change costing a full rebuild, and the original wording would also have the control touch the developer's real `~/.mozilla` tree, which this phase prohibits. The sandbox form is a real end-to-end observation of the real binary through the real strace path, at zero build cost and zero contact with the real tree. The plain (green) run additionally asserts at least one `.mozilla` path component was observed, so an empty capture cannot read as green |
| BRAND-04 layer 3 (`MOZ_LOG`) | re-enable one disabled endpoint pref and confirm the host appears |

---

## Wave 0 Requirements

Every artifact below is absent today. Following Phase 2's proven shape, the
verification harness is written and committed **red by design** before the code
it checks exists, and each red is confirmed to be red for the stated reason.

Plan ownership assigned by `gsd-planner` 2026-08-21 in square brackets.

- [ ] `scripts/check-patch-surface.sh` — the D-72/D-73 guard; compiled-suffix
      set from `upstream/python/mozbuild/mozbuild/frontend/emitter.py:1126-1133`
      **[03-01 Task 2]**
- [ ] `scripts/apply-patches.sh` — patch replay plus D-75's post-apply
      per-patch assertion **[03-01 Task 1; `--self-test` control in 03-02 Task 3]**
- [ ] `scripts/verify-branding-identity.mjs` — BRAND-01's six-surface checklist
      **[03-02 Task 1; `--desktop`/`--config-status` options in 03-05 Task 2]**
- [ ] `scripts/fetch-upstream.sh` — the D-76 expected-dirt classifier replacing
      its unconditional dirty-tree hard-fail, plus a `--self-test` mode.
      **[03-01 Task 2 — it must land in the plan that first makes `upstream/`
      legitimately dirty, or the documented command is red for the wrong reason
      until Wave 2]**
- [ ] `scripts/verify-endpoints.sh` — BRAND-03's exact-path `strace` layer and
      BRAND-04's three layers, plus `sourcerer/endpoint-allowlist.json` as their
      shared machine-readable source of truth **[03-02 Task 2; driven green in
      03-03 Task 2]**
- [ ] `scripts/verify-phase-03.sh` — aggregator, following
      `scripts/verify-phase-02.sh`'s structure (including its
      `trap cleanup EXIT` + `trap 'cleanup; exit N' INT TERM` split — a
      combined trap does not terminate the script, per 02-LEARNINGS.md)
      **[03-02 Task 3; CHECKS list completed in 03-06 Task 3]**
- [ ] `scripts/lib/firefox-bidi.mjs` — parameterise the hardcoded module-level
      `FIREFOX_BIN` (line 32) by adding `binPath = FIREFOX_BIN` to the options
      object of `captureScreenshot()` and `withFirefoxPage()`. Keep
      `export const FIREFOX_BIN` as the default so Phase 2's existing callers,
      which pass no override, are unaffected. Required because the binary is no
      longer named `firefox`. **[03-02 Task 1]**
- [ ] `patches/`, `sourcerer/branding/dev`, `sourcerer/branding/release` —
      directories do not exist **[`patches/` and `dev` in 03-01 Task 1;
      `release` in 03-05 Task 1]**
- [ ] the `.desktop` file and its install step — the build emits none
      **[03-05 Task 2; install path documented in 03-06 Task 2]**
- [ ] `scripts/rebase-upstream.sh` and `.github/workflows/rebase-upstream.yml` —
      BUILD-03's CI-ready half **[03-04 Tasks 1 and 2]**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tiered-loop timings | BUILD-04 | Timing a full `./mach build` after a compiled-define change costs ~54 minutes and cannot sit in a per-commit or per-wave gate — same class as Phase 1's `smoke-firefox.sh` "runs a full Gecko compile" warning | At phase end, on this host: time `./mach run` after a symlinked-frontend edit, `./mach build faster` after a preprocessed-file edit, and a full `./mach build` after touching the `browser/moz.configure` patch. Record all three in `docs/BUILD.md` with the date and the exact command. **Must be re-measured, not copied from research** — 03-CONTEXT.md's 2.55s and ~54min are inherited figures, and one research timing run was contaminated |
| Dev-vs-release "at a glance" distinction | BRAND-06 | "Distinguishable at a glance" is a human judgment about an icon badge; a script can confirm the strings and files differ but not that a person can tell them apart | Build both branding variants, launch each, and confirm the window title and taskbar icon are distinguishable without reading `about:support` |
| No Mozilla trademark asset in the shipped tree | BRAND-02 | The automated check is a regression guard against known filenames; confirming no *unrecognised* trademark asset was carried forward needs a human reading the file list once | Review `sourcerer/branding/{dev,release}` file-by-file against `upstream/browser/branding/unofficial/`, confirming each carried-forward file is neutral scaffolding rather than a Mozilla mark |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] Every negative assertion has a positive control proven to go red
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
