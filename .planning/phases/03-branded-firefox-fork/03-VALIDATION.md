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

*Filled by `gsd-planner` — one row per task, referencing the plan and wave it
belongs to. The requirement→behaviour mapping below is the contract the planner
must satisfy; task IDs do not exist yet.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(pending planner)* | — | — | BUILD-03 | — | N/A | integration | `bash scripts/apply-patches.sh` against a scratch clone with one patch pre-adopted | ❌ W0 | ⬜ pending |
| *(pending planner)* | — | — | BUILD-04 | — | N/A | unit | `bash scripts/check-patch-surface.sh` | ❌ W0 | ⬜ pending |
| *(pending planner)* | — | — | BRAND-01 | — | N/A | smoke | `node scripts/verify-branding-identity.mjs` | ❌ W0 | ⬜ pending |
| *(pending planner)* | — | — | BRAND-02 | — | N/A | static | `find sourcerer/branding -iname "*.icns" -o -iname "Assets.car" -o -iname "*.VisualElementsManifest.xml"` → must be empty | ❌ W0 | ⬜ pending |
| *(pending planner)* | — | — | BRAND-03 | — | Profile isolation from a co-installed real Firefox | smoke | exact-path `strace` on `$HOME/.mozilla/firefox` | ❌ W0 | ⬜ pending |
| *(pending planner)* | — | — | BRAND-04 | — | No Mozilla update/telemetry endpoint outside the documented allowlist | smoke (3 layers) | static pref grep · exact-path `strace` · `MOZ_LOG=nsHostResolver:5` | ❌ W0 | ⬜ pending |
| *(pending planner)* | — | — | BRAND-06 | — | N/A | smoke | compare identity output between `--with-branding=…/dev` and `…/release` builds | ❌ W0 | ⬜ pending |

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
| BRAND-01 six-surface checklist | revert one identity option and confirm that surface alone reports the failure |
| BRAND-04 layer 1 (static pref grep) | restore the `aus5.mozilla.org` URL in the pref file |
| BRAND-04 layer 2 (`strace`) | launch once with the vendor patch reverted so the profile resolves under `~/.mozilla` |
| BRAND-04 layer 3 (`MOZ_LOG`) | re-enable one disabled endpoint pref and confirm the host appears |

---

## Wave 0 Requirements

Every artifact below is absent today. Following Phase 2's proven shape, the
verification harness is written and committed **red by design** before the code
it checks exists, and each red is confirmed to be red for the stated reason.

- [ ] `scripts/check-patch-surface.sh` — the D-72/D-73 guard; compiled-suffix
      set from `upstream/python/mozbuild/mozbuild/frontend/emitter.py:1126-1133`
- [ ] `scripts/apply-patches.sh` — patch replay plus D-75's post-apply
      per-patch assertion
- [ ] `scripts/verify-branding-identity.mjs` — BRAND-01's six-surface checklist
- [ ] `scripts/verify-phase-03.sh` — aggregator, following
      `scripts/verify-phase-02.sh`'s structure (including its
      `trap cleanup EXIT` + `trap 'cleanup; exit N' INT TERM` split — a
      combined trap does not terminate the script, per 02-LEARNINGS.md)
- [ ] `scripts/lib/firefox-bidi.mjs` — parameterise the hardcoded module-level
      `FIREFOX_BIN` (line 32) by adding `binPath = FIREFOX_BIN` to the options
      object of `captureScreenshot()` and `withFirefoxPage()`. Keep
      `export const FIREFOX_BIN` as the default so Phase 2's existing callers,
      which pass no override, are unaffected. Required because the binary is no
      longer named `firefox`.
- [ ] `patches/`, `sourcerer/branding/dev`, `sourcerer/branding/release` —
      directories do not exist
- [ ] the `.desktop` file and its install step — the build emits none

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
