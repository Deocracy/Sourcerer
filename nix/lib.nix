# D-09: the deliberately near-empty public surface app expressions evaluate against from
# day one. Do not add speculative helpers here — that's exactly the over-building D-09 was
# worded to prevent.
{ nixpkgs }:
{
  # The pinned nixpkgs itself, re-exported. A downstream repo consuming this flake as a
  # pinned input gets the identical nixpkgs revision by construction, not by convention —
  # this is what makes TOOLS-02 ("floating-ref installs impossible") mechanically true later.
  pinnedNixpkgs = nixpkgs;

  # The single entry point downstream expressions use to get a package set from the pin.
  pkgsFor = system: import nixpkgs { inherit system; overlays = [ ]; };

  # Deliberately empty. Per-version-addressable app registry point (Phase 15/16) and the
  # user-config import point named in the phase's direction of record. No schema invented here.
  appModules = { };
}
