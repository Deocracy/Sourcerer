---
phase: quick-260829-ikk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - sourcerer/endpoint-allowlist.json
  - sourcerer/branding/dev/pref/firefox-branding.js
  - sourcerer/branding/release/pref/firefox-branding.js
  - scripts/verify-endpoints.sh
  - .planning/WINDOWS.md
autonomous: true
requirements: [BRAND-04]

estimate:
  tokens: 55000
  raw_tokens: 55000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "scripts/verify-endpoints.sh exits 0 on all three layers against objdir with the phase-04 shell launching a real Theia backend."
    - "scripts/verify-endpoints.sh --layer 3 --positive-control still exits 0 (the control still goes red) after the fix."
    - "127.0.0.1 is an allow host in sourcerer/endpoint-allowlist.json with a reason naming the phase-04 shell / TheiaService supervision design."
    - "github.com is a deny host in sourcerer/endpoint-allowlist.json and is no longer resolved at runtime."
    - "ciscobinary.openh264.org stays deny and is no longer resolved at runtime, closed by a pref whose real trigger was traced, not hypothesised."
    - "WINDOWS.md entry 5 reads status fixed in BOTH the markdown table and the fenced JSON array."
  artifacts:
    - sourcerer/endpoint-allowlist.json
    - sourcerer/branding/dev/pref/firefox-branding.js
    - sourcerer/branding/release/pref/firefox-branding.js
    - .planning/WINDOWS.md
  key_links:
    - "objdir/dist/bin/browser/defaults/preferences/firefox-branding.js is a symlink to upstream/sourcerer/branding/dev/pref/firefox-branding.js, and upstream/sourcerer is a symlink to ../sourcerer -- so a repo edit reaches the built tree with no mach build."
    - "verify-endpoints.sh layer 1 reads the installed pref only from greprefs.js, browser/defaults/preferences/firefox.js and .../firefox-branding.js; a pref placed anywhere else is invisible to it."
    - "verify-phase-03.sh check_allowlist_doc_consistency only requires ROADMAP/REQUIREMENTS mentions for allow-dispositioned *.mozilla.com/*.mozilla.net hosts -- 127.0.0.1 (allow, non-Mozilla) and github.com (deny) need no document edit."
---

<objective>
Close broken-windows ledger entry 5: verify-phase-03's `verify-endpoints` fails
because the working phase-04 shell resolves three hosts the BRAND-04 allowlist
never contemplated (127.0.0.1, github.com, ciscobinary.openh264.org).

Purpose: the allowlist is the single machine-readable source of truth for every
endpoint this build may contact. Every entry carries a reasoned decision, so
these three need decisions recorded in the file plus, for two of them, a pref
that actually stops the callout.

Output: `sourcerer/endpoint-allowlist.json` gains one allow host, one deny host
and the pref entries that back them; both branding pref files gain those prefs;
ledger entry 5 is marked fixed with a RESOLVED description naming the commits.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@sourcerer/endpoint-allowlist.json
@sourcerer/branding/dev/pref/firefox-branding.js
@scripts/verify-endpoints.sh
</context>

<established_facts>
Read these before starting. They were traced during planning against the real
`upstream/` checkout and the real built tree; do not re-derive them.

1. **The layer-3 harness now launches the whole shell.** `run_layer3_impl`
   (verify-endpoints.sh:374-375) runs
   `$BIN_PATH --headless --profile <tmp> https://firefox.settings.services.mozilla.com/`.
   Since phase 04 that binary opens `sourcerer.xhtml`, which spawns the Theia
   backend on loopback and loads the Theia frontend. That is why all three new
   hosts appear: the run is no longer a bare Gecko startup.

2. **Pref edits need no rebuild.**
   `objdir/dist/bin/browser/defaults/preferences/firefox-branding.js` is a
   symlink to `upstream/sourcerer/branding/dev/pref/firefox-branding.js`, and
   `upstream/sourcerer` is a symlink to `../sourcerer`. Editing the repo file
   changes what the next launch reads. (verify-endpoints.sh:236-239 states the
   same thing for its own control.)

3. **github.com's source is the Theia welcome widget.**
   `theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx:13`
   exports `SOURCERER_REPO_URL = 'https://github.com/Deocracy/Sourcerer'` and
   renders it as a link. Gecko speculatively DNS-prefetches link targets.
   `network.dns.disablePrefetch` defaults **false**
   (upstream/modules/libpref/init/StaticPrefList.yaml:15308) and
   `network.dns.disablePrefetchFromHTTPS` also defaults **false** (:15161) --
   so the http-vs-https origin of the Theia frontend is irrelevant, prefetch is
   live either way, and `network.dns.disablePrefetch = true` is the one pref
   that turns it off.

4. **The allowlist's stated rationale for OpenH264 is wrong in one respect, and
   this is the lead for the trace.** `GMPUtils.isPluginHidden`
   (upstream/toolkit/modules/GMPUtils.sys.mjs:27-41) never reads
   `media.gmp-gmpopenh264.enabled`. For a non-EME plugin it returns false --
   i.e. NOT hidden -- whenever `_isPluginSupported` and `_isPluginVisible` both
   hold, and `_isPluginVisible` (:82-84) reads `media.{id}.visible`, a
   different pref. This is the same correction the allowlist already recorded
   for Widevine on the `update.googleapis.com` entry, now applying to OpenH264.

5. **But the download itself IS gated by our pref.**
   `GMPInstallManager.simpleCheckAndInstall`
   (upstream/toolkit/modules/GMPInstallManager.sys.mjs, the filter at ~line
   603-650) calls `this._isAddonEnabled(gmpAddon.id)`, which reads
   `media.gmp-gmpopenh264.enabled`, and drops the addon. So the observed DNS
   resolution is probably **not** the plugin download -- it is something that
   happens either upstream of that filter or outside GMPInstallManager
   entirely.

6. **What runs upstream of that filter.** With `media.gmp-manager.url` blank
   the Balrog fetch fails, so `checkForAddons` falls back to
   `downloadLocalConfig(getLocalSources())` (:320-330). `getLocalSources`
   returns the in-tree `chrome://global/content/gmp-sources/openh264.json`
   (:33-53, a chrome: URL, no DNS) because
   `media.gmp-manager.allowLocalSources` defaults true. That yields a GMPAddon
   carrying `URL: <ciscobinary.openh264.org fileUrl>`, and
   `adjustForChromiumUpdateService(addons)` (:375) then runs over **all** of
   them before the enabled filter ever executes.

7. **Narrowest-pref candidates, in order, if the trace lands on the GMP path.**
   `media.gmp-gmpopenh264.visible = false` (turns `isPluginHidden` true for
   OpenH264 alone) is narrow and safe. `media.gmp-gmpopenh264.autoupdate =
   false` is narrower still if the trace shows the auto-update path
   specifically. **`media.gmp-manager.updateEnabled = false` is forbidden** --
   `checkForAddons` (:288-292) returns early on it, which would also kill the
   Widevine Chromium update check that D-86 deliberately keeps working
   (`update.googleapis.com` is an `allow` entry). Do not reach for it.

8. **Doc-consistency check does not apply.**
   `verify-phase-03.sh::_allowlist_doc_consistency_impl` (:174-176) filters to
   allow-dispositioned `*.mozilla.com` / `*.mozilla.net` hosts only. Neither
   new entry qualifies, so ROADMAP.md and REQUIREMENTS.md need no edit.

9. **Host matching is exact.** `allowlist_host_allowed`
   (verify-endpoints.sh:345-349) matches the host string exactly, or by suffix
   only when the allowlist entry begins with a literal dot. `127.0.0.1` as a
   plain string entry is correct.
</established_facts>

<tasks>

<task type="tracer">
  <name>Task 1: Trace what actually resolves ciscobinary.openh264.org, with the prefetch pref as the free discriminator</name>
  <files>(no product edit in this task -- findings only; scratch files under the session scratchpad)</files>
  <precondition>`objdir/dist/bin/sourcerer` exists and launches (the phase-04 shell build). If it does not, stop and report -- this task cannot be simulated.</precondition>
  <action>
Do NOT build a bespoke trace harness first. Run the free discriminator, then
instrument only if it fails to settle the question.

Step 1 -- baseline. Reproduce the current failure exactly as the harness sees
it: `bash scripts/verify-endpoints.sh --layer 3`. Record the exact violation
host list it prints. This is the red state the fix must clear.

Step 2 -- the discriminator. Temporarily append
`pref("network.dns.disablePrefetch", true);` to
`sourcerer/branding/dev/pref/firefox-branding.js` (established fact 2: this
reaches the built tree immediately, no rebuild) and re-run
`bash scripts/verify-endpoints.sh --layer 3`. One run now answers two
questions:
  - github.com gone => item 2's decision is confirmed empirically, not just by
    reading the widget source.
  - ciscobinary.openh264.org ALSO gone => the ledger's "GMP manager woken by a
    real page" hypothesis is wrong; it was a speculative prefetch, and one pref
    closes both. Record that explicitly as a correction to the ledger's
    description.
  - ciscobinary.openh264.org SURVIVES => it is the GMP path. Go to step 3.

Step 3 -- only if the host survived step 2. Instrument the GMP manager rather
than guessing. Its logging goes through Log.sys.mjs, not MOZ_LOG: create the
profile up front and plant `media.gmp.log.level` and `media.gmp.log.dump=true`
in its prefs.js (key names are in `GMPPrefs` at
upstream/toolkit/modules/GMPUtils.sys.mjs, KEY_LOGGING_LEVEL / KEY_LOGGING_DUMP),
then launch the binary the same way `run_layer3_impl` does -- same
`MOZ_LOG=nsHostResolver:5` / `MOZ_LOG_FILE` capture, same 35s window -- with
stdout captured too. Correlate the `Resolving host [ciscobinary.openh264.org]`
timestamp in the moz_log against the Toolkit.GMP lines and against the
127.0.0.1 / firefox.settings resolutions: a resolution clustered at the ~30s
mark alongside the AddonManager timer is the periodic `findUpdates` path, one
clustered with the Theia frontend load is page-driven. Use established facts
4-6 to name which call site it is; if the log shows the addon reaching
`adjustForChromiumUpdateService` or an install attempt, say which line.

Step 4 -- pick the narrowest pref that closes whatever step 2 or 3 found,
per established fact 7. Do not reach for `media.gmp-manager.updateEnabled`.

Revert the temporary pref append before finishing this task -- Task 2 writes
the real, commented version. Leave the tree clean (`git status` shows no
modification to the pref file).

Write the finding as prose in the task record: the exact call site, the
discriminator that settles it, and the chosen pref. If step 2 already settled
it, say so and skip step 3 -- do not run an instrumented trace to confirm a
question a passing run already answered.
  </action>
  <verify>
    <automated>bash scripts/verify-endpoints.sh --layer 3 2>&1 | tail -20 ; git status --porcelain sourcerer/branding/dev/pref/firefox-branding.js</automated>
  </verify>
  <done>The real trigger for ciscobinary.openh264.org is named with its call site and the observation that discriminates it from the alternatives; the pref that closes it is chosen; the pref file is back to its committed bytes (`git status --porcelain` prints nothing for it).</done>
</task>

<task type="auto">
  <name>Task 2: Land the prefs and the three allowlist decisions</name>
  <files>sourcerer/branding/dev/pref/firefox-branding.js, sourcerer/branding/release/pref/firefox-branding.js, sourcerer/endpoint-allowlist.json, scripts/verify-endpoints.sh</files>
  <action>
Prefs. Add `network.dns.disablePrefetch` set to true, plus whatever pref Task 1
chose for OpenH264, to BOTH `sourcerer/branding/dev/pref/firefox-branding.js`
and `sourcerer/branding/release/pref/firefox-branding.js`. The two files are
byte-identical today except for the dev-only `browser.tabs.inTitlebar` block at
the end of the dev file, so add the same block to both, in the same position,
in the existing comment style: a `// ---` section header naming the mechanism
and the reason, then the bare `pref(...)` line. Match the existing file's
convention of citing the upstream file:line the claim rests on. Prefs stay
unlocked plain `pref()` per D-84.

Allowlist hosts -- add three entries to `hosts` in
`sourcerer/endpoint-allowlist.json`, each with the reasoned-decision prose the
existing entries use (state the mechanism, the upstream evidence, and why the
disposition is what it is; do not write a one-line label):

  - `127.0.0.1`, disposition `allow`. It is the Theia sidecar loopback and it
    is the architecture, not a concession: the phase-04 shell supervises a
    bundled Node + Theia browser-target backend on localhost and presents it
    full-window, so a build that could not reach loopback would have no GUI.
    Name the phase-04 shell / TheiaService supervision design in the reason.
    Note that it is a literal loopback address -- no name resolution leaves the
    machine.

  - `github.com`, disposition `deny`. Root cause is
    `theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx:13`
    rendering a link to the project repo, which Gecko speculatively
    DNS-prefetches. Closed by `network.dns.disablePrefetch`, not by removing
    the link -- the link is a real, wanted affordance and a user who clicks it
    is making an explicit request, exactly the distinction the
    `geo.provider.network.url` and `dom.push.enabled` entries already draw.
    The entry exists as `deny` rather than being absent so the file stays the
    single source of truth: an observation of this host is a failure either
    way, and the reason records why it is not expected.

  - `ciscobinary.openh264.org` -- do NOT add a second entry; the host is
    already present as `deny`. AMEND its existing reason to record what Task 1
    actually found: that `media.gmp-gmpopenh264.enabled = false` alone did not
    stop the resolution once the phase-04 shell was live, why (established fact
    4 -- `isPluginHidden` reads `media.{id}.visible`, not `.enabled`, so the
    existing rationale was incomplete in the same way the `update.googleapis.com`
    entry already records for Widevine), and which pref closes it. Keep
    disposition `deny`.

Allowlist prefs -- add an entry to `prefs` for `network.dns.disablePrefetch`
with `expect: true`, and one for the OpenH264 pref Task 1 chose with its
`expect` value, each with a reason in the existing style. Layer 1 asserts these
against the installed file, so the name must match exactly. Leave every
existing pref entry untouched, including `media.gmp-gmpopenh264.enabled` --
it is still correct and still wanted, it just is not sufficient on its own.

Layer-3 positive control -- read `run_layer3_impl`'s control branch
(verify-endpoints.sh:361-367). It appends `media.gmp-gmpopenh264.enabled = true`
and requires a violation to surface. If the pref Task 1 chose means that append
no longer surfaces ciscobinary.openh264.org, the control has gone vacuous and
D-88's whole point is that a negative check without a demonstrated-red control
proves nothing. In that case change the control to append the pref the fix
actually relies on (set back to its stock value) instead of, or in addition to,
the `enabled` line, and say so in the surrounding comment. If Task 1's pref
leaves the control still going red, change nothing here.
  </action>
  <verify>
    <automated>bash scripts/verify-endpoints.sh --layer 1 && node -e 'const a=require("./sourcerer/endpoint-allowlist.json");const h=Object.fromEntries(a.hosts.map(x=>[x.host,x.disposition]));const p=Object.fromEntries(a.prefs.map(x=>[x.name,x.expect]));if(h["127.0.0.1"]!=="allow")throw new Error("127.0.0.1 not allow");if(h["github.com"]!=="deny")throw new Error("github.com not deny");if(h["ciscobinary.openh264.org"]!=="deny")throw new Error("openh264 host not deny");if(p["network.dns.disablePrefetch"]!==true)throw new Error("prefetch pref missing or wrong expect");console.log("allowlist decisions OK")' && grep -c 'network.dns.disablePrefetch' sourcerer/branding/dev/pref/firefox-branding.js sourcerer/branding/release/pref/firefox-branding.js</automated>
  </verify>
  <done>Layer 1 passes with the new pref entries; the allowlist carries 127.0.0.1 allow, github.com deny and an amended ciscobinary.openh264.org deny reason; both branding pref files carry the new prefs; the layer-3 positive control is either unchanged-and-still-red or updated to stay red.</done>
</task>

<task type="auto">
  <name>Task 3: Prove all three layers and both controls green, then close ledger entry 5</name>
  <files>.planning/WINDOWS.md</files>
  <action>
Run, in this order, and require each to exit 0:

  1. `bash scripts/verify-endpoints.sh` -- all three layers, the real
     assertions. This is the acceptance criterion the ledger entry names.
  2. `bash scripts/verify-endpoints.sh --positive-control` -- all three
     controls must still go red. A layer-3 control that now passes vacuously
     means Task 2's control edit was needed and was not made; go back and make
     it.
  3. `bash scripts/verify-endpoints.sh --interrupt-self-test` -- the pref file
     grew two entries, so re-prove the interrupt path still restores it
     byte-identically.
  4. `bash scripts/verify-phase-03.sh` -- the allowlist schema, doc-consistency
     and doc-consistency-self-test checks read the file this task changed.

If layer 3 still reports a violation, do not widen the allowlist to make it
pass. Report the surviving host and stop -- an unexplained host is the exact
failure mode this check exists to catch, and a fourth undecided entry is a new
ledger entry, not a fix for this one.

Then close the ledger. Run
`node ~/.claude/gsd-core/bin/gsd-tools.cjs windows fixed 5`, then hand-edit
`.planning/WINDOWS.md` so entry 5's description carries a `RESOLVED
<date> (<commit>, <commit>)` prefix naming the actual fix commits, matching the
style of entries 6, 8, 9, 10 and 11. Write it in BOTH places: the markdown
table row AND the fenced JSON array below it -- `verify-phase-05.sh`'s
`ledger_entry_is_open` parses the JSON block, so a table-only edit leaves the
entry open to the gate. The description must state the mechanism for each of
the three hosts, name the pref that closes each, and record the correction to
the `isPluginHidden` rationale, in the evidence-carrying style the other
resolved entries use.

Finish by re-running `bash scripts/verify-phase-05.sh` (or its `--gate` mode)
to confirm entry 5 is no longer counted open and no other check regressed.
  </action>
  <verify>
    <automated>bash scripts/verify-endpoints.sh && bash scripts/verify-endpoints.sh --positive-control && bash scripts/verify-endpoints.sh --interrupt-self-test && bash scripts/verify-phase-03.sh && node -e 'const t=require("fs").readFileSync(".planning/WINDOWS.md","utf8");const j=JSON.parse(t.slice(t.indexOf("[",t.indexOf("```json")),t.lastIndexOf("]")+1));const e=j.find(x=>x.id===5);if(e.status!=="fixed")throw new Error("ledger 5 still "+e.status);if(!/RESOLVED/.test(e.description))throw new Error("ledger 5 JSON description lacks RESOLVED prefix");const row=t.split("\n").find(l=>l.startsWith("| 5 |"));if(!/\| fixed \|/.test(row))throw new Error("ledger 5 table row still open");if(!/RESOLVED/.test(row))throw new Error("ledger 5 table row lacks RESOLVED prefix");console.log("ledger 5 closed in both table and JSON")'</automated>
  </verify>
  <done>All three verify-endpoints layers pass, all three positive controls still go red, the interrupt self-test passes, verify-phase-03.sh passes, and WINDOWS.md entry 5 reads status `fixed` with a RESOLVED description naming the fix commits in both the table row and the JSON array.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| built browser -> public internet | Every host this build resolves at startup, unattended, with no user request behind it. `endpoint-allowlist.json` is the enforcement surface. |
| Theia frontend (in-content) -> Gecko network stack | Page content -- including link targets Theia renders -- can induce network activity the user never asked for. This is the new surface phase 04 introduced. |
| chrome shell -> Theia backend | Loopback only; the new `127.0.0.1` allow entry is the record of that decision. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ikk-01 | Information disclosure | Gecko DNS prefetch of Theia-rendered link targets | medium | mitigate | `network.dns.disablePrefetch = true` in both branding pref files; the target host recorded as `deny` so a regression fails the check rather than passing silently. |
| T-ikk-02 | Information disclosure | GMP manager unattended callout to ciscobinary.openh264.org | medium | mitigate | Trace the real trigger (Task 1), close it with the narrowest pref, record both the pref and the corrected `isPluginHidden` rationale in the allowlist. |
| T-ikk-03 | Tampering | Widening the allowlist to make a red check green | high | mitigate | Task 3 forbids adding an entry for an unexplained surviving host; an undecided host becomes a new ledger entry instead. |
| T-ikk-04 | Repudiation | A positive control that passes vacuously after the fix | high | mitigate | Task 2 requires the layer-3 control to be re-pointed at the pref the fix relies on if the existing append no longer goes red; Task 3 runs all three controls. |
| T-ikk-05 | Elevation of privilege | `127.0.0.1` allow entry read as a general loopback waiver | low | accept | Exact-string match only (verify-endpoints.sh:345-349, suffix matching requires a leading literal dot), so the entry admits one literal address and nothing else. |
</threat_model>

<verification>
- `bash scripts/verify-endpoints.sh` exits 0 (all three layers, real assertions).
- `bash scripts/verify-endpoints.sh --positive-control` exits 0 (all three controls went red).
- `bash scripts/verify-endpoints.sh --interrupt-self-test` exits 0.
- `bash scripts/verify-phase-03.sh` exits 0.
- `bash scripts/verify-phase-05.sh` exits 0 and no longer counts entry 5 open.
- `git status` shows no stray edits to `upstream/` (Gecko is never modified; the only pref changes are under `sourcerer/branding/`).
</verification>

<success_criteria>
- Ledger entry 5's three hosts each carry a recorded decision in `sourcerer/endpoint-allowlist.json`, each backed by a pref where a pref is what closes it.
- The ciscobinary.openh264.org trigger is named by trace, not hypothesis, and the allowlist records the corrected `isPluginHidden` rationale.
- No Gecko file under `upstream/` (other than the pre-existing `upstream/sourcerer` symlink target) is modified.
- WINDOWS.md entry 5 is `fixed` in both the markdown table and the fenced JSON array.
</success_criteria>

<output>
Create `.planning/quick/260829-ikk-close-windows-5-allowlist-127-0-0-1-disa/260829-ikk-SUMMARY.md` when done.
</output>
