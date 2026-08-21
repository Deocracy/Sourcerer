# Phase 3: Branded Firefox Fork - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 3-Branded Firefox Fork
**Areas discussed:** Rebuild loop + BUILD-04 rewrite; upstream/ disposable or stateful; User-Agent + patch depth; Remote Settings + lock semantics

**Note on method:** `workflow.research_before_questions` is enabled in
`.planning/config.json`. A 29-agent research pass ran before questions were
asked, verifying claims against the local `upstream/` ESR 153 checkout and
adversarially re-checking each load-bearing claim. Seven claims were refuted and
are recorded as C-1..C-6 in CONTEXT.md. All four areas were selected for
discussion; the user chose the recommended option in all sixteen questions.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Fork layout & rebase procedure | patches/ vs sourcerer/ overlay boundary; replay onto a new ESR tag; CI scope | ✓ |
| Sourcerer identity surfaces | which strings change; UA; profile dir; dev-vs-release branding | ✓ |
| Mozilla endpoint & telemetry removal | mechanism and scope | ✓ |
| Fast rebuild loop | artifact builds vs incremental; the boundary doc | ✓ |

**User's choice:** all four.
**Notes:** The user interrupted the first attempt at this question to ask whether
`02-LEARNINGS.md` had been read. It had not — GSD's `load_prior_context` step
globs CONTEXT.md but not LEARNINGS.md, and the file was committed (`62de2d1`)
after this session's git snapshot. It was read before the discussion resumed, and
its verification patterns shaped D-73, D-88 and the `<code_context>` section.

---

## Rebuild loop + BUILD-04 rewrite

### Q1 — Artifact builds cannot produce a Sourcerer-named binary. How should BUILD-04 be resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite to the tiered loop | `./mach run` zero-build for symlinked files, `./mach build faster` 2.55s for preprocessed, full build only after a compiled-define change; accept ~54min clean-clone first build | ✓ |
| Keep wording, carry a second stock objdir | Preserve BUILD-04 literally with a second artifact objdir — which builds stock Firefox and so cannot test any BRAND requirement | |
| Rewrite, and drop the "in minutes" bar | Same rewrite, but delete the timing promise entirely | |

**User's choice:** Rewrite to the tiered loop.
**Notes:** The deciding evidence was empirical, not architectural preference:
artifact builds *do* work for ESR (verified HTTP 200 against the Taskcluster
namespace) but `GeckoJobConfiguration.product` is hardcoded `"firefox"` and
`MOZ_APP_NAME` is a compiled define, so the two requirements are genuinely
incompatible. Mozilla needed a bespoke `ThunderbirdJobConfiguration` class to
support one renamed product.

### Q2 — Should sccache land in the firefox dev shell this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add sccache in Phase 3 | `pkgs.sccache`, `--with-ccache=sccache` + `RUSTC_WRAPPER=sccache`, Zen's wiring | ✓ |
| Measure the rebuild cost first | Get a real number before adding a dependency | |
| No sccache in Phase 3 | Keep the devShell as Phase 1 proved it | |

**User's choice:** Yes, add sccache in Phase 3.
**Notes:** Reasoning accepted: this is the phase that repeatedly changes
compiled defines, so it either pays for itself here or never does. The known
risk — Nix's bash clang-wrapper, in the same fragile arrangement Phase 1 had to
stabilise — is carried into planning as a required smoke test rather than an
assumption.

### Q3 — Where does the artifact/patch-surface boundary live?

| Option | Description | Selected |
|--------|-------------|----------|
| Guard script + docs/BUILD.md section | `scripts/check-patch-surface.sh` enforced, pointed at from the existing BUILD.md | ✓ |
| New sourcerer/ARTIFACT-BOUNDARY.md | A dedicated doc — but the name is wrong once artifact builds are dropped | |
| Pull INTERNAL-APIS.md forward from Phase 4 | As PITFALLS #3 originally suggested — but it would be a stub for a phase | |

**User's choice:** Guard script + docs/BUILD.md section.
**Notes:** Prose alone cannot fail a build. The suffix list comes from
`emitter.py:1126-1133` rather than being hand-authored.

### Q4 — What is success criterion 3's acceptance bar?

| Option | Description | Selected |
|--------|-------------|----------|
| Guard passes + re-measured timings | Positive control on the guard, plus timings actually re-run at phase end and dated | ✓ |
| Guard passes only, no timing claim | Nothing that can go stale, but drops the DX promise | |
| Timing budget with a documented ceiling | Explicit ceilings — but picked on partly-unmeasured ground | |

**User's choice:** Guard passes + re-measured timings.
**Notes:** Directly answers Phase 2's recorded surprise — a `docs/BUILD.md`
"measured" figure that was never measured and was carried forward a whole phase.
The 2.55s and ~54min numbers inherited from research are explicitly marked as
requiring re-measurement.

---

## upstream/ disposable or stateful

Two research corrections were surfaced before the questions: `upstream/.git` is
1.1 GB, not 5.6 GB (that was the working tree), making a second tag fetch far
cheaper than briefed; and the repo *does* have a GitHub remote
(`Deocracy/Sourcerer`), so CI was a real option rather than a stub.

### Q1 — Disposable or stateful?

| Option | Description | Selected |
|--------|-------------|----------|
| Disposable — patches/ is truth | `git apply` replay; no commits inside upstream/; preserves D-01/D-04; LibreWolf and surfer precedent | ✓ |
| Stateful — preserved rebase branch | The only model where `git rebase --empty=stop` is available; +1.1 GB pack; no fork does this | |
| Disposable now, revisit at the first real rebase | Defer until a real conflict shape exists | |

**User's choice:** Disposable — patches/ is truth.
**Notes:** Taken with the adopted-patch risk understood and mitigated separately
(next question) rather than by switching models. A parallel
`--enable-application=sourcerer` project was raised in research and rejected
outright as PITFALLS #8 by construction — it converts a 2-line conflicting patch
into a ~55-line silently-drifting copy.

### Q2 — How is "upstream adopted our change" detected?

| Option | Description | Selected |
|--------|-------------|----------|
| Post-apply assertion per patch | Assert every patch actually changed something; no-op or already-applied fails by name | ✓ |
| Checksum the expected post-apply tree state | Catches more, but hashes must be regenerated on every legitimate change | |
| Rely on git rebase --empty=stop only | Simplest, but forces the stateful model | |

**User's choice:** Post-apply assertion per patch.
**Notes:** The measured fact forcing this question: default `git rebase --onto`
and `git am --3way` both exit 0 while silently deleting an adopted patch —
exactly what BUILD-03 criterion 2 exists to prevent. One experiment was carried
into planning as an explicit task: does `git apply --3way` on already-adopted
content exit 0 or 1? Nobody has measured it.

### Q3 — How should fetch-upstream.sh's clean-tree gate evolve?

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on unexpected changes only | Dirt accounted for by the patch stack and overlay passes; anything else hard-fails | ✓ |
| Split into two commands | Strict gate preserved, at the cost of BUILD-02's "one documented command" value | |
| Overlay outside git's view | upstream/ stays literally pristine; costs a copy/bind-mount and makes built ≠ inspectable | |

**User's choice:** Gate on unexpected changes only.
**Notes:** Depends on the post-apply state from Q2 being computable, so the two
decisions are coupled.

### Q4 — Should the rebase CI workflow land in Phase 3?

| Option | Description | Selected |
|--------|-------------|----------|
| Script now, workflow now, no schedule | `workflow_dispatch`-only, cribbed from zen-browser/desktop's sync-upstream.yml | ✓ |
| Script now, workflow deferred | Matches Phase 1's reasoning, but leaves "CI-ready" untested | |
| Full scheduled rebase CI now | Most faithful to the architecture doc; a red cron job nobody watches is PITFALLS #8's own warning | |

**User's choice:** Script now, workflow now, no schedule.
**Notes:** The ~4-weekly cadence PITFALLS #8 asks for becomes a standing
post-v4.0 operational item rather than a Phase 3 deliverable.

---

## User-Agent + patch depth

Presented with the verified mechanism split: `--with-app-basename`,
`--with-app-name`, `--with-distribution-id`, `--with-branding` and
`MOZ_APP_REMOTINGNAME` are free; `MOZ_APP_VENDOR`, `MOZ_APP_ID`,
`MOZ_APP_UA_NAME` and `MOZ_APP_PROFILE` are `project_flag`s with
`possible_origins=("implied",)` and cannot be set without a patch.

### Q1 — Which User-Agent does Sourcerer ship?

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-identical to stock Firefox | `imply_option("MOZ_APP_UA_NAME", "Firefox")`; AMO works; zero new fingerprint bits; unanimous fork precedent | ✓ |
| Dual token via one pref, zero patch | `general.useragent.compatMode.firefox`; keeps Sourcerer visible — but Waterfox abandoned this exact shape over fingerprinting | |
| Do not set MOZ_APP_BASENAME | No patch at all, but about:support reports Firefox and BRAND-01 fails | |

**User's choice:** Byte-identical to stock Firefox.
**Notes:** The trap that made this a real decision: `MOZ_APP_BASENAME=Sourcerer`
is required for about:support and silently strips the `Firefox/153.0` token, and
AMO gates its install button on `browser.name === 'Firefox'` — so the naive
branding move kills extension installation, attacking the exact capability that
justified Firefox over Electron. Accepted cost: no Sourcerer identity in the UA.

### Q2 — Spend a patched line on MOZ_APP_VENDOR?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — one line, vendor becomes Sourcerer | Profile at `~/.config/sourcerer/sourcerer`; same hunk as the UA line, zero extra files | ✓ |
| No — keep patches/ literally empty | Vendor stays Mozilla; `--version` prints "Mozilla Sourcerer"; BRAND-01 unmet | |
| Yes, plus LibreWolf-style deep de-Mozilla-ing | Six files including two of the hottest in the tree, for nothing a criterion names | |

**User's choice:** Yes — one line, vendor becomes Sourcerer.

### Q3 — How should BRAND-01 criterion 1 be rewritten?

| Option | Description | Selected |
|--------|-------------|----------|
| Named-surface checklist, runnable | Six enumerated surfaces, each verified by a command | ✓ |
| Scoped grep with a documented allowlist | Catches unenumerated surfaces; allowlist must be curated every rebase | |
| Both — checklist gates, grep advises | Highest coverage; a non-blocking report gets ignored once noisy | |

**User's choice:** Named-surface checklist, runnable.
**Notes:** The existing wording is unachievable — a correctly branded build still
ships 39 files with `firefox` in the filename and 32 more containing the string,
plus 21 update-named files that survive `--disable-updater`.

### Q4 — Which BRAND-06 dev-build indicator?

| Option | Description | Selected |
|--------|-------------|----------|
| Second branding directory | Firefox's own nightly/official pattern; distinct name and icon in one move | ✓ |
| MOZ_APP_DISPLAYNAME suffix only | Cheapest, but no icon distinction "at a glance" | |
| Runtime pref or env badge | No profile consequence, but a build cannot be identified without launching it | |

**User's choice:** Second branding directory.
**Notes:** Two consequences accepted deliberately rather than by default: icons
generated twice, and dev and release builds not sharing a profile.

---

## Remote Settings + lock semantics

The Widevine framing raised earlier in the session was corrected before these
questions: `media.eme.enabled` defaults false on Linux, so Widevine is genuinely
lazy and there is no DRM-vs-BRAND-04 tension. The real unattended startup traffic
is an OpenH264 download plus an aus5 GMP ping.

### Q1 — Remote Settings?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it, name it an explicit carve-out | Preserves CRLite, intermediate-cert preloading, tracking-protection updates; criterion 4 becomes "zero except this one, for these reasons" | ✓ |
| Ship DisableRemoteSettingsAndAcceptSecurityConsequences | Literally clean capture, at the cost the policy name states | |
| Self-host a Remote Settings mirror | Needs a patch anyway and is DIST-01-shaped work, out of scope for v4.0 | |

**User's choice:** Keep it, name it an explicit carve-out.
**Notes:** There is no pref that turns it off on our channel —
`services/settings/Utils.sys.mjs:52-84` refuses the override off Nightly — so
this was genuinely a two-option choice.

### Q2 — Locked values or default prefs?

| Option | Description | Selected |
|--------|-------------|----------|
| Unlocked prefs + policies for the few that must stick | Build-time where possible, branding pref file for the rest, policies.json sparingly; no autoconfig | ✓ |
| Add an autoconfig lockPref layer | Strongest lock, but a typo in privileged JS quits the app at startup | |
| Build-time only, no pref layer | Smallest surface, but several endpoints have no build flag — would only partly meet BRAND-04 | |

**User's choice:** Unlocked prefs + policies for the few that must stick.
**Notes:** Keeps the developer able to flip a pref while daily-driving their own
product. The build-time flags fold into the hunk already being patched, so
BRAND-04's marginal rebase cost is zero files.

### Q3 — Do non-Mozilla hosts fail the check?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail on any unlisted host, waiver each | Every third-party callout is waived with a reason or turned off | ✓ |
| Only Mozilla hosts fail the check | Literal reading of criterion 4; an unattended Cisco download would pass silently | |
| Fail on any unlisted host, and cut all three | Cleanest capture, but gives up Widevine DRM | |

**User's choice:** Fail on any unlisted host, waiver each.
**Notes:** DRM is deliberately kept working — the CDM installs from Google's host
with no Mozilla endpoint involved. OpenH264 is turned off as the one genuinely
unattended startup download.

### Q4 — How are the two negative assertions proven?

| Option | Description | Selected |
|--------|-------------|----------|
| Three-layer: static, strace, DNS log | Static pref grep, exact-path strace, `MOZ_LOG=nsHostResolver:5`; each with a positive control | ✓ |
| Drive it through the existing BiDi harness | Reuses Phase 2's harness, but cannot prove a filesystem negative | |
| Sandbox it — bubblewrap with no ~/.mozilla | Strongest guarantee, but criterion 4 says "on a machine with real Firefox installed" | |

**User's choice:** Three-layer: static, strace, DNS log.
**Notes:** The exact-path rule is load-bearing —
`nsXREDirProvider.cpp:427` and `:1295` hardcode `~/.mozilla` on every build, so a
bare `.mozilla` match would false-fail a correct build. Positive controls are
mandatory per Phase 2's `verify-dev-flag-off` experience.

---

## Claude's Discretion

Recorded in CONTEXT.md `<decisions>` § "Claude's Discretion":

- Branding overlay mechanism — symlink into `upstream/` vs staged copy (leaning: symlink)
- Branding asset pipeline — five gtk icon sizes from `logo/LE logo.svg`, which needs recolouring
- The hand-written `.desktop` file — `StartupWMClass` must equal `MOZ_APP_REMOTINGNAME`
- Which prefs go in `policies.json` vs the unlocked branding pref file
- Plan/wave slicing — leaning toward Phase 2's tracer-slice-then-Wave-0 shape
- The `--with-distribution-id` value (`org.deocracy` was a research placeholder)

## Deferred Ideas

No scope creep occurred during this discussion. The deferred list in CONTEXT.md
consists of items already scoped to other phases or milestones:
Phase 4 (`sourcerer.xhtml`, `SourcererAPI.sys.mjs`, `TheiaService.sys.mjs`,
`INTERNAL-APIS.md`), post-v4.0 (scheduled rebase CI, own AUS infrastructure,
self-hosted Remote Settings mirror, Windows/macOS branding assets and installers,
opt-in telemetry, ESR major-version transition procedure, re-hosted WebExtension
UI).

## Requirements amendments arising from this discussion

Two edits are required to `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`
before or during planning:

1. **BUILD-04** and ROADMAP Phase 3 success criterion 3 — the artifact-build
   mechanism is provably incompatible with BRAND-01 (CONTEXT.md C-1). Rewrite to
   the tiered incremental loop.
2. **BRAND-01** and ROADMAP Phase 3 success criterion 1 — "a search for a
   residual 'firefox' identity string comes back empty" is unachievable on any
   correct build. Rewrite as the six-item named-surface checklist.
