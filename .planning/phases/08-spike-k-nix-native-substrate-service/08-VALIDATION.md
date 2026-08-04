---
phase: 8
slug: spike-k-nix-native-substrate-service
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` § Validation Architecture.

**Phase character:** this is a systemd/Nix configuration spike, not application code. There is
no unit-test framework and none should be installed. The "test framework" is the forensic
driver-script + log-grep pattern that `.planning/spikes/CONVENTIONS.md` makes binding
(`run.sh` → tee'd `run.log` + README Investigation Trail).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — shell-driven forensic verification per `.planning/spikes/CONVENTIONS.md` |
| **Config file** | `/etc/nixos/configuration.nix` inside the `SourcererSpike` distro (declarative end-state); systemd drop-ins during ladder exploration |
| **Quick run command** | `wsl.exe -d SourcererSpike -u root -- sh -c 'systemctl daemon-reload && systemctl restart coolwsd && sleep 2 && journalctl -u coolwsd -n 30 --no-pager'` |
| **Full suite command** | `wsl.exe -d SourcererSpike -u root -- nixos-rebuild switch` (declarative proof-pass, once per confirmed directive set) |
| **Estimated runtime** | ~5s per drop-in rung · ~110s per `nixos-rebuild switch` (spike 010 measured 109s) |

**Why drop-ins for the ladder:** at ~110s per rebuild, a 10+ rung hardening ladder costs
~20 min of pure rebuild wall-clock. `systemctl edit --stdin` drop-ins collapse each rung to
seconds. The final declarative pass exists to prove the exemption set survives the real
module-config form Phase 15's compiler will emit.

---

## Sampling Rate

- **Per ladder rung (drop-in iteration):** run the Quick run command — restart + `journalctl`
  grep. Max feedback latency ~5s.
- **Per confirmed exemption-set change:** re-run the discovery-endpoint curl to confirm the
  latest relaxation did not silently break reachability.
- **Per rung, mandatory:** the jail-degradation grep (see Manual-Only Verifications). A green
  restart is **not** a pass — `coolwsd` serves jail-less after logging a warning.
- **Phase gate:** one final `nixos-rebuild switch` with the exemption set expressed
  declaratively, plus the Windows-side curl + browser check (D-13), before the spike is
  marked VALIDATED.
- **Max feedback latency:** 5 seconds (drop-in rung) / 110 seconds (declarative pass).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-xx | 01 | 1 | SPIKE-01 | — | Substrate distro registered and warm; WSL version ≥ 2.7.11 | smoke | `wsl.exe -l -v` + `wsl.exe --version` | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-01-xx | 01 | 1 | SPIKE-01 | — | Unprivileged userns available (Open Q2) | smoke | `wsl.exe -d SourcererSpike -u root -- sysctl kernel.unprivileged_userns_clone` | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-02-xx | 02 | 2 | SPIKE-01 | — | Collabora substitutes from cache; nothing compiles | smoke | `nixos-rebuild switch --dry-run` — assert no `will be built:` entries, only `will be fetched:` | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-02-xx | 02 | 2 | SPIKE-01 | — | Service active under stock (unhardened) module | smoke | `systemctl is-active coolwsd` → `active` | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-03-xx | 03 | 3 | SPIKE-01 | — | Full §7 baseline applied and its failure captured | log-grep | `journalctl -u coolwsd -n 60 --no-pager` — grep `SIGSYS`, `Seccomp`, `Operation not permitted`, `Failed at step` | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-03-xx | 03 | 3 | SPIKE-01 | — | Each rung's relaxation recorded with directive + reason + observed signature | artifact | Investigation Trail row count ≥ rung count in `run.log` | ❌ — the deliverable | ⬜ pending |
| 8-03-xx | 03 | 3 | SPIKE-01 | — | Jail is real, not silently degraded | log-grep | grep -v the chroot-warning string; assert `adms_contained` telemetry | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-04-xx | 04 | 4 | SPIKE-01 | — | UI reachable on 127.0.0.1 from Windows host | smoke | (Windows, outside WSL) `curl.exe -sf http://127.0.0.1:9980/hosting/discovery` | ❌ W0 (`run.sh`) | ⬜ pending |
| 8-04-xx | 04 | 4 | SPIKE-01 | — | Exemption set survives a real declarative rebuild | full | `nixos-rebuild switch` then re-assert all of the above | ❌ W0 (`run.sh`) | ⬜ pending |

*Task IDs are placeholders until the planner assigns them; the planner MUST map each plan's
tasks onto these rows.*
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/spikes/012-nix-native-substrate-service/run.sh` — the driver script, descended
      from `.planning/spikes/010-nixos-wsl-substrate/run.sh`. Carries the assertions above as
      shell checks with explicit exit codes. Must apply CONVENTIONS.md system rules:
      `export WSL_UTF8=1`, wrap absolute Linux paths in `sh -c '...'`, check `PIPESTATUS[0]`
      never a piped command's exit code.
- [ ] A pre-flight sysctl check (`kernel.unprivileged_userns_clone`) as the driver's **first**
      coolwsd-relevant step, per RESEARCH Open Question 2 — it distinguishes "coolwsd vs
      hardening" from "WSL2 kernel gap", and the entire spike's evidence value depends on that
      distinction.
- [ ] No framework install. `curl`, `journalctl`, `systemctl`, `nixos-rebuild`, `systemd-analyze`
      all ship in the substrate / on the Windows box already.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collabora UI renders in a browser on the Windows host | SPIKE-01 (SC-3) | D-13 sets the bar as "curl + browser"; a rendered editor surface cannot be asserted by curl alone | Open `http://127.0.0.1:9980/` in a Windows browser; confirm the Collabora welcome/discovery surface loads, not a connection error |
| Exemption set is legible to a reader with no memory of this session | SPIKE-01 (SC-4) | Phase 15 and Phase 19 are the consumers and are many phases downstream; legibility is a human judgement | Read the README Investigation Trail cold: each row must name the directive, the observed failure signature, the concession made, and *why* — no row may say only "didn't work" |
| Jail degradation did not go unnoticed | SPIKE-01 (SC-2) | `coolwsd` logs a warning and keeps serving jail-less; a green curl masks it | For every recorded rung, confirm the log excerpt in the trail shows jail state explicitly, not just service-active |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a Wave 0 dependency on `run.sh`
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references (`run.sh` + sysctl pre-flight)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s per ladder rung
- [ ] Every ladder rung produced a trail row (rung count == trail row count)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
