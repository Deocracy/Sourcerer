---
spike: 010
name: nixos-wsl-substrate
type: standard
validates: "Given the prebuilt NixOS-WSL 2605.7.2 image, when imported as a private custom-named WSL distro and driven entirely via wsl.exe, then it boots, applies a config change with nixos-rebuild switch, and reverts it with --rollback — no terminal interaction inside the guest"
verdict: VALIDATED
related: [011-tauri-multiwebview]
tags: [nixos-wsl, substrate, wsl, updater, rollback, container-platform, spike-A]
---

# Spike 010: NixOS-WSL Substrate Mechanics (Container Platform "spike A-lite")

## What This Validates

Given the prebuilt NixOS-WSL release image, when `wsl --import`-ed under a private name
("SourcererSpike", stored on D:) and driven **only from the Windows side via `wsl.exe`**
(the way the Sourcerer shell would drive it), then:

1. Import + first boot work without any in-guest interaction.
2. A configuration change (`environment.systemPackages` += `hello`) applies via
   externally-driven `nixos-rebuild switch`.
3. `nixos-rebuild switch --rollback` reverts it (the "Revert last update" button mechanism).
4. Generations are enumerable (the UI's rollback list).
5. `wsl --terminate` + next command = clean auto-restart (kill-switch / on-demand model).

This is the mechanism every phase of `.planning/research/CONTAINER-PLATFORM-PLAN.md` stands on
(P2/P2b). Descoped from the plan's full spike A by user decision (guess-with-fallbacks):
Podman/Collabora/pane legs — routine, validated indirectly by ecosystem evidence; the pane
mechanism is spike 011.

## Research

Session research (2026-08-02, `.planning/research/CONTAINER-PLATFORM.md` §3/§4): NixOS-WSL
actively maintained; custom-name import officially supported (`wsl --import <name> <loc> <img>`);
this machine runs WSL 2.3.26 → `--import` (not 2.4.4+ `--from-file`). Release used:
**2605.7.2 "Yearning Yarara"** (current at spike time; newer than the research doc's 2511.7.1
anchor — the 2605 line the research predicted). sha256-verified download.

Known risks probed: NixOS-WSL first-boot activation quirks; whether `nixos-rebuild` works
non-interactively via `wsl -d <name> -u root`; UTF-16 output from wsl.exe (mitigate WSL_UTF8=1).

## How to Run

```bash
# from this directory; nixos.wsl in ./dist/ (sha256-verified)
wsl --import SourcererSpike D:\\WSL\\SourcererSpike dist\\nixos.wsl --version 2
wsl -d SourcererSpike -- echo boot-ok
# ... see Investigation Trail for the exact driven sequence
wsl --unregister SourcererSpike   # full cleanup
```

## What to Expect

Import completes in seconds-to-minutes; first command boots the distro; `hello` absent →
rebuild → present → rollback → absent; generation list grows then activates the prior one;
total wall-clock (excluding download) inside the ≤10-min UX budget.

## Investigation Trail

- **Attempt 1 (18:08):** every step failed cascading from step 1 `Wsl/ERROR_PATH_NOT_FOUND`.
  Root cause: `wsl --import <name> D:\WSL\SourcererSpike <img>` does **NOT create the parent
  directory** — `D:\WSL` didn't exist. Product lesson for plan P2: the shell installer must
  create the storage directory before import; the raw WSL error is opaque enough that a
  non-technical user could never self-diagnose it. Also confirmed: spaces in the image path
  (`D:\Vibe Coding\...`) were NOT the problem (error persisted path-side, arg passed intact).
- **Attempt 2 (18:09):** with the parent dir created, **import succeeded** (36s, 2.7 GB
  ext4.vhdx) but every boot failed `Wsl/Service/E_UNEXPECTED "Catastrophic failure"` in ~3s.
  Hypothesis: WSL 2.3.26 (late-2024 vintage) too old for the 2605.7.2 image.
- **WSL update interlude:** plain `wsl --update` (Store path) hung silently ~8 min — it was
  waiting on a **UAC elevation prompt the user had to approve on-screen**; a parallel
  `--web-download` attempt failed 1618 (installer already in progress) until the Store install
  finished. WSL 2.3.26 → **2.7.11**. Product lessons for P2: (a) the installer must enforce a
  **minimum WSL version**, not just presence — the failure mode on old WSL is an opaque
  "Catastrophic failure" no scholar could diagnose; (b) `wsl --update` requires elevation and
  can stall invisibly behind UAC — the shell must drive it with an explicit elevated flow and
  progress UI, never fire-and-forget.
- **Attempt 3 (post-update):** same already-imported distro booted `boot-ok` on 2.7.11 —
  hypothesis CONFIRMED (image was fine; WSL was old). Unregistered and re-ran the full driver
  clean for honest end-to-end timings.

## Source image provenance

NixOS-WSL 2605.7.2 "Yearning Yarara" — `github.com/nix-community/NixOS-WSL` releases,
asset `nixos.wsl`, sha256
`e7180ad555fdcb8e1e057e2ef056de467603a5e502ff8531053738371be3f6b9`.

The local `dist/nixos.wsl` (551 MB) was **deleted 2026-08-03** during the
Windows→NixOS migration cleanup; `dist/` is gitignored, so neither the blob nor its
`.sha256` sidecar was ever in git. Re-download and verify against the hash above if the
WSL substrate work resumes on a Windows host.

## Results

**VERDICT: VALIDATED** — the full substrate lifecycle works driven purely from the Windows
side via `wsl.exe`, with timings well inside the UX budget (clean run, WSL 2.7.11):

| Leg | Result | Time |
|---|---|---|
| Import (private name, D: storage) | ✓ | 41 s |
| First boot | ✓ (`boot-ok`, user `nixos`) | 4 s |
| Config change applied externally (`nixos-rebuild switch`, +pkgs.hello) | ✓ rc=0 (103 MiB from cache.nixos.org) | 109 s |
| Verify (`hello` → "Hello, world!") | ✓ | — |
| **Rollback** (`nixos-rebuild switch --rollback`) → hello gone | ✓ | **6 s** |
| Generations enumerable (1 baked, 2 ours; 1 current post-rollback) | ✓ | — |
| Terminate + auto-restart on next command | ✓ | 3 s |
| Footprint | 3.4 GB ext4.vhdx (+ shortcut.ico — new WSL 2.7 shortcut plumbing) | — |

Zero in-guest interaction anywhere; total wall-clock excluding image download ≈ 3 min.
The "Revert last update" button costs SIX SECONDS — better than hoped.

**Product lessons (feed P2/P2b planning):**
1. Installer must `mkdir` the distro storage parent before `wsl --import` (opaque
   `ERROR_PATH_NOT_FOUND` otherwise).
2. **Enforce a minimum WSL version** — 2605-line images "Catastrophic failure" on WSL 2.3.26,
   boot fine on 2.7.11; presence-checking WSL is not enough. `wsl --update` needs an explicit
   elevated flow with progress UI (it stalls invisibly behind UAC), and a concurrent
   `--web-download` fails 1618 while a Store install is mid-flight — serialize update paths.
3. First `nixos-rebuild` fetches ~100 MiB toolchain deps even for a trivial package add —
   the plan's own-binary-cache + CI-prebuilt-closure model directly removes this from user
   machines (users substitute, never build). Confirms the P1 "cache is load-bearing" stance.
4. Spike-harness-only gotchas (not product): MSYS path conversion mangles absolute Linux paths
   passed as direct wsl.exe args from Git Bash — wrap in `sh -c '...'`; and check `PIPESTATUS`,
   never trust `cmd | tail`'s exit code.

**Descoped legs (guess-with-fallbacks decision, 2026-08-02):** Podman/Collabora/pane rendering
(routine; ecosystem-proven), UX-flow polish. The distro is left registered ("SourcererSpike")
for those follow-up legs; cleanup: `wsl --unregister SourcererSpike` (+ delete D:\WSL).

**Signal for the plan:** P2/P2b's core mechanics are proven. The updater architecture
(channel → externally-driven switch → one-button rollback) is real and fast. Proceed.
