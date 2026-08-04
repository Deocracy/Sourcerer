# Roadmap: Sourcerer (Desktop Shell)

## Milestones

- ✅ **v1.0 Desktop Shell MVP** — Phases 1-7 (shipped 2026-07-14) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Container Platform** — Phases 8-19 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (8, 9, 10…): Planned milestone work, continuing from v1.0's Phase 7
- Decimal phases (10.1, 10.2): Urgent insertions (marked with INSERTED)

Each v2.0 phase carries its original P-label from `.planning/research/CONTAINER-PLATFORM-PLAN.md` for traceability.

<details>
<summary>✅ v1.0 Desktop Shell MVP (Phases 1-7) — SHIPPED 2026-07-14</summary>

- [x] Phase 1: Shell Foundation (3/3 plans) — completed 2026-07-07
- [x] Phase 2: Workspace Core (6/6 plans) — completed 2026-07-08
- [x] Phase 3: Persistence & Layouts (5/5 plans) — completed 2026-07-10
- [x] Phase 4: Applet Framework (5/5 plans) — completed 2026-07-10
- [x] Phase 5: Notes Applet (2/2 plans) — completed 2026-07-13
- [x] Phase 6: Dashboard Assistant & Home (8/8 plans, incl. 2 UAT gap-closure) — completed 2026-07-14
- [x] Phase 7: Assistant Harness Core (6/6 plans) — completed 2026-07-08

Full phase details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v2.0 Container Platform (In Progress)

**Milestone Goal:** A non-technical scholar on a clean Windows 11 machine installs Sourcerer from the Microsoft Store (or signed site installer), gets a working NixOS-WSL substrate after at most one reboot, sees engine-backed functionality live, installs catalog apps as hardened engine-less OCI units with visible security scores, reverts a bad update with one button, and migrates their whole environment to a second PC via manifest + data export.

- [ ] **Phase 8: Spike K — Engine-less OCI Unit** *(P0 remainder)* - Digest-pinned Collabora runs as a systemd `RootDirectory=`/nspawn unit inside the substrate distro
- [ ] **Phase 9: Flake Foundation & Assurance Chain** *(P1)* - Repo-root flake, CI, binary cache — nothing publishes that CI didn't prove
- [ ] **Phase 10: Substrate Provisioning & Warden Seam** *(P2)* - Clean Windows machine → working substrate in ≤1 reboot, behind a transport seam, with a real CSP
- [ ] **Phase 11: Update Channel & Revert** *(P2b)* - CI-gated channel publishes, one-button rollback, bounded generations
- [ ] **Phase 12: Distribution Packaging** *(P2c)* - Microsoft Store (MSIX) and/or signed site installer on clean hardware
- [ ] **Phase 13: Engine Services in Substrate** *(P3a — Track 2, Databasise repo)* - Databasise packaged as a hardened NixOS module answering REST + MCP on loopback
- [ ] **Phase 14: Harness Relocation & First Engine-Backed Applet** *(P3b)* - Assistant runs substrate-side; a wiki read-view renders live engine data
- [ ] **Phase 15: App Layer v1** *(P4)* - Manifest→NixOS-module compiler, catalog apps in panes, enforced permissions, visible security scores
- [ ] **Phase 16: Community Store Pipeline** *(P5 — Track 2, store repo)* - Signed, CVE-gated, unattended submission pipeline (not publicly opened until Phase 19)
- [ ] **Phase 17: Tools Tier & Environment Portability** *(P6)* - `nix profile` tool tier and a "Move to another PC" export/import wizard
- [ ] **Phase 18: Permission Grants UI & Portal File Access** *(P7)* - View/revoke per-app grants; runtime folder grants scoped to the picked path
- [ ] **Phase 19: Hardening Close & Milestone Audit** *(P8)* - Exposure-score CI gate, OCI-fleet security audit, store-opening decision, milestone audit

## Phase Details

### Phase 8: Spike K — Engine-less OCI Unit
**Original plan label**: P0 (spike battery remainder — the last pending spike)
**Goal**: Prove that a real-world OCI image runs under plain systemd confinement without a container engine's compatibility shims, before Phase 15 commits to that mechanic
**Depends on**: Nothing (v1.0 complete; spikes 010/011 already validated)
**Execution host**: **Windows box** — the substrate distro lives in WSL2. Re-import NixOS-WSL 2605.7.2 first (local image deleted 2026-08-03; verify sha256 `e7180ad555fdcb8e1e057e2ef056de467603a5e502ff8531053738371be3f6b9` recorded in `spikes/010-nixos-wsl-substrate/README.md`); re-verify the `SourcererSpike` distro is registered and warm, otherwise budget the re-import leg.
**Requirements**: SPIKE-01
**Success Criteria** (what must be TRUE):
  1. A digest-pinned Collabora CODE image is ingested into the Nix store via `dockerTools.pullImage` and unpacked as a rootfs derivation
  2. That rootfs runs as a systemd unit inside the substrate distro (`RootDirectory=` first, `systemd-nspawn --oci-bundle` as the internal fallback)
  3. The Collabora web UI is reachable on 127.0.0.1 from the Windows host
  4. The findings (users, /proc, tmpfs, entrypoint env handling) are recorded so Phase 15's compiler can be written against evidence, not guesswork
**Notes**: Fallback ladder is internal — `RootDirectory=` → nspawn `--oci-bundle`. Only if both fail for real-world images does the (currently closed) engine decision reopen, and only with evidence.
**Plans**: TBD

### Phase 9: Flake Foundation & Assurance Chain
**Original plan label**: P1 · size M
**Goal**: One flake and one CI pipeline that both build worlds read, so nothing reaches a user machine that CI did not prove
**Depends on**: Phase 8 (informs nothing structurally, but K's findings land before the flake's app-unit skeleton)
**Execution host**: **NixOS dev host** (flake authoring, devShells, cache wiring). CI runs on GitHub Actions; the `windows-latest` Tauri job is the standing regression net between hands-on Windows sessions.
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. A developer clones the repo on a second machine, enters the dev shell, and builds the substrate image entirely from the binary cache with no compiling
  2. A red CI run (flake check, seed nixosTest, or `windows-latest` Tauri job) blocks publish
  3. Binary-cache hosting is chosen and costed, with a written channel-maintenance runbook
  4. Shared version pins exist that both the Nix world and the conventional Windows Tauri build read
**Notes**: The cache becomes a **production service** from Phase 11 on — Cachix free (5 GB) will not hold an ML-stack closure across versions; budget paid Cachix or Attic-on-VPS from the start. Keep CI trivially portable (plain GH Actions + swappable cache) — Garnix died July 2026.
**Descope trigger**: none — assembly only; novelty found here is itself a finding.
**Plans**: TBD

### Phase 10: Substrate Provisioning & Warden Seam
**Original plan label**: P2 · size M
**Goal**: A non-technical user on a clean Windows 11 machine ends up with a working, killable substrate that the shell only ever touches through one seam
**Depends on**: Phase 9
**Execution host**: **Windows box** — provisioning UAT requires clean Windows 11 hardware, elevated `wsl --install`, and a physical reboot. Image build and seam code are authored on the NixOS dev host.
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06
**Success Criteria** (what must be TRUE):
  1. A clean Windows 11 machine reaches a working substrate in ≤3 interactions, zero terminal exposure, ≤10 min excluding downloads, and at most one reboot
  2. User data survives a distro re-import (it lives on a separate mount from the system image)
  3. No shell code reaches the substrate except through the substrate-connection transport seam, whose interface includes the auth surface (implementation stubbed)
  4. The user can kill the substrate from a kill switch in the shell
  5. Secrets flow end-to-end via sops-nix at rest + systemd `LoadCredential`, and the app ships a real `security.csp`
**Notes**: **The v1.0 `csp: null` acceptance expires here by construction** — `src-tauri/tauri.conf.json` still reads `"csp": null`, and multiwebview panes plus container-served UIs break the written condition Phase 1 accepted it under. Carry spike 010's landmines: pre-create the distro storage parent before `wsl --import`; enforce a minimum WSL version (2605 images fail on WSL 2.3.26, fine on 2.7.11); drive `wsl --update` through an explicit elevated flow (stalls invisibly behind UAC; concurrent paths collide with error 1618). BIOS-virtualization-off is the one unfixable failure → guided help screen.
**Descope trigger**: provisioning UX unachievable in bounds → guided semi-manual first-run accepted for v1, tracked as debt.
**Plans**: TBD
**UI hint**: yes

### Phase 11: Update Channel & Revert
**Original plan label**: P2b · size M
**Goal**: Users get updates that CI proved, and can undo a bad one with a single button
**Depends on**: Phase 10
**Execution host**: **NixOS dev host** for channel/CI mechanics; **Windows box** for the live switch/rollback UAT inside the real substrate.
**Requirements**: UPD-01, UPD-02, UPD-03
**Success Criteria** (what must be TRUE):
  1. A deliberately broken publish is caught by CI and never reaches a user machine
  2. A bad-but-published update is reverted by one visible "Revert last update" button (`--rollback`)
  3. Generations stay bounded on disk via `nix.gc.automatic` plus a retention policy
**Notes**: Consumes spike A's extended updater leg (measured: externally-driven `nixos-rebuild switch` 109 s, rollback 6 s). Phase 9's channel-maintenance runbook becomes practice here. Binary cache is a production service from this phase on.
**Descope trigger**: app-driven switch proves unreliable despite spike A → adopt comin (pull-based prior art) instead of in-app orchestration.
**Plans**: TBD
**UI hint**: yes

### Phase 12: Distribution Packaging
**Original plan label**: P2c · size S–M
**Goal**: The install claim is literal — a real user installs from the Microsoft Store or a signed site download without hitting a SmartScreen wall
**Depends on**: Phase 11
**Execution host**: **Windows box** — MSIX packaging, Partner Center identity, Windows code signing, and clean-hardware install tests are all Windows-only. Spike J (MSIX driving elevated `wsl --install` + reboot-resume + `wsl --import` from package context) runs here first and sets this phase's shape.
**Requirements**: DIST-01, DIST-02
**Success Criteria** (what must be TRUE):
  1. Either a Microsoft Store (MSIX) install succeeds on clean hardware, or spike J's failure triggers the explicit, documented v1 descope to site-only
  2. A signed site installer (EV cert / Azure Trusted Signing) installs on clean hardware with no SmartScreen wall
  3. The end-state install wording in PROJECT.md matches whichever channel actually shipped
**Notes**: Windows code signing is a real standing cost line item — without it the non-technical promise dies off-Store. Store certification queues are measured in days; this phase is wait-dominated.
**Descope trigger**: Store certification stalls > 2 iterations → ship site-signed, queue Store as follow-up milestone work, update the end-state wording honestly.
**Plans**: TBD

### Phase 13: Engine Services in Substrate
**Original plan label**: P3a · size L · **Track 2 — separate repo (Databasise), runs parallel to Phases 10/11**
**Goal**: The Databasise engine runs inside the substrate as a hardened NixOS module, proving the first "app" (a trusted one, ours) through every seam before untrusted code arrives
**Depends on**: Phase 9 (flake + CI); parallel to Phases 10-11, joins the shell track at Phase 14
**Execution host**: **NixOS dev host** — Nix packaging and nixosTest (QEMU) are native here. One thin real-WSL smoke test runs on the Windows box, since nixosTest boots QEMU-NixOS, not WSL.
**Requirements**: ENG-01
**Success Criteria** (what must be TRUE):
  1. Databasise is packaged as a NixOS module with the §7 hardening baseline and starts inside the substrate
  2. REST and MCP answer on loopback inside the substrate
  3. A substrate-integration nixosTest asserts the engine endpoints and goes green; endpoint-contract breakage fails CI
**Notes**: **LightRAG is NOT a separate dependency** — it was disassembled into Databasise's own code; only vendored remnants remain, nothing to package separately. **OCR is NOT part of the engine closure** — it ships later as an installable applet through the Phase 15 app layer. Track 2 lives in the Databasise repo, so the no-worktrees rule (which binds only the shell tree) does not serialize it.
**Descope trigger** (mandatory): any component fighting uv2nix > 3 days → run it as a digest-pinned engine-less OCI unit, no appeal.
**Plans**: TBD

### Phase 14: Harness Relocation & First Engine-Backed Applet
**Original plan label**: P3b · size L-
**Goal**: Everything the user already had keeps working with the engine and harness substrate-side, and the first live engine-backed data appears in an applet
**Depends on**: Phase 10 (seam) + Phase 13 (engine) — this is where the two tracks join
**Execution host**: **Windows box** — the harness and engine now run inside the WSL substrate; the applet/assistant UAT exercises the live substrate.
**Requirements**: ENG-02, ENG-03, ENG-04
**Success Criteria** (what must be TRUE):
  1. All existing applet and assistant functionality works with the harness running substrate-side, with `host.ai()` unchanged applet-side
  2. The Windows-side Python sidecar is retired
  3. A wiki read-view applet renders live Databasise data through the seam
  4. The user can open a substrate status panel showing services, versions, and the current generation
**Notes**: Re-read the `phase02-phase07-ownership-boundary` memory before planning this phase. The status panel deliberately pulls a Phase 18 slice forward — it is the cheapest visible value and the debugging UI every later phase wants.
**Descope trigger**: harness relocation destabilizes assistant UX → harness stays host-side one more phase (the seam permits it), relocation re-queued; the wiki slice ships regardless.
**Plans**: TBD
**UI hint**: yes

### Phase 15: App Layer v1
**Original plan label**: P4 · size L
**Goal**: A user installs a real app from the catalog, uses it in a pane, and the permissions it declared are actually enforced by the kernel
**Depends on**: Phase 12 (shell track) + Phase 14 (engine proved through the seams)
**Execution host**: **NixOS dev host** for the manifest schema, compiler, and enforcement tests (nixosTest asserts netns and `MemoryMax`); **Windows box** for the pane UAT — including spike 011's still-open fractional-DPI retest (its `spike011-multiwebview.exe` was preserved for exactly this).
**Requirements**: APP-01, APP-02, APP-03, APP-04
**Success Criteria** (what must be TRUE):
  1. A manifest (identity, UI port, permissions, resources, autostart) compiles to one hardened systemd unit for native and OCI apps alike, with OCI apps as `dockerTools.pullImage` rootfs run via `RootDirectory=`/nspawn per Phase 8; a headless CLI install path exists
  2. The user installs Collabora from the catalog, edits a document in a pane, uninstalls, and a generation rollback restores the prior app set
  3. A `network:none` app demonstrably cannot reach the internet (asserted via the unit's netns) and a unit's `MemoryMax` demonstrably binds
  4. The user sees a computed security score at install time that honestly reflects nspawn/systemd depth (not gVisor)
**Notes**: Structurally pre-ordered — **compiler and enforcement waves complete and are testable BEFORE any UI wave**. `gpu` is EXCLUDED from the v1 manifest schema (deferred to Platform v2's P14). Collabora's WOPI host is a real plan item, not a parenthetical. Runtime `docker pull` UX is intentionally gone: app install/update is a cached rebuild — a download, given Phase 9's cache.
**Descope trigger**: an important real-world image resists `RootDirectory=` confinement → nspawn `--oci-bundle` per app; if a whole class resists both, that class waits for the deferred compat tier rather than reintroducing an engine ad hoc.
**Plans**: TBD
**UI hint**: yes

### Phase 16: Community Store Pipeline
**Original plan label**: P5 · size M · **Track 2 — separate repo, runs parallel to Phases 17/18**
**Goal**: A community-authored package can go from submission to signed, CVE-scanned, boot-tested artifact without a human in the loop
**Depends on**: Phase 15 (reuses its compiler wholesale — that reuse is the M sizing condition)
**Execution host**: **NixOS dev host** — store repo, submission CI, nixosTest, cosign signing.
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04
**Success Criteria** (what must be TRUE):
  1. A package authored by a pinned-model + fixed-prompt fixture passes the pipeline end-to-end unattended: validate → OCI-unit normalize → build module → boot nixosTest → score → cosign-sign
  2. Unsigned, score-floored, tag-pinned, and privileged/docker-api-class submissions auto-reject, and the substrate verifies signatures before ingesting an image
  3. A store ops runbook plus automation exists for CVE re-scans of approved images, digest re-pin cadence, and submission triage
  4. The store format ships but is **not publicly opened** — opening waits on Phase 19's audit
**Notes**: D-P2 stands — privileged/docker-api-class submissions are auto-rejected with no appeal in v1. Single cosign key, no rotation in v1 (explicit). OCI-unit normalization fixes entrypoint/cmd/env/healthcheck semantics **at submission time**, never interpreted at runtime. Compose is a deferred single-container compatibility tier; multi-container compose apps are deferred or arrive curated Nix-native.
**Descope trigger** (mandatory): pipeline can't pass the LLM fixture unattended → v1 descopes to a first-party-curated catalog only; community store moves to Platform v2.
**Plans**: TBD

### Phase 17: Tools Tier & Environment Portability
**Original plan label**: P6 · size M
**Goal**: The portability thesis becomes a product feature — the user moves their whole environment to another PC, and installs tools without ever rebuilding the system
**Depends on**: Phase 15
**Execution host**: **Windows box** — the export/import proof needs machine A and a clean machine B, both real Windows hosts with the substrate.
**Requirements**: TOOLS-01, TOOLS-02
**Success Criteria** (what must be TRUE):
  1. The user exports their environment on machine A and imports it on a clean machine B, reconstructing a byte-identical closure and a working environment via the "Move to another PC" wizard
  2. Tool installs (`nix profile` against the pinned flake) never rebuild the system, and per-tool rollback works from the UI
  3. Floating-ref installs are impossible by construction — the profile tier only ever resolves against the Sourcerer-pinned flake
**Notes**: This is where spike D gets validated naturally (it was guessed with a recorded fallback in P0). The installed-profile list is exported into the manifest, so "roll back my environment" includes which tools were installed.
**Descope trigger**: none expected (D's mechanics are sound); wizard polish can trail.
**Plans**: TBD
**UI hint**: yes

### Phase 18: Permission Grants UI & Portal File Access
**Original plan label**: P7 · size M
**Goal**: The user can see and take back what each app is allowed to do, and file access is granted by picking a file rather than by an install-time flag
**Depends on**: Phase 17
**Execution host**: **NixOS dev host** for grant compilation and the no-parent-access test; **Windows box** for live revoke-without-reinstall UAT against the running substrate.
**Requirements**: GRANT-01, GRANT-02, GRANT-03
**Success Criteria** (what must be TRUE):
  1. The user views and revokes per-app grants (network, mounts, secrets) from a grants panel, and revocation takes effect without reinstalling the app
  2. A portal-style runtime folder grant is scoped to exactly the picked path — a no-parent-access test proves it — and grants are never install-time
  3. Agent tools run as their own DynamicUser units, so the unit file IS the grant and the agent cannot invoke a tool whose unit doesn't exist
**Notes**: GPU grants are removed from this panel until §6 lands in Platform v2. Secrets grants sit on top of Phase 10's plumbing; per-app activity visibility extends Phase 14's status panel.
**Descope trigger**: portal-mount UX too rough → v1 falls back to brokered copy-in/copy-out for user files, tracked as debt.
**Plans**: TBD
**UI hint**: yes

### Phase 19: Hardening Close & Milestone Audit
**Original plan label**: P8 · size M
**Goal**: Every unit that ships is proved hardened, and the decision to open the community store is made on audit evidence rather than optimism
**Depends on**: Phase 18 (shell track) + Phase 16 (store format must exist to decide on opening it)
**Execution host**: **Windows box** for the hardening UAT and `systemd-analyze security` sweep of the live OCI-unit fleet inside the real substrate; **NixOS dev host** for the CI gate and audit artifacts.
**Requirements**: HARD-01, HARD-02
**Success Criteria** (what must be TRUE):
  1. An exposure-score threshold runs as a CI gate on all compiled units, and no unit ships above it
  2. A `systemd-analyze security` audit of the OCI-unit fleet passes with a documented exemption set (agent harness, nspawn-launcher units)
  3. The store-opening decision is made on that evidence — open publicly, or hold — and the WSL2 shared-kernel caveat appears in user-facing security notes
  4. `/gsd-audit-milestone` runs for v2.0 and produces an artifact
**Notes**: This phase IS the descope checkpoint — no descope trigger of its own. The security score must honestly reflect nspawn/systemd + VM-boundary depth; gVisor's syscall-interception tier is deferred, revisited only on threat-model change. Carried debt worth settling before this gate: `/gsd-secure-phase` never ran for Phases 02-07 (only `01-SECURITY.md` exists), and `workflow.security_enforcement` is currently `false` in config.json.
**Plans**: TBD

## Progress

**Execution Order:**
Track 1 (shell tree, serial): 8 → 9 → 10 → 11 → 12 → 15 → 17 → 18 → 19
Track 2 (separate repos, parallel): 13 alongside 10/11 · 16 alongside 17/18
Join points: 14 needs 10 + 13 · 19 needs 18 + 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Shell Foundation | v1.0 | 3/3 | Complete | 2026-07-07 |
| 2. Workspace Core | v1.0 | 6/6 | Complete | 2026-07-08 |
| 3. Persistence & Layouts | v1.0 | 5/5 | Complete | 2026-07-10 |
| 4. Applet Framework | v1.0 | 5/5 | Complete | 2026-07-10 |
| 5. Notes Applet | v1.0 | 2/2 | Complete | 2026-07-13 |
| 6. Dashboard Assistant & Home | v1.0 | 8/8 | Complete | 2026-07-14 |
| 7. Assistant Harness Core | v1.0 | 6/6 | Complete | 2026-07-08 |
| 8. Spike K — Engine-less OCI Unit | v2.0 | 0/TBD | Not started | - |
| 9. Flake Foundation & Assurance Chain | v2.0 | 0/TBD | Not started | - |
| 10. Substrate Provisioning & Warden Seam | v2.0 | 0/TBD | Not started | - |
| 11. Update Channel & Revert | v2.0 | 0/TBD | Not started | - |
| 12. Distribution Packaging | v2.0 | 0/TBD | Not started | - |
| 13. Engine Services in Substrate | v2.0 | 0/TBD | Not started | - |
| 14. Harness Relocation & First Engine-Backed Applet | v2.0 | 0/TBD | Not started | - |
| 15. App Layer v1 | v2.0 | 0/TBD | Not started | - |
| 16. Community Store Pipeline | v2.0 | 0/TBD | Not started | - |
| 17. Tools Tier & Environment Portability | v2.0 | 0/TBD | Not started | - |
| 18. Permission Grants UI & Portal File Access | v2.0 | 0/TBD | Not started | - |
| 19. Hardening Close & Milestone Audit | v2.0 | 0/TBD | Not started | - |

---
*v2.0 phase structure derived from `.planning/research/CONTAINER-PLATFORM-PLAN.md` (verifier-revised 2026-08-02) with the host-reality decision of 2026-08-03 applied — every phase states its execution host. Calendar note: unlike v1.0's in-editor phases, this milestone is wait-dominated (30–90 min closure builds, physical reboot UAT, clean-machine tests, Store certification queues measured in days). Plan counts hold; wall-clock roughly doubles.*
