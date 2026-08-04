# Sourcerer substrate — shared core (D-15).
#
# This is the ONE definition of what the substrate contains: user, Nix settings,
# nix-ld, and the D-12 seed placeholder service. Both nix/substrate/wsl-variant.nix
# and nix/substrate/vm-variant.nix import this module and add nothing beyond their
# own adapter layer — if this file's contents diverge between variants, D-15 has
# been violated.
{ pkgs, ... }:

let
  # D-12 seed placeholder service docroot — the working miniature of Phase 13's
  # real engine-answers-on-loopback check. Phase 13's real health check replaces
  # this service; the shape (loopback HTTP, asserted response body) is what
  # carries forward.
  seedDocroot = pkgs.writeTextDir "index.html" "sourcerer-substrate-seed-ok\n";
in
{
  users.users.sourcerer = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
  };

  nix.settings.experimental-features = [ "nix-command" "flakes" ];
  nix.settings.trusted-users = [ "root" "sourcerer" ];

  # D-14: this IS the vscode-server support mechanism. VS Code Remote-WSL downloads
  # its own dynamically-linked glibc server binaries into ~/.vscode-server at connect
  # time; nix-ld is the loader shim that lets those foreign binaries run on NixOS.
  # Do NOT add a `nix-community/nixos-vscode-server` flake input — that project is
  # the pre-nix-ld workaround, and `services.vscode-server` does not exist in
  # nixpkgs 26.05 (resolved fact, verified live against the pinned nixpkgs).
  programs.nix-ld.enable = true;
  programs.nix-ld.libraries = with pkgs; [
    stdenv.cc.cc.lib
    zlib
    openssl
  ];

  system.stateVersion = "26.05";

  # D-12 seed placeholder service — stand-in for Phase 13's real Databasise engine
  # health check. Bind loopback only, never any wildcard address: this is the
  # shape later phases copy, and a non-loopback bind here would set a bad
  # precedent.
  # python3Minimal (not python3) keeps this placeholder's weight off the substrate
  # closure.
  #
  # Explicitly NOT hardened: no systemd sandboxing/isolation directives anywhere in
  # this module. With Phase 8 deferred there is no measured hardening exemption set
  # yet, so authoring an app-unit hardening template now would encode guesses.
  # Phase 15 owns it.
  systemd.services.seed-placeholder = {
    description = "Sourcerer substrate seed placeholder (D-12 stand-in for the Phase 13 engine health check)";
    wantedBy = [ "multi-user.target" ];
    serviceConfig.ExecStart =
      "${pkgs.python3Minimal}/bin/python3 -m http.server 8080 --bind 127.0.0.1 --directory ${seedDocroot}";
  };
}
