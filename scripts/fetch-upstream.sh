#!/usr/bin/env bash
# D-04: the one documented command that materializes upstream/ from a clean
# checkout. Safely re-runnable -- if upstream/ already exists, verifies its
# HEAD is the pinned tag instead of re-cloning.
set -euo pipefail

TAG="FIREFOX_153_1_0esr_RELEASE"
REMOTE="https://github.com/mozilla-firefox/firefox.git"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_DIR="$REPO_ROOT/upstream"

if [ -d "$UPSTREAM_DIR" ]; then
  # Compare commit hashes rather than `git describe --tags --exact-match`:
  # the mozilla-firefox/firefox mirror tags each ESR point release with both
  # a human-facing "_RELEASE" tag and a build-numbered "_BUILD1" tag pointing
  # at the identical commit, and `describe` breaks that tie non-deterministically
  # (observed picking BUILD1 over RELEASE on this exact commit). Resolving the
  # pinned tag's own ref and diffing commit hashes is unambiguous regardless of
  # how many other tags share that commit.
  HEAD_SHA="$(git -C "$UPSTREAM_DIR" rev-parse HEAD 2>/dev/null || true)"
  TAG_SHA="$(git -C "$UPSTREAM_DIR" rev-parse "refs/tags/$TAG^{commit}" 2>/dev/null || true)"
  if [ -n "$HEAD_SHA" ] && [ "$HEAD_SHA" = "$TAG_SHA" ]; then
    echo "fetch-upstream: upstream/ already at $TAG, nothing to do"
    exit 0
  fi
  echo "fetch-upstream: FAIL -- upstream/ exists but HEAD ($HEAD_SHA) is not $TAG ($TAG_SHA)" >&2
  exit 1
fi

SECONDS=0
git clone --depth 1 --branch "$TAG" "$REMOTE" "$UPSTREAM_DIR"
ELAPSED=$SECONDS

echo "fetch-upstream: cloned $TAG in ${ELAPSED}s"
du -sh "$UPSTREAM_DIR"
