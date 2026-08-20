---
phase: 1
slug: build-infrastructure
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
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
| TBD | 01 | 0 | — | — | N/A | fixture | `test -x scripts/smoke-theia.sh && test -x scripts/smoke-firefox.sh` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BUILD-01 | — | N/A | smoke | `scripts/smoke-theia.sh` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BUILD-02 | — | N/A | smoke | `scripts/smoke-firefox.sh` | ❌ W0 | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for the quick check; full Firefox compile documented as manual-only above
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
