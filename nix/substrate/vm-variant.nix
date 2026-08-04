# Sourcerer substrate — plain-QEMU adapter (D-15).
#
# This variant proves the substrate's CONTENTS (nix/substrate/core.nix), not the
# WSL adapter layer. It is booted only by nix/checks/seed-boot-test.nix under a
# normal QEMU nixosTest init path. A real-WSL smoke test (proving the WSL adapter
# itself works under an actual WSL2 kernel) is Phase 10's concern, not this
# variant's — that gap is intentional and written down here rather than left
# implicit.
#
# Do NOT import the NixOS-WSL flake input's nixosModules.default here: that module
# assumes the WSL2 interop layer and a /init entrypoint. A QEMU nixosTest boots a
# normal init path, so importing the WSL module would either fail evaluation or
# silently test the wrong thing.
{ ... }:

{
  imports = [ ./core.nix ];
}
