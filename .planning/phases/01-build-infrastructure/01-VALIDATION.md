---
phase: 1
slug: build-infrastructure
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — this phase ships build tooling, not application code. Verification is shell-script smoke tests against the two dev shells. Do not introduce a test runner (bats, shellspec) for two scripts; plain `bash` with `set -euo pipefail` is sufficient. |
| **Config file** | none — Wave 0 creates the scripts |
| **Quick run command** | `nix develop .#theia --command yarn --version && nix develop .#firefox --command ./mach --version` (shell-entry smoke check) |
| **Full suite command** | `scripts/smoke-theia.sh && scripts/smoke-firefox.sh` |
| **Estimated runtime** | Quick: ~30 seconds (both shells already realized). Full: minutes for `smoke-theia.sh`, **hours** for `smoke-firefox.sh` — a full non-artifact Gecko compile (D-11) is the acceptance proof and cannot be shortened without abandoning the decision. |

---

## Sampling Rate

- **After every task commit:** Run the smoke script for the half of the phase that task touches (`smoke-theia.sh` for `theia/` and the `theia` shell, `smoke-firefox.sh` for `upstream/`, `.mozconfig`, and the `firefox` shell). Where a task touches only `flake.nix` scaffolding, run the quick shell-entry check.
- **After every plan wave:** Both smoke scripts, sequentially. They share no state; running both confirms neither shell's changes broke the other's isolation.
- **Before `/gsd-verify-work`:** Both full build sequences green — a real `./mach build` full compile that produces a launchable binary, and a real `yarn theia rebuild:browser` + `theia start` reachable at localhost.
- **Max feedback latency:** 60 seconds for the quick check. The full Firefox compile is deliberately exempt — see the note under **Manual-Only Verifications**.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. This map is seeded with the requirement-level
contract; the planner and `/gsd-validate-phase` fill the per-task rows.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | BUILD-01, BUILD-02 | — | N/A | smoke | `nix flake check && nix develop .#theia --command node --version \| grep -q '^v22\.' && nix develop .#firefox --command cbindgen --version` | ✅ this task | ⬜ pending |
| 01-01-T2 | 01 | 1 | — | — | N/A | fixture | `bash -n scripts/smoke-theia.sh && bash -n scripts/smoke-firefox.sh && test -x scripts/smoke-theia.sh && test -x scripts/smoke-firefox.sh && test "$(wc -l < .mozconfig)" -eq 4` | ✅ this task (W0) | ⬜ pending |
| 01-01-T3 | 01 | 1 | BUILD-02 | — | N/A | regression | `diff <(nix develop .#firefox --command bash scripts/toolchain-baseline.sh) toolchain-baseline.txt` | ✅ this task | ⬜ pending |
| 01-02-CP | 02 | 2 | BUILD-01 | pkg-legitimacy | Twelve `@theia/*` packages returned `SUS (too-new)`; blocking human confirmation before first install | manual gate | none — `checkpoint:human-verify`, `gate="blocking-human"`, not auto-approvable | n/a | ⬜ pending |
| 01-02-T1 | 02 | 2 | BUILD-01 | — | N/A | source assertion | `node -e '…exact-1.74.1 pin + 11-dep + 12-resolution check…' && test ! -d theia/applications/electron` | ✅ this task | ⬜ pending |
| 01-02-T2 | 02 | 2 | BUILD-01 | — | N/A | smoke | `scripts/smoke-theia.sh` | ✅ 01-01-T2 | ⬜ pending |
| 01-03-T1 | 03 | 2 | BUILD-02 | — | N/A | smoke | `./scripts/fetch-upstream.sh && test "$(git -C upstream describe --tags --exact-match HEAD)" = "FIREFOX_153_1_0esr_RELEASE"` | ✅ this task | ⬜ pending |
| 01-03-T2 | 03 | 2 | BUILD-02 | — | N/A | smoke (manual-only runtime) | `scripts/smoke-firefox.sh` — hours; the acceptance run, never a per-commit gate | ✅ 01-01-T2 | ⬜ pending |
| 01-04-T1 | 04 | 3 | BUILD-01, BUILD-02 | — | N/A | source assertion | `test -f docs/BUILD.md && grep -q 'nix develop .#theia' docs/BUILD.md && grep -q '^## Building' README.md` | ✅ this task | ⬜ pending |
| 01-04-T2 | 04 | 3 | BUILD-01, BUILD-02 | — | N/A | smoke (fresh clone) | fresh clone → `./scripts/fetch-upstream.sh && ./scripts/smoke-theia.sh && nix develop .#firefox --command bash -c 'cd upstream && MOZCONFIG=../.mozconfig ./mach configure'` | ✅ 01-01-T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-theia.sh` — covers BUILD-01. Enters the `theia` shell, installs, runs `yarn theia rebuild:browser`, builds the browser target, starts it, and asserts the localhost URL answers. Must assert the native rebuild actually compiled `node-pty` (success criterion 3), not merely that the command exited 0.
- [ ] `scripts/smoke-firefox.sh` — covers BUILD-02. Enters the `firefox` shell, runs `./mach build` against `upstream/`, launches the result, and asserts `mach bootstrap` never appears in the build log.
- [ ] `.mozconfig` — required fixture for `smoke-firefox.sh`, not a test file.
- [ ] No test framework install. This phase is infrastructure-only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Gecko compile completes and produces a launchable stock Firefox | BUILD-02 | Multi-hour runtime makes it unusable as a per-commit sampling gate, and it needs the real NixOS host's disk and RAM — the research flagged the flake as never having been evaluated on the actual host. Run once as the phase acceptance proof. | In the `firefox` shell: `./mach build`, then `./mach run`. Confirm a browser window opens and `about:support` reports 153.1.0esr. Capture the resolved rustc and cbindgen versions for the Phase 3 rebase baseline (D-13). |
| A second fresh clone reaches both builds using only the documented commands | Success criterion 4 | Requires a genuinely fresh clone in a separate directory on the real host; cannot be asserted from inside the working tree. | Clone to a new space-free path, follow `README.md` verbatim, and confirm no step outside `nix develop` was needed. Record any undocumented step as a failure, not a note. |
| Theia app loads and is interactive in a browser | BUILD-01 | The smoke script asserts the port answers; it does not assert the IDE shell actually rendered. | Open the localhost URL, confirm the Theia workbench renders with menu bar, and open a terminal tab to exercise the `node-pty` path end to end. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every row in the map above carries one; `01-02-CP` is the sole exception and is a blocking human package-legitimacy gate, which has no automatable equivalent by design
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — `scripts/smoke-theia.sh`, `scripts/smoke-firefox.sh`, and `.mozconfig` are all created by plan 01-01 Task 2, before any task depends on them
- [x] No watch-mode flags
- [x] Feedback latency < 60s for the quick check; full Firefox compile documented as manual-only above and planned as a single acceptance task (`01-03-T2`), not a per-commit gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-seeded 2026-08-20; `wave_0_complete` flips when plan 01-01 Task 2 lands.
