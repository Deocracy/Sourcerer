# Building Sourcerer

This documents the commands that actually built and ran both halves of
Sourcerer on the reference NixOS host, with the durations actually measured
there. It does not describe the patch-stack tree, artifact builds, or a
rebase procedure — those land in Phase 3.

## Prerequisites

- NixOS (or any host with Nix flakes enabled — `experimental-features =
  nix-command flakes`).
- ~30 GB free disk and 8 GB RAM for the Firefox half (a full non-artifact
  compile peaks around 14 G of `objdir/`, on top of the ~5.6 G `upstream/`
  checkout).
- **The repository must live at a path with no space character.**
  `pkgs.mkShell` appends an rpath to the space-separated `NIX_LDFLAGS`
  environment variable; a space in the checkout path makes the cc-wrapper
  split that variable on the space and every native link step fails. Both
  the Firefox compile and Theia's `node-gyp` native modules drive that same
  linker, so this is not a Firefox-only caveat — clone somewhere like
  `~/coding/sourcerer`, never under a directory such as `~/My Projects`.

Nothing else needs installing by hand. Both `nix develop` shells below
supply their entire toolchain; there is no `mach bootstrap` step and no
separate Node/Yarn/Rust install (D-18).

## Theia half

```
nix develop .#theia
cd theia
yarn install --ignore-scripts --frozen-lockfile
(cd node_modules/drivelist && node-gyp rebuild)
yarn build
yarn start
```

Then open **http://localhost:3000** (`127.0.0.1:3000`) — that is the port
`theia start` actually binds; do not assume it moved.

Why `--ignore-scripts` plus one explicit rebuild, not a plain `yarn
install`: this was a deliberate decision after auditing all 1,042
transitive packages in the workspace for install scripts. Only 9 packages
carry one, and `drivelist` is the only one that genuinely needs it —
version 12.0.2 ships no prebuilt binary, and `@theia/core` requires
`drivelist`'s compiled `.node` at backend boot. Running every package's
install script unaudited is unnecessary attack surface; skipping the one
script that is actually load-bearing breaks the app at boot. Do not
"simplify" this back to a bare `yarn install`.

If `yarn.lock` were absent you would drop `--frozen-lockfile`, but it is
committed, so every install reproduces the exact same tree.

Expect `theia rebuild:browser` (invoked internally by `yarn build`) to log
`native-keymap`, `find-git-repositories`, `drivelist`, and `keytar` as
skipped — that is expected on a browser-target app (none of those are
usable from a browser frontend) and is not a failure.

**Measured on the reference host:** a cold run of the full sequence above
(install + drivelist rebuild + build + boot) takes roughly 70s; a warm run
with `--frozen-lockfile` and no dependency changes completes in about 12s
(the harness's own `scripts/smoke-theia.sh` measured 11.9s end to end).

## Firefox half

```
./scripts/fetch-upstream.sh
nix develop .#firefox
cd upstream
MOZCONFIG=../.mozconfig ./mach build
MOZCONFIG=../.mozconfig ./mach run
```

`scripts/fetch-upstream.sh` runs directly from the repo root — it only
needs `git`, which the host already provides, so it is not run inside
either `nix develop` shell. It is safely re-runnable: if `upstream/`
already exists at the pinned tag it no-ops instead of re-cloning.

**Measured on the reference host:** the clone took 438s and produced a
5.6 G `upstream/` tree. A full non-artifact `./mach build` (the phase's
acceptance proof — this is not an artifact build, see D-11/D-12) took
3224s (~54 minutes) wall time on 16 cores / 62 GB RAM, peaking at 14 G of
`objdir/`. Expect similar order-of-magnitude numbers; do not be surprised
if a first-time contributor's build takes an hour. The resulting binary
reports `Mozilla Firefox 153.1.0esr` via `./mach run --version`.

`nix develop .#firefox` supplies the entire compiler toolchain (clang,
rustc, cargo, cbindgen) matched to what nixpkgs itself builds this exact
Firefox version with — there is no separate toolchain setup step to run
before `./mach build`.

## Toolchain baseline

Phase 3's rebase procedure (BUILD-03) starts by diffing the toolchain the
`firefox` shell resolves today against the committed baseline:

```
diff <(nix develop .#firefox --command bash scripts/toolchain-baseline.sh) toolchain-baseline.txt
```

A non-empty diff means the pinned `nixpkgs` revision now resolves to a
different `rustc`, `cargo`, or `cbindgen` version than the committed
`toolchain-baseline.txt` — the FFI-drift signal the project's pitfalls
research calls out as something to re-check on every ESR rebase, not just
once. To regenerate the baseline file itself (only do this deliberately,
as part of a reviewed rebase):

```
nix develop .#firefox --command bash scripts/toolchain-baseline.sh > toolchain-baseline.txt
```

## Verifying a fresh clone

This is the check that proves the commands above are complete — that
nothing in them depends on tribal knowledge left over in a working tree
that has been iterated on directly.

```
git clone . <fresh-space-free-path>
cd <fresh-space-free-path>
./scripts/fetch-upstream.sh
./scripts/smoke-theia.sh
nix develop .#firefox --command bash -c 'cd upstream && MOZCONFIG=../.mozconfig ./mach configure'
diff <(nix develop .#firefox --command bash scripts/toolchain-baseline.sh) toolchain-baseline.txt
```

The Firefox step above uses `./mach configure` as a **fast proxy**, not as
an equivalent. Configure covers most of the toolchain-detection path
(rustc, cargo, cbindgen, the WASM-sandboxing opt-out, libclang discovery)
in about a minute, so it is the right routine check.

Be clear about what it does not cover. Of the three toolchain defects
found while building this phase, one — nixpkgs' bintools-wrapper
exporting `AS`/`LD`/etc., which broke `moz.configure`'s assembler flag
routing — surfaced only **during compilation**, on the first `.s` file
(NSPR's `os_Linux_x86_64.s`), long after configure had succeeded. A
configure-only check would have passed straight over it. Treat a green
configure as "the documented setup is probably complete", not as proof
that a fresh clone builds.

The full check has been run once, end to end, on a genuinely fresh clone:

```
git clone . <fresh-space-free-path>
cd <fresh-space-free-path>
./scripts/fetch-upstream.sh                                     # 554s, 5.6G
./scripts/smoke-theia.sh                                        # 14s, PASS
nix develop .#firefox --command bash -c 'cd upstream && MOZCONFIG=../.mozconfig ./mach build'
```

Result: exit 0 in 3641s (~61 min), 14G objdir, zero `mach bootstrap`
invocations, `objdir/dist/bin/firefox --version` reporting
`Mozilla Firefox 153.1.0esr`, and `git status` clean in both the repo and
`upstream/`. Re-run the full build rather than just configure whenever
anything in `flake.nix`, `.mozconfig`, or the toolchain pin changes.

Any command that a fresh clone needs but this document does not list is
treated as a documentation failure, not a footnote — it gets added here
and re-verified, not just noted in a summary.
