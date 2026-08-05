{
  description = "Sourcerer: repo-root flake foundation (D-07) — pinned nixpkgs, the one dev shell serving both the Nix substrate world and the conventional Tauri build (D-16), and the near-empty public lib/overlay surface downstream repos consume (D-09)";

  # FOUND-01: the Sourcerer Attic cache. A fresh clone's first `nix build`
  # already knows where to pull from — Nix prompts once to accept a flake's
  # `nixConfig` (or the caller passes `--accept-flake-config`, or is already
  # in `trusted-users`); that one-time prompt is the entire client setup.
  #
  # This is a plain substituter URL + public key, nothing more — that is the
  # property D-01 chose Attic for: replacing this one block is the entire
  # migration path if the cache ever has to move off Attic/ohio1/AWS. Keep
  # the coupling visible here, not buried in a README setup step.
  nixConfig = {
    extra-substituters = [ "https://sourcerer-cache.deocracy.org/sourcerer" ];
    extra-trusted-public-keys = [ "sourcerer:M1yBgCsgFqzqQr6R/53Efq0JzZqPqbu+LmHOHYqpr0o=" ];
  };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05"; # D-08
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    # Pinned to the exact tag spike 010 validated end-to-end, not `main` — D-08's
    # calm channel rhythm depends on the WSL line tracking the nixpkgs pin.
    nixos-wsl.url = "github:nix-community/NixOS-WSL/2605.7.2";
    nixos-wsl.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, rust-overlay, nixos-wsl }:
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
          # mkShell fabricates $out="$PWD/outputs/out" for interactive shells (there is no
          # real derivation output). If the repo is checked out under a path containing a
          # space, the resulting "-rpath $out/lib" entry in NIX_LDFLAGS gets word-split by
          # the cc-wrapper and breaks every cargo build-script link step with a bogus
          # relative path. Strip that one bad rpath entry rather than requiring a
          # space-free checkout path.
          export NIX_LDFLAGS="''${NIX_LDFLAGS//-rpath $PWD\/outputs\/out\/lib/}"
          export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.libsoup_3.dev}/lib/pkgconfig:${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig:''${PKG_CONFIG_PATH:-}"
          echo "sourcerer dev shell: rustc $(rustc --version | awk '{print $2}'), node $(node --version)"
        '';
      };

      # D-15: one shared substrate core (nix/substrate/core.nix), two thin adapter
      # variants. substrate-wsl is the real image target; substrate-vm is what the
      # seed nixosTest boots — it proves the substrate's contents, never the WSL
      # adapter layer (nix/substrate/vm-variant.nix's own header comment says so).
      nixosConfigurations.substrate-wsl = nixpkgs.lib.nixosSystem {
        inherit system;
        specialArgs = { inherit nixos-wsl; };
        modules = [ ./nix/substrate/wsl-variant.nix ];
      };

      nixosConfigurations.substrate-vm = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          ./nix/substrate/vm-variant.nix
          # A standalone nixosSystem (unlike a nixosTest node, which supplies its
          # own qemu-vm disk/boot plumbing automatically) requires a real root
          # filesystem + bootloader target to satisfy NixOS's bootability
          # assertions before system.build.toplevel will evaluate. This is
          # eval-only scaffolding for FOUND-01's "buildable closure" proof, not
          # substrate content — it stays out of vm-variant.nix itself so that
          # file's imports remain exactly [ ./core.nix ] as D-15 requires.
          {
            fileSystems."/" = { device = "/dev/disk/by-label/nixos"; fsType = "ext4"; };
            boot.loader.grub.device = "/dev/sda";
          }
        ];
      };

      packages.${system} = {
        substrate-system =
          self.nixosConfigurations.substrate-wsl.config.system.build.toplevel;

        # A runnable script requiring root to actually emit the .wsl file; running
        # it to produce a distributable image is Phase 10's job. Phase 9 only needs
        # the derivation to build so the closure is cacheable (FOUND-01's target).
        substrate-image-builder =
          self.nixosConfigurations.substrate-wsl.config.system.build.tarballBuilder;
      };

      # D-12/FOUND-02: nixosTest boots the plain-VM variant only. Placing it under
      # `checks` is what makes `nix flake check` build and run it automatically —
      # the mechanism Plan 04's CI job depends on.
      checks.${system}.seed-boot-test = import ./nix/checks/seed-boot-test.nix {
        inherit pkgs;
        vmModule = ./nix/substrate/vm-variant.nix;
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
