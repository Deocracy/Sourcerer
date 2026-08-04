# Requirements — Milestone v2.0 Container Platform

Source: `.planning/research/CONTAINER-PLATFORM-PLAN.md` (verifier-revised) + `CONTAINER-PLATFORM.md`. Decisions D-P1…D-P5 answered 2026-08-03 (see PROJECT.md Key Decisions). Two-host milestone: every requirement's UAT states its execution host (NixOS dev box or Windows/WSL box).

## v2.0 Requirements

### Spike remainder (P0)

- [ ] **SPIKE-01**: Spike K validated on the Windows box — a digest-pinned Collabora image runs as an engine-less systemd unit (`RootDirectory=`/nspawn) inside the substrate distro, web UI reachable on 127.0.0.1 (re-import NixOS-WSL 2605.7.2 image first; local copy deleted 2026-08-03, sha256 recorded in spike 010 README)

### Foundation & assurance chain (FOUND)

- [ ] **FOUND-01**: Developer can clone the repo on a second machine, enter the dev shell, and build the substrate image from the binary cache without compiling
- [ ] **FOUND-02**: A red CI run (flake check, seed nixosTest, `windows-latest` Tauri job) blocks any publish
- [ ] **FOUND-03**: Binary-cache hosting is decided, costed, and documented with a channel-maintenance runbook (cache is a production service from P2b on)

### Substrate provisioning (SUB)

- [ ] **SUB-01**: A non-technical user on a clean Windows 11 machine gets a working substrate with ≤3 interactions, zero terminal exposure, ≤10 min excluding downloads, at most one reboot
- [ ] **SUB-02**: User data lives on a separate mount from the system image; distro re-import preserves it
- [ ] **SUB-03**: No shell code reaches the substrate except via the substrate-connection transport seam, whose interface includes the auth surface (implementation stubbed)
- [ ] **SUB-04**: User can kill the substrate via a kill switch
- [ ] **SUB-05**: Secrets plumbing works end-to-end (sops-nix at rest + systemd LoadCredential) — mechanism only
- [ ] **SUB-06**: A real `security.csp` ships (the v1.0 `csp: null` acceptance expires by construction with multiwebview panes)

### Update channel (UPD)

- [ ] **UPD-01**: A deliberately broken publish is caught by CI and never reaches a user machine
- [ ] **UPD-02**: User can revert a bad-but-published update with one button (`--rollback`)
- [ ] **UPD-03**: Generations are bounded on disk (`nix.gc.automatic` + retention policy)

### Distribution (DIST)

- [ ] **DIST-01**: Microsoft Store (MSIX) install works on clean hardware, or spike J failure triggers the explicit v1 descope to site-only
- [ ] **DIST-02**: Signed site installer (EV / Azure Trusted Signing) installs on clean hardware with no SmartScreen wall

### Engine in substrate (ENG)

- [ ] **ENG-01**: Databasise engine runs inside the substrate; REST + MCP answer on loopback with a substrate-integration nixosTest gate green. (LightRAG is no longer a live dependency — it was disassembled into Databasise's own code; only vendored remnants remain, nothing to package separately. OCR is NOT part of the engine closure — it ships later as an installable applet through the app layer.)
- [ ] **ENG-02**: Assistant harness runs substrate-side with the `host.ai()` seam unchanged applet-side; Windows-side Python sidecar retired
- [ ] **ENG-03**: A wiki read-view applet renders live Databasise data through the seam (first engine-backed applet slice)
- [ ] **ENG-04**: User can see a substrate status panel (services, versions, current generation)

### App layer (APP)

- [ ] **APP-01**: Manifest schema v1 + manifest→NixOS-module compiler produce one hardened systemd unit per app, native and OCI alike (OCI via `dockerTools.pullImage` rootfs + `RootDirectory=`/nspawn per spike K); headless CLI install path exists
- [ ] **APP-02**: User can install Collabora from the catalog, edit a document in a pane (multiwebview per spike 011), uninstall, and a generation rollback restores the prior app set
- [ ] **APP-03**: A `network:none` app demonstrably cannot reach the internet (asserted via the unit's netns) and a unit's `MemoryMax` demonstrably binds
- [ ] **APP-04**: User sees a computed security score at install time that honestly reflects nspawn/systemd depth

### Community store (STORE)

- [ ] **STORE-01**: A package authored by a pinned-model + fixed-prompt fixture passes the submission pipeline end-to-end unattended (validate → OCI-unit normalize → build module → boot nixosTest → score → cosign-sign)
- [ ] **STORE-02**: Unsigned, score-floored, tag-pinned, or privileged/docker-api-class submissions auto-reject (D-P2, no appeal in v1); substrate verifies signatures before ingesting images
- [ ] **STORE-03**: Store ops runbook + automation exists (CVE re-scans of approved images, digest re-pin cadence, submission triage)
- [ ] **STORE-04**: The store format ships but is not publicly opened until the P8 hardening gate passes

### Tools tier & portability (TOOLS)

- [ ] **TOOLS-01**: User can export their environment on machine A and import on a clean machine B, reconstructing a byte-identical closure and working environment ("Move to another PC" wizard)
- [ ] **TOOLS-02**: Tool installs (`nix profile` tier against the pinned flake) never rebuild the system; per-tool rollback works; floating-ref installs are impossible by construction

### Permission grants (GRANT)

- [ ] **GRANT-01**: User can view and revoke per-app grants (network, mounts, secrets) and revocation takes effect without reinstall
- [ ] **GRANT-02**: A portal-style runtime folder grant is scoped to exactly the picked path (no-parent-access test); grants are never install-time
- [ ] **GRANT-03**: Agent tools run as their own DynamicUser units — the unit file is the grant; the agent cannot invoke a tool whose unit doesn't exist

### Hardening close (HARD)

- [ ] **HARD-01**: An exposure-score threshold runs as a CI gate on all compiled units; `systemd-analyze security` audit of the OCI-unit fleet passes with the documented exemption set
- [ ] **HARD-02**: The store-opening decision is made on audit evidence and `/gsd-audit-milestone` runs for v2.0

## Future Requirements (deferred to Platform v2 / Cloud)

- OCR ingest as an installable applet — a Nix-packaged app delivered through the v2.0 app layer/catalog, surfaced as an applet in the GUI; not part of the engine closure
- macOS substrate (vfkit/microvm.nix, site DMG, MAS stretch) — P9
- Linux channel (tarball/AppImage + `nix run`) — P9
- WASM tier, per-applet webviews, streamed native Linux apps, filtering proxy — P10–P13
- GPU/compute routing (`gpu` manifest key, DeviceAllow, Metal/remote) — P14, consumes spike B
- Hosted cloud (auth impl, browser client, per-tenant substrate, billing) — Cloud milestone, committed (D-P5)

## Out of Scope

- Any container engine in the substrate (Podman/Docker dropped 2026-08-02 — engine-less OCI units only)
- gVisor runtime tier (deferred with Podman; revisit on threat-model change)
- Multi-container compose apps (deferred or curated Nix-native); compose = deferred single-container compat tier
- Nested Hyper-V hostile-agent tier; generic environments-platform productization
- React 19/Compiler; Power Browser rework; Databasise engine features (own roadmap)
- Secrets rotation (v1 = single cosign key, explicit)

## Traceability

(Filled by roadmap.)
