# Sourcerer substrate — WSL adapter (D-15).
#
# Thin adapter layer only: imports the shared core (nix/substrate/core.nix) plus
# the NixOS-WSL module, and sets exactly the WSL-specific options. Every substrate
# content decision lives in core.nix; if this file grows contents beyond the WSL
# adapter settings below, D-15 has been violated.
{ nixos-wsl, ... }:

{
  imports = [
    ./core.nix
    nixos-wsl.nixosModules.default
  ];

  wsl.enable = true;
  wsl.defaultUser = "sourcerer";
}
