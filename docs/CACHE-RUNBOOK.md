# Sourcerer Attic Cache Runbook

FOUND-03's channel-maintenance runbook. Concrete, provenance-stamped, no
aspirational language — if something below is not yet true, it says so
directly instead of describing an intended future state.

The design rationale for Attic-vs-Cachix and AWS-vs-Hetzner is settled in
`.planning/phases/09-flake-foundation-assurance-chain/09-CONTEXT.md` (D-01,
D-02, D-03) and is not restated here.

## Inventory

Every resource this cache runs on, by identifier. **Direction change from the
plan of record:** the cache is not on dedicated AWS EC2+S3 — it runs on
Deocracy's existing shared production box (`ohio1`), a mid-execution decision
recorded in `09-05-SUMMARY.md`. Several inventory items the original plan
expected (a dedicated S3 bucket, a dedicated IAM role/instance profile, a
dedicated security group, a dedicated key pair, a dedicated Elastic IP) do not
exist for this cache — it reuses `ohio1`'s existing ones. Marked `N/A
(shared with ohio1)` below rather than invented.

| Resource | Value |
|---|---|
| Region | `us-east-2` |
| Instance | `i-0f67d53f073662a52`, `t4g.large`, arm64 (aarch64), `Name=nixos-prod` — this is `ohio1`, shared with every other service on the box, not dedicated to the cache |
| Elastic IP | `3.16.61.91` (`eipalloc-0c9d7d37dc1c93ced`), association `eipassoc-022debb12deef5104` — ohio1's existing address, not cache-specific |
| Security group | `sg-0df5eb343b42652ec` (`nixos-prod-ssh`): tcp/22 from one operator IP only. The cache has no security-group entry of its own — it is reachable only via the Cloudflare tunnel below, never directly on the instance's public IP |
| IAM role / instance profile | N/A (shared with ohio1) — the cache does not use AWS credentials at all; storage is local disk, not S3 (see Retention section) |
| S3 bucket | N/A — storage is local (`/var/lib/atticd/storage` on ohio1's root disk, 33G free at deploy time). Migration note is recorded in `modules/attic.nix` (infra repo) for when the instance role gains a scoped bucket policy |
| Key pair | N/A (shared with ohio1) — no cache-specific SSH key |
| DNS record | `sourcerer-cache.deocracy.org`, CNAME → `06d1e9ae-d2ee-48f8-a91a-ce87f1ce718d.cfargotunnel.com` (the existing `wp-ohio1` Cloudflare tunnel — same target every other hostname on that tunnel uses) |
| Cache name | `sourcerer` |
| Cache URL | `https://sourcerer-cache.deocracy.org/sourcerer` |
| Public signing key | `sourcerer:M1yBgCsgFqzqQr6R/53Efq0JzZqPqbu+LmHOHYqpr0o=` |
| Config source (infra repo) | `Deocracy/nixos-hosting`, `modules/attic.nix` + `modules/ingress.nix` (local clone: `/home/chris/infra/nixos-hosting`) |

**Push token.** Deliberately absent from this table. It lives in the
`ATTIC_TOKEN` repository secret on `Deocracy/Sourcerer` (push+pull scoped,
1-year validity, minted 2026-08-04). To re-mint: SSH to `ohio1`, run
`atticd-atticadm -f <atticd's server.toml, found via
`systemctl cat atticd`> make-token --sub ci --validity 1y --push sourcerer
--pull sourcerer`, then `gh secret set ATTIC_TOKEN --repo Deocracy/Sourcerer`
with the resulting value. Never commit the token to either repo.

## Known gap: the cache requires authentication for pulls, not just pushes

**This is a real, currently-unresolved divergence from FOUND-01's "zero prior
client setup" claim, and it should not be papered over.** Attic caches are
private by default. Verified live (2026-08-05):

    curl -sf https://sourcerer-cache.deocracy.org/sourcerer/nix-cache-info
    # → HTTP 401

A fresh clone's `nix build` will therefore **not** silently pull from the
cache using only the `nixConfig` block in `flake.nix` — the substituter will
be rejected with a signature/auth failure that Nix treats as "substituter
unavailable" and falls back to building from source. The build still
succeeds (Nix degrades gracefully), it just does not get the cache speedup
FOUND-01 promises.

**The fix is a one-line, one-time server-side change** (`attic cache
configure sourcerer --public`, run against the server, e.g. over loopback on
`ohio1` with a token carrying the `configure_cache` permission for
`sourcerer`) that makes pulls anonymous while push stays token-gated — the
standard shape for a public read-only cache with a private write path. This
plan did not execute that command: it requires SSH access to the production
`ohio1` box, which this execution session's permission environment denied.
**Whoever next has interactive access to `ohio1` should run it and then
re-run the `curl` check above to confirm `200` with a `StoreDir` body.**
Nothing else in this runbook or in `flake.nix` needs to change once that one
command runs — the substituter URL and public key are already final and
correct.

Until that happens, CI's `publish` job still works correctly (it
authenticates via `ATTIC_TOKEN`, which is push+pull scoped), but a developer
cloning the repo on a second machine will build the substrate image locally
rather than pulling it.

## nixpkgs bump cadence (D-08)

The pin is `nixos-26.05`. Minor bumps within `26.05` are routine:

    nix flake update nixpkgs
    git add flake.lock
    git commit -m "chore: bump nixpkgs within 26.05"
    git push

Push and let CI judge it — a routine bump that turns CI red is handled by the
Red-channel response below, not manually second-guessed first.

**Cadence commitment: review for a routine bump at least once per quarter.**
Off-cadence bumps (i.e. immediately, not waiting for the quarterly review)
are triggered only by a security advisory affecting a package inside the
`substrate-system` closure — check the advisory against `nix why-depends
.#substrate-system <affected-package>` before bumping to confirm it is
actually in the closure, not just in nixpkgs generally.

The `26.05` → `26.11` migration is a **planned event, not a routine bump**:
budget a dedicated session, expect the WSL image line (`NixOS-WSL`) to need
its own matching version bump (currently pinned to tag `2605.7.2` in
`flake.nix`), and re-verify anything Phase 8's spike work checked against
`unstable` (e.g. `services.collabora-online` availability) against `26.11`
specifically before Phase 15 relies on it.

## Red-channel response

The lock file is the pin — reverting `flake.lock` reverts the world:

    git log --oneline -- flake.lock          # find the last-known-good commit
    git checkout <good-commit> -- flake.lock
    git commit -m "revert: flake.lock to last-known-good, CI red on nixpkgs bump"
    git push

Because the `publish` job's `needs: [nix-checks, windows-tauri]` gates the
cache push on both jobs, **a red channel has already failed closed and
nothing reached the cache** — there is no cache state to clean up, only the
repo's `flake.lock` to revert.

**Telling genuine upstream breakage from a flaky `nixosTest` run:** re-run the
same commit's CI job once (`gh run rerun <run-id> --failed`) before reverting
anything. `nixosTest` boots a real QEMU VM on a shared GitHub Actions runner —
a timeout or a transient network failure inside the VM produces the same red
`X` as a genuine regression but passes cleanly on a second attempt. Only
treat it as a genuine break (and revert `flake.lock`) if the same job fails
identically twice, or if the failure is a build/eval error rather than a
runtime VM timeout.

## Retention and GC (D-02)

Declared in `modules/attic.nix` (infra repo):

    garbage-collection = {
      interval = "12 hours";
      default-retention-period = "3 months";
    };

Verify with:

    attic cache info sourcerer

which should report a nonzero retention period (`Global Default`, i.e. the
3-month server-wide setting, since this cache does not override it
per-cache).

**The single most important fact about this setting:
`default-retention-period = "0"` DISABLES time-based GC — it does not make GC
more aggressive.** An edit that "simplifies" this line to `0` or removes it
(reverting to nixpkgs' own default, which is `0`) silently breaks D-02's
nonzero-retention requirement and lets the cache grow unbounded on `ohio1`'s
shared root disk. Do not remove or zero this setting without deliberately
re-deciding the retention policy.

**Attic-GC-vs-S3-lifecycle:** does not apply here — storage is local disk
(`/var/lib/atticd/storage`), not S3, so there is no S3 lifecycle rule to
coordinate with. `atticd`'s own GC is the only retention mechanism in play.
If storage ever migrates to S3 (see Inventory), revisit whether an S3
lifecycle rule is needed in addition to, or instead of, `atticd`'s GC.

## Restore from scratch

Ordered procedure to rebuild the cache after total loss of `ohio1` or the
`atticd` service's state:

1. **Re-provision or re-point the instance.** If `ohio1` itself is lost,
   restore it per the infra repo's own host-recovery process (`docs/` in
   `Deocracy/nixos-hosting`) — this is outside the cache's own scope. If only
   `atticd`'s state is lost (e.g. local storage directory wiped) but the host
   is fine, skip to step 3.
2. **Deploy the cache module:**

       nixos-rebuild switch --flake .#attic-cache --target-host root@3.16.61.91

   (Run from a clone of `Deocracy/nixos-hosting` with the module already
   declared — this reapplies `modules/attic.nix` and `modules/ingress.nix`.)
3. **Recreate the cache** on the running server (`attic cache create
   sourcerer`, then configure retention/priority as in `modules/attic.nix`'s
   settings if not already declared server-side).
4. **Re-mint the CI token** (see Inventory's Push token entry) and update the
   `ATTIC_TOKEN` GitHub secret on `Deocracy/Sourcerer`.
5. **The part that is easy to forget: the cache's signing key changes on
   recreation.** `flake.nix`'s `nixConfig.extra-trusted-public-keys` holds the
   *old* key and must be updated to the new one printed by `attic cache
   info sourcerer` (or `attic cache create`'s own output) — otherwise every
   consumer's substituter fetch fails signature verification against the new
   cache. Every developer with the flake already checked out re-accepts the
   new `nixConfig` on their next `nix build` (the same one-time prompt as
   first-run).

**A lost cache is a rebuild, not a data loss.** Every store path in it is
reproducible from the flake — that reproducibility is the entire reason a
binary cache is safe to treat as disposable infrastructure. Nothing in the
cache is itself a source of truth for anything.

## Cost basis

**Marginal cost of the cache itself is effectively zero**, because D-01's
AWS-EC2+S3 plan was superseded mid-execution (`09-05-SUMMARY.md`) by hosting
on `ohio1`, an existing shared production instance Deocracy already runs and
pays for. The cache adds:

- **Compute:** $0 marginal — `atticd` runs as one more systemd service on an
  already-provisioned `t4g.large` instance.
- **Storage:** local disk on the existing root volume, not a new S3 bucket.
  33G free at deploy time; GC (above) keeps this bounded. No incremental AWS
  storage line item.
- **Egress:** cache pulls go through the existing Cloudflare tunnel (`wp-ohio1`),
  which already fronts every other hostname on this box — Cloudflare's
  proxy absorbs origin egress for cached/proxied traffic the same way it does
  for the rest of the site. Could not confirm a specific dollar figure for
  incremental Cloudflare or AWS data-transfer cost attributable specifically
  to cache traffic — **stating that plainly rather than estimating.**

Because the cache did not require standing up dedicated AWS resources, the
nonprofit-credits math D-01 cited (Deocracy's AWS nonprofit program discount)
was not actually exercised for this cache specifically — it remains the
correct basis for the *host* (`ohio1`) itself, not an incremental cost of
adding the cache to it. If the cache is later split onto dedicated
infrastructure (see the storage-local-vs-S3 migration note in `modules/attic.nix`),
re-derive real AWS figures against the nonprofit program's actual discount
percentage at that time rather than list price.

## Known caveats

**(1) The seed `nixosTest` proves the substrate's contents, not the WSL
adapter layer.** `checks.x86_64-linux.seed-boot-test` boots a plain QEMU VM
built from `nix/substrate/vm-variant.nix`, not a real WSL2 instance. It
proves the substrate's declared services and packages come up correctly
inside *a* VM — it does not prove NixOS-WSL's adapter layer (the
`.wsl`-specific boot path, `wslconf`, interop shims) works. A real-WSL smoke
test is Phase 10's concern, not this cache's or this CI pipeline's.

**(2) CI's Nix is Determinate Nix, not upstream Nix.** `.github/workflows/ci.yml`
uses `DeterminateSystems/nix-installer-action@v22`, which installs Determinate
Nix — the upstream-Nix install path was removed from that action on
2026-01-01. This is intentional and satisfies the project's "pin which Nix
ships" decision (`.planning/PROJECT.md`, D-P4) for the CI environment
specifically. It should not be a surprise in a future debugging session where
CI's `nix --version` behaves slightly differently than a developer's local
upstream-Nix install.

**(3) Attic's crate carries a "WIP" label upstream.** `zhaofengli/attic`'s own
README describes the project as work-in-progress. This is a maturity note,
not a reason to revisit D-01 — the cache has been verified working
end-to-end (push, pull, GC, token scoping) on this deployment. Before letting
a routine `nixpkgs` bump silently upgrade the deployed `services.atticd`
version, check Attic's own changelog/release notes for breaking changes to
the server config schema or storage format — an in-place format change on a
WIP project is more plausible here than for a 1.0 piece of infrastructure.

---

*Phase: 09-flake-foundation-assurance-chain*
*Written: 2026-08-05*
