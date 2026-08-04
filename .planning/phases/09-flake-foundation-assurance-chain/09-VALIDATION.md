---
phase: 9
slug: flake-foundation-assurance-chain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 09-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | N/A — infrastructure phase; validation IS the CI pipeline (`nix flake check` + GitHub Actions jobs) |
| **Config file** | `flake.nix` (checks output) + `.github/workflows/*.yml` — neither exists yet (Wave 0) |
| **Quick run command** | `nix flake check` (on the NixOS dev host) |
| **Full suite command** | Complete GitHub Actions workflow run (all jobs incl. `windows-latest` + drift gate) |
| **Estimated runtime** | flake eval seconds; full nixosTest minutes; full CI run tens of minutes (windows-latest Tauri build dominates) |

Existing app-code gates (`npm test` via vitest, `scripts/verify-fonts.mjs`) run inside the `windows-latest` job — they validate application code, not this phase's own deliverables.

---

## Sampling Rate

- **After every task commit:** Run `nix flake check` (fast eval leg)
- **After every plan wave:** Full CI workflow run (push branch / PR) — all jobs plus drift gate
- **Before `/gsd-verify-work`:** A genuinely green end-to-end CI run PLUS a real Attic push/pull round-trip proving FOUND-01's "no compiling on a second machine" claim
- **Max feedback latency:** minutes locally; one CI round-trip per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FOUND-01 | — | Substrate closure pulled only from trusted substituter (signed narinfo) | integration | `nix develop -c true && nix build .#<substrate tarball output> --option substitute true` — build log shows zero local-build derivations | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FOUND-02 | — | Red run blocks cache publish (publish step gated on all checks green) | CI smoke | `nix flake check`; full workflow on a deliberately-broken PR proves red-blocks-publish | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FOUND-03 | — | Cache retention nonzero (GC on); push token scoped, held in GH secret | config + doc assertion | `attic cache info <cache>` shows nonzero retention; runbook file exists in repo | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*(Planner fills Task IDs when plans are authored.)*

---

## Wave 0 Requirements

- [ ] `flake.nix` — does not exist yet (repo has nothing Nix-shaped)
- [ ] `.github/workflows/*.yml` — does not exist yet
- [ ] `rust-toolchain.toml` + Node pin file — do not exist yet (both worlds currently float)
- [ ] The seed nixosTest (boot + placeholder loopback HTTP service) — does not exist yet
- [ ] A deployed, reachable Attic server (AWS EC2 + S3) — does not exist yet; FOUND-01's "no compiling" proof is necessarily a late-wave step

*Framework install: none — Nix's own tooling (`nix flake check`, nixosTest) is the framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clean second-machine clone → dev shell → cache-only substrate build | FOUND-01 | Needs a machine (or pristine checkout/user) without warm /nix/store paths | Fresh clone outside the dev tree, `nix develop`, build substrate image, inspect log: everything substituted from the Attic URL, nothing compiled |
| Runbook completeness review | FOUND-03 | Doc quality is not scriptable | Read the channel-maintenance runbook: bump cadence, red-channel response, retention policy, restore-from-scratch all present and actionable |
| Red-blocks-publish end-to-end | FOUND-02 | Requires a deliberate failure pushed to CI | Open a PR with a broken flake check (or failing test); confirm the publish/cache-push job does not run |
