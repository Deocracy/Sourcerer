{
  description = "Sourcerer build environment: Theia sidecar + Firefox-ESR fork";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

      # D-16 / PITFALLS #7: one Node version for the whole sidecar toolchain.
      # nixpkgs' `yarn` is built against the default nodejs (24.x) and its shebang
      # hard-codes it, so yarn runs every lifecycle script and every node-gyp
      # compile under Node 24 even when nodejs_22 is the shell's `node`. Native
      # modules would then be built for MODULE_VERSION 137 and fail to load in the
      # Node 22 backend. Override so yarn itself runs on the pinned Node.
      nodejs = pkgs.nodejs_22;
      yarn = pkgs.yarn.override { inherit nodejs; };
    in
    {
      devShells.${system} = {
        theia = pkgs.mkShell {
          nativeBuildInputs = [
            nodejs
            yarn
            pkgs.python3
            pkgs.pkg-config
            pkgs.gnumake
          ];
          buildInputs = [
            pkgs.libx11
            pkgs.libxkbfile
          ];
          shellHook = ''
            # drivelist ships no prebuild for 12.0.2, so its install script falls
            # through to `node-gyp rebuild` and the install aborts without one.
            # Use the node-gyp bundled with the pinned Node's npm rather than
            # pkgs.node-gyp, which is built against the default nodejs (24.x) and
            # would drag that Node back into the toolchain (D-16 / PITFALLS #7).
            export PATH="${nodejs}/lib/node_modules/npm/bin/node-gyp-bin:$PATH"
            echo "Sourcerer theia shell ready. Next: cd theia && yarn install && yarn build && yarn start" >&2
          '';
        };

        firefox = pkgs.mkShell {
          inputsFrom = [ pkgs.firefox-esr-153-unwrapped ];
          shellHook = ''
            export MOZBUILD_STATE_PATH="$PWD/.mozbuild"
            echo "Sourcerer firefox shell ready. This shell already supplies the full Gecko toolchain (rustc, cargo, cbindgen) -- no separate toolchain setup is needed. Next: scripts/fetch-upstream.sh, then cd upstream && MOZCONFIG=../.mozconfig ./mach build" >&2
          '';
        };
      };
    };
}
