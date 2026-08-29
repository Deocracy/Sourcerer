---
quick_id: 260829-hjj
slug: fix-windows-10-token-redaction-and-11-sidecar-state-litter
date: 2026-08-29
type: execute
autonomous: true
files_modified:
  - sourcerer/shell/TheiaService.sys.mjs
  - scripts/verify-phase-05.sh
  - scripts/verify-phase-04.sh
  - .planning/WINDOWS.md
  - .planning/phases/05-lifecycle-failure-hardening/05-REVIEW.md
  - .planning/STATE.md
must_haves:
  truths:
    - A backend line containing the per-launch token lands in the diagnostics ring buffer with the token replaced, never verbatim.
    - A null or empty token leaves the logged line byte-identical (no crash, no per-character splicing).
    - A harness browser launch writes its sidecar-state file under a throwaway config dir, so the count of ~/.config/sourcerer/sidecar-state*.json is unchanged across a run.
    - WINDOWS.md entries 10 and 11 read `fixed` in BOTH the markdown table and the JSON block, and `windows status` reports open_count 3.
  artifacts:
    - sourcerer/shell/TheiaService.sys.mjs (_pushLog redaction)
    - scripts/verify-phase-05.sh (check_shell04_log_redacts_token + HARNESS_CONFIG_HOME)
    - scripts/verify-phase-04.sh (HARNESS_CONFIG_HOME)
  key_links:
    - _pushLog is the single choke point every ring-buffer writer routes through; redacting there covers _pumpOutput, _fatal and every future caller.
    - TheiaService._resolveConfigDir() honours XDG_CONFIG_HOME ahead of HOME, which is what makes the harness redirection work with no product change.
    - verify-phase-05.sh's `ledger_entry_is_open` parses WINDOWS.md's JSON block, so a hand-edited table row without the matching JSON edit desynchronises the --gate exclusion machinery.
---

# Close WINDOWS.md 10 (token redaction) and 11 (sidecar-state litter)

Two open Phase-5 ledger entries, one product fix and one housekeeping fix, plus
the ledger/record updates that close them.

<objective>
Redact the per-launch token from the diagnostics ring buffer (WINDOWS.md 10 /
05-REVIEW.md MED-02), stop the verify harnesses from littering the developer's
real `~/.config/sourcerer` with per-profile sidecar-state files (WINDOWS.md 11),
and mark both entries resolved in the ledger and the phase record.

Purpose: MED-02 is the last code-level finding from the 05 review; entry 11 is
the last housekeeping one. Closing both takes the ledger to 3 open entries, all
of which are decisions or platform blocks rather than defects.
Output: one redaction line + guard check, harness config-dir scoping in both
launch harnesses, 305 stale files deleted, ledger/record updated.
</objective>

<context>
@.planning/WINDOWS.md
@sourcerer/shell/TheiaService.sys.mjs
@scripts/verify-phase-05.sh
@scripts/verify-phase-04.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redact the token in _pushLog and guard it with a behavioral check</name>
  <files>sourcerer/shell/TheiaService.sys.mjs, scripts/verify-phase-05.sh</files>
  <action>
In `sourcerer/shell/TheiaService.sys.mjs`, `_pushLog(line)` (currently pushes
`` `[${Date.now()}] ${line}` `` straight into `this._log`): compute a scrubbed
line before the push and buffer that instead. Use
`this._token ? line.replaceAll(this._token, "[redacted]") : line`. The truthiness
guard is load-bearing, not defensive noise: `_token` is null until `start()`
mints it, `replaceAll(null, …)` would match the literal four-character text
instead, and `replaceAll("", …)` splices the replacement between every character
of the line. Add a short comment naming the finding (MED-02 / WINDOWS.md 10) and
the reason for the guard.

Scope boundary, state it in the comment: the sibling
`SourcererAPI.log("log", line)` mirror in `_pumpOutput` stays unredacted. That
line goes to the browser's own stdout, which is where the text already came
from; the ring buffer is the surface SHELL-04 newly made reachable in-app, and it
is the one the review names. Do not widen the diff to the console mirror.

Then add one check to `scripts/verify-phase-05.sh`, in the file's existing check
style (named FAIL on stderr with the requirement id, bare argument-free function,
registered in `run_own_checks`'s `CHECKS` array):

- Function `check_shell04_log_redacts_token`, placed next to the other SHELL-04
  check.
- It is behavioral, not a grep. `TheiaService.sys.mjs`'s only chrome dependency
  is the line-16 `ChromeUtils.importESModule(…)` call, so plain node can import
  the shipped file after stubbing that one global:
  `globalThis.ChromeUtils = { importESModule: () => ({ SourcererAPI: { getIntPref: (_k, d) => d } }) };`
  then `await import(process.env.SHIPPED_THEIA_SERVICE)` (absolute path, passed
  through the environment so no shell quoting is involved) and drive
  `TheiaService._pushLog.call({ _token, _log: [] }, line)` directly. Run it with
  `node --input-type=module -e '…'`.
- Three assertions, each on a fresh `{ _token, _log: [] }` receiver, each also
  asserting the receiver ended with exactly one buffered entry: (a) token
  `TOK-11111111` and line `Cookie: sourcerer-token=TOK-11111111` produces an
  entry that does not contain the token and does contain the replacement marker;
  (b) token `null` and an ordinary line produces an entry ending in that line
  unchanged and does not throw; (c) token `""` produces an entry ending in the
  line unchanged — this is the assertion that catches the splicing bug.
- Also assert `typeof TheiaService._pushLog === "function"` before the cases, so
  a future refactor that renames or removes the method fails loudly instead of
  passing vacuously.
- Register it as `"shell04-log-redacts-token|check_shell04_log_redacts_token"`
  in the array that is built OUTSIDE the `--quick` guard (alongside
  `shell-csp-inline-attrs`): it needs no browser, no display and no built tree.
  </action>
  <verify>
    <automated>bash scripts/verify-phase-05.sh --only shell04-log-redacts-token</automated>
    <automated>bak=$(mktemp); cp sourcerer/shell/TheiaService.sys.mjs "$bak"; sed -i 's/^\( *\)const safe = this\._token.*/\1const safe = line;/' sourcerer/shell/TheiaService.sys.mjs; bash scripts/verify-phase-05.sh --only shell04-log-redacts-token; rc=$?; cp "$bak" sourcerer/shell/TheiaService.sys.mjs; rm -f "$bak"; [ "$rc" -ne 0 ]</automated>
  </verify>
  <done>
`--only shell04-log-redacts-token` PASSes against the fixed file and FAILs
against the reverted one (red-before-green proven on the real shipped file, not
a fixture), and the file is byte-restored afterwards (`git diff` shows only the
intended redaction hunk).
  </done>
</task>

<task type="auto">
  <name>Task 2: Point harness browser launches at a throwaway XDG_CONFIG_HOME and delete the stale state files</name>
  <files>scripts/verify-phase-05.sh, scripts/verify-phase-04.sh</files>
  <action>
`TheiaService._resolveConfigDir()` already reads `XDG_CONFIG_HOME` ahead of
`HOME`, so this is harness-only — no product change.

In `scripts/verify-phase-05.sh`, immediately after the `track_temp()` definition,
mint one run-scoped config home and register it for cleanup:
`HARNESS_CONFIG_HOME="$(mktemp -d)"; track_temp "$HARNESS_CONFIG_HOME"`, with a
comment naming WINDOWS.md 11.

Then use it in both launch helpers, preserving the existing CR-01 override:
- `start_shell`: replace the conditional `env_args` block with an
  unconditional `local -a env_args=(env "XDG_CONFIG_HOME=${VERIFY05_XDG_CONFIG_HOME:-$HARNESS_CONFIG_HOME}")`.
  `plant_leftover` exports `VERIFY05_XDG_CONFIG_HOME` and `unplant_leftover`
  unsets it, so the `:-` default is what makes every non-planted launch land in
  the throwaway dir while the planted-fixture launches keep pointing at their
  own parent.
- `start_shell_display`: add `"XDG_CONFIG_HOME=${VERIFY05_XDG_CONFIG_HOME:-$HARNESS_CONFIG_HOME}"` to
  the `setsid env "DISPLAY=$display_to_use" …` invocation.

In `scripts/verify-phase-04.sh`, do the same two things: mint
`HARNESS_CONFIG_HOME` after its own `track_temp()` definition, and change its
`start_shell` to `setsid env "XDG_CONFIG_HOME=$HARNESS_CONFIG_HOME" "$bin" --headless …`.
Leave `start_backend` alone — its `THEIA_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sourcerer"`
creates one directory, not per-profile litter, and repointing it is out of scope.

No cold-config risk to chase: the CR-01 and side04 planted-fixture checks
already launch against an empty `mktemp -d` config home today and pass, so a
fresh Theia config dir is a proven-good starting state for these checks.

Finally, delete the accumulated litter from the real config dir, matching only
the mktemp-profile files: `rm -f ~/.config/sourcerer/sidecar-state-_tmp_*.json`.
Confirm the two real-profile files survive:
`sidecar-state-_home_chris_sourcerer_profile_dev.json` and the legacy
unsuffixed `sidecar-state.json`. Do not touch anything else in that directory.
  </action>
  <verify>
    <automated>before=$(ls ~/.config/sourcerer/sidecar-state*.json 2>/dev/null | wc -l); bash scripts/verify-phase-05.sh --only side04-sigkill-no-orphan && after=$(ls ~/.config/sourcerer/sidecar-state*.json 2>/dev/null | wc -l) && [ "$before" = "$after" ] && [ "$after" = "2" ]</automated>
    <automated>before=$(ls ~/.config/sourcerer/sidecar-state*.json 2>/dev/null | wc -l); bash scripts/verify-phase-04.sh; rc=$?; after=$(ls ~/.config/sourcerer/sidecar-state*.json 2>/dev/null | wc -l); [ "$rc" = "0" ] && [ "$before" = "$after" ]</automated>
  </verify>
  <done>
A real supervised launch through each harness leaves the count of
`~/.config/sourcerer/sidecar-state*.json` unchanged at 2 (the two real-profile
files), `verify-phase-04.sh` is still 10/10, and the 305 `sidecar-state-_tmp_*`
files are gone. The second verify run is the slow one (full 04 suite, several
minutes, needs the built tree and `nix develop`) — run it, do not skip it.
  </done>
</task>

<task type="auto">
  <name>Task 3: Close entries 10 and 11 in the ledger and the phase record</name>
  <files>.planning/WINDOWS.md, .planning/phases/05-lifecycle-failure-hardening/05-REVIEW.md, .planning/STATE.md</files>
  <action>
Flip both entries with the tool first (the only `windows` subcommands are
`status`, `append`, `waive`, `fixed` — there is no description-edit subcommand):
`node ~/.claude/gsd-core/bin/gsd-tools.cjs windows fixed 10` then `… windows fixed 11`.

Then hand-edit the descriptions the way entries 8 and 9 were edited — prefix
`RESOLVED.` / `RESOLVED 2026-08-29.`, name the actual commit SHAs from Tasks 1
and 2, and name the guard (`shell04-log-redacts-token` for 10; the
`HARNESS_CONFIG_HOME` redirection plus the count assertion for 11). Entry 10's
description must also record the boundary Task 1 deliberately kept: the
`SourcererAPI.log` console mirror is still unredacted, by design.

CRITICAL: `WINDOWS.md` carries the markdown table AND a fenced JSON array of the
same records, and `verify-phase-05.sh`'s `ledger_entry_is_open` parses the JSON
block (not the table) to decide whether the `--gate` known-open exclusion still
applies. Every description edit must be applied to BOTH representations for that
id, and the JSON must stay valid.

In `.planning/phases/05-lifecycle-failure-hardening/05-REVIEW.md`: rewrite the
MED-02 heading in the MED-01 style — `### MED-02 — RESOLVED 2026-08-29 (<sha>): …`
followed by a `> **Status: RESOLVED.**` blockquote naming the fix, the guard and
the console-mirror boundary, leaving the original finding text below it
unedited. Then update the "Status of this file's own findings" paragraph near
the end: MED-02 now fixed, LOW-01 and LOW-02 remain the only open findings.

In `.planning/STATE.md`, update the two `Blockers/Concerns` bullets that read
`Phase 5, OPEN (WINDOWS.md 10 …)` and `Phase 5, OPEN (WINDOWS.md 11 …)` to
`CLOSED 2026-08-29`, matching the wording of the existing MED-01 `CLOSED` bullet,
and correct the "Still open and tracked" sentence in `## Current Position` so it
lists entries 1, 5 and 7 only.
  </action>
  <verify>
    <automated>node ~/.claude/gsd-core/bin/gsd-tools.cjs windows status --raw | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.open_count!==3||j.fixed_count!==8){console.error("counts wrong",j.open_count,j.fixed_count);process.exit(1)}})'</automated>
    <automated>bash scripts/verify-phase-05.sh --only shell-csp-inline-attrs</automated>
  </verify>
  <done>
`windows status` reports open_count 3 / fixed_count 8 (entries 1, 5, 7 still
open), entries 10 and 11 read `fixed` with a stamped `resolved_at` and a
`RESOLVED` description naming the commits in both the table and the JSON block,
the JSON block still parses, and 05-REVIEW.md's MED-02 section plus STATE.md's
blocker list agree with the ledger.
  </done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q-01 | Information disclosure | `TheiaService._pushLog` ring buffer rendered by the diagnostics layer | medium | mitigate | Redact the per-launch token from every buffered line at the single choke point (Task 1), guarded by `shell04-log-redacts-token` |
| T-Q-02 | Information disclosure | `SourcererAPI.log` console mirror in `_pumpOutput` | low | accept | The mirror writes to the browser's own stdout, the same class of sink the text arrived on; no new in-app surface, and the review does not name it |
</threat_model>

<success_criteria>
- Token-bearing backend output cannot reach the diagnostics panel verbatim, and
  the guard proves it red-before-green against the real shipped module.
- Neither verify harness writes into `~/.config/sourcerer` any more; the 305
  accumulated test-profile state files are gone and the 2 real ones remain.
- WINDOWS.md is at 3 open entries, with 10 and 11 resolved in both the table and
  the JSON block, and 05-REVIEW.md / STATE.md tell the same story.
</success_criteria>

<output>
Create `.planning/quick/260829-hjj-fix-windows-10-token-redaction-and-11-si/SUMMARY.md` when done.
</output>
