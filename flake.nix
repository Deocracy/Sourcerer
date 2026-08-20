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
    in
    {
      devShells.${system} = {
        theia = pkgs.mkShell {
          nativeBuildInputs = [
            pkgs.nodejs_22
            pkgs.yarn
            pkgs.python3
            pkgs.pkg-config
            pkgs.gnumake
          ];
          buildInputs = [
            pkgs.xorg.libX11
            pkgs.xorg.libxkbfile
          ];
          shellHook = ''
            echo "Sourcerer theia shell ready. Next: cd theia && yarn install && yarn build && yarn start"
          '';
        };

        firefox = pkgs.mkShell {
          inputsFrom = [ pkgs.firefox-esr-153-unwrapped ];
          shellHook = ''
            export MOZBUILD_STATE_PATH="$PWD/.mozbuild"
            echo "Sourcerer firefox shell ready. This shell already supplies the full Gecko toolchain (rustc, cargo, cbindgen) -- no separate toolchain setup is needed. Next: scripts/fetch-upstream.sh, then cd upstream && MOZCONFIG=../.mozconfig ./mach build"
          '';
        };
      };
    };
}
