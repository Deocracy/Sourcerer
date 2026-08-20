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
  if ! git -C "$UPSTREAM_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    echo "fetch-upstream: FAIL -- $UPSTREAM_DIR exists but is not a git checkout." >&2
    echo "  Most likely an interrupted clone. Remove it and re-run:" >&2
    echo "    rm -rf '$UPSTREAM_DIR' && '${BASH_SOURCE[0]}'" >&2
    exit 1
  fi

  HEAD_SHA="$(git -C "$UPSTREAM_DIR" rev-parse HEAD 2>/dev/null || true)"
  TAG_SHA="$(git -C "$UPSTREAM_DIR" rev-parse "refs/tags/$TAG^{commit}" 2>/dev/null || true)"

  if [ -z "$HEAD_SHA" ] || [ "$HEAD_SHA" != "$TAG_SHA" ]; then
    echo "fetch-upstream: FAIL -- upstream/ HEAD (${HEAD_SHA:-<unresolvable>}) is not $TAG (${TAG_SHA:-<tag not present>})." >&2
    echo "  Remove it and re-run to re-materialize at the pinned tag:" >&2
    echo "    rm -rf '$UPSTREAM_DIR' && '${BASH_SOURCE[0]}'" >&2
    exit 1
  fi

  # HEAD matching the tag is necessary but not sufficient: a modified working
  # tree is still the wrong source. CLAUDE.md's hard rule is that Gecko is never
  # modified, and BUILD-03's rebase procedure assumes upstream/ is pristine, so
  # report a dirty tree rather than silently declaring it correct (D-01, D-02).
  if [ -n "$(git -C "$UPSTREAM_DIR" status --porcelain 2>/dev/null)" ]; then
    echo "fetch-upstream: FAIL -- upstream/ is at $TAG but its working tree is dirty." >&2
    echo "  Gecko source must never be modified. Inspect with:" >&2
    echo "    git -C '$UPSTREAM_DIR' status --porcelain" >&2
    echo "  Then discard the changes, or remove upstream/ and re-run this script." >&2
    exit 1
  fi

  echo "fetch-upstream: upstream/ already at $TAG and clean, nothing to do"
  exit 0
fi

SECONDS=0
git clone --depth 1 --branch "$TAG" "$REMOTE" "$UPSTREAM_DIR"
ELAPSED=$SECONDS

echo "fetch-upstream: cloned $TAG in ${ELAPSED}s"
du -sh "$UPSTREAM_DIR"
