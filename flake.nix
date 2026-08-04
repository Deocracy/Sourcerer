{
  description = "Sourcerer: repo-root flake foundation (D-07) — pinned nixpkgs, the one dev shell serving both the Nix substrate world and the conventional Tauri build (D-16), and the near-empty public lib/overlay surface downstream repos consume (D-09)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05"; # D-08
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, rust-overlay }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ rust-overlay.overlays.default ];
      };

      # The one place a Rust version appears is rust-toolchain.toml itself (D-10) — never
      # name a version here, rustup and rust-overlay both read that file.
      rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          rustToolchain
          pkgs.nodejs_24
          pkgs.cargo-tauri
          pkgs.attic-client
          pkgs.awscli2
          pkgs.nixos-rebuild
          pkgs.git
        ];

        # Tauri Linux build inputs (wiki.nixos.org/wiki/Tauri) — webkitgtk_4_1/libsoup_3 are
        # the Tauri-2-generation attributes; the 4.0/soup2 generation fails on missing
        # javascriptcoregtk-4.1.
        buildInputs = [
          pkgs.webkitgtk_4_1
          pkgs.libsoup_3
          pkgs.gtk3
          pkgs.librsvg
          pkgs.glib-networking
          pkgs.openssl
        ];

        nativeBuildInputs = [
          pkgs.pkg-config
          pkgs.wrapGAppsHook4
        ];

        # openssl-sys and friends look here directly rather than trusting pkg-config's own
        # setup-hook propagation from buildInputs.
        shellHook = ''
          export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.libsoup_3.dev}/lib/pkgconfig:${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig:''${PKG_CONFIG_PATH:-}"
          echo "sourcerer dev shell: rustc $(rustc --version | awk '{print $2}'), node $(node --version)"
        '';
      };

      # D-09: the public surface downstream repos (Phase 13 Databasise, Phase 16 store, all
      # app repos) consume as a pinned flake input.
      lib = import ./nix/lib.nix { inherit nixpkgs; };

      # Deliberately near-empty and named — Phase 15's app compiler and Phase 16's submission
      # format fill this in. Its existence today (not its contents) is what lets downstream
      # app expressions evaluate against a surface that already exists.
      overlays.default = final: prev: { };
    };
}
