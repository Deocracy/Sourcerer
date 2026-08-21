#!/usr/bin/env bash
# D-74/D-75: replays patches/*.patch onto upstream/ in glob (zero-padded
# numeric prefix) order. Safely re-runnable: a second run over an
# already-applied stack fails by patch name rather than reporting success.
#
# git apply --3way was empirically measured (03-RESEARCH.md, D-75 experiment)
# to exit 0 with a completely silent no-op on already-adopted content -- the
# before/after blob-hash comparison below is the only mechanism that catches
# that silent drop. --3way (not plain `git apply`) is used because plain
# `git apply` fails on legitimate upstream drift a 3-way merge would resolve.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_DIR="$REPO_ROOT/upstream"
PATCHES_DIR="$REPO_ROOT/patches"

cd "$UPSTREAM_DIR"

shopt -s nullglob
patch_files=("$PATCHES_DIR"/*.patch)
shopt -u nullglob

if [ "${#patch_files[@]}" -eq 0 ]; then
  echo "apply-patches: FAIL -- $PATCHES_DIR contains no *.patch files" >&2
  exit 1
fi

for p in "${patch_files[@]}"; do
  name="$(basename "$p")"

  touched_files="$(grep -E '^\+\+\+ b/' "$p" | sed 's#^+++ b/##')"
  if [ -z "$touched_files" ]; then
    echo "apply-patches: FAIL -- $name has no '+++ b/' target paths to verify against" >&2
    exit 1
  fi

  before_hashes="$(for f in $touched_files; do git hash-object "$f" 2>/dev/null || echo "MISSING:$f"; done)"

  if ! git apply --3way "$p"; then
    echo "apply-patches: FAIL -- $name did not apply (real conflict, not silent)" >&2
    echo "  Remediation: git -C '$UPSTREAM_DIR' checkout -- $touched_files" >&2
    echo "  or: rm -rf '$UPSTREAM_DIR' && '$REPO_ROOT/scripts/fetch-upstream.sh' && '$REPO_ROOT/scripts/apply-patches.sh'" >&2
    exit 1
  fi

  after_hashes="$(for f in $touched_files; do git hash-object "$f" 2>/dev/null || echo "MISSING:$f"; done)"

  if [ "$before_hashes" = "$after_hashes" ]; then
    echo "apply-patches: FAIL -- $name applied with exit 0 but changed nothing (D-75: silently already-adopted, or a genuine no-op patch)" >&2
    echo "  Remediation: git -C '$UPSTREAM_DIR' checkout -- $touched_files" >&2
    echo "  or: rm -rf '$UPSTREAM_DIR' && '$REPO_ROOT/scripts/fetch-upstream.sh' && '$REPO_ROOT/scripts/apply-patches.sh'" >&2
    exit 1
  fi
done

echo "apply-patches: all ${#patch_files[@]} patches applied and verified non-vacuous"
