---
phase: 05-lifecycle-failure-hardening
date: 2026-08-28
status: human_needed
# `status:` uses gsd-tools' verification-status routing vocabulary
# (passed | gaps_found | human_needed | stale) because this file matches the
# `*-VERIFICATION.md` glob and is currently the only file in this phase
# directory that does -- gsd-tools' verification.status reader treats it as
# the phase's verification report. `human_needed` is accurate today: every
# item below is genuinely pending a human, not fabricated and not silently
# assumed. Re-run `/gsd-verify-work` (or update this field by hand) once
# every verdict line is filled and the overall verdict is recorded.
---

# Phase 5: Manual Verification Record

Durable evidence record for Phase 5's human-only verification items, carried
in `05-VALIDATION.md`'s "Manual-Only Verifications" table (Item A, D-126) and
in this plan's own `<checkpoint_protocol>` (Items B and C, the chrome-context
hand-offs 05-02 and 05-03 each routed here because Discriminator B --
chrome-side Marionette automation -- is blocked on Linux,
`.planning/WINDOWS.md` entry 7). Built by `05-05` Task 2. Every outcome block
below is filled by a human performing the item, not by this task -- writing a
verdict here without anyone having done the item would be exactly the
fabrication `04-MANUAL-VERIFICATION.md`'s own precedent (and this project's
own repeated practice across Phases 3 and 4) forbids.

**Second-launch-focus is deliberately NOT an item here.** `05-04-SUMMARY.md`
recorded `side05-second-launch-focuses`/`side05-no-second-backend` passing
live against a real display (`start_shell_display`, no Xvfb needed on this
host) -- SIDE-05 is fully automated, with no display-unavailable gap for this
plan's own instructions to route here.

---

## Item A — One full working day as the primary IDE (ROADMAP criterion 5, D-126)

**Test (verbatim from `05-VALIDATION.md`'s Manual-Only Verifications
table):** Use Sourcerer as the primary IDE on the NixOS host for one full
working day.

**Expected:** No manual process cleanup was ever needed (no killing a
leftover backend from a terminal). No forced relaunch was ever needed (the
window never froze or went blank). If the branded error state ever appeared,
Retry recovered the session with open editors intact. The developer would
recognise this as a normal working day on an IDE, not as babysitting a
prototype.

**Why human (verbatim reasoning, D-126):** An automated soak is repeatable
but does not exercise what "daily-drivable" actually means; a multi-day soak
would gate the milestone on calendar time instead. One full working day,
human-recorded, is the instrument D-126 chose -- the same shape as Phase 3's
Items A/B and Phase 4's launch-paint item, all of which caught real defects
this project's own automated checks could not have found on their own.

**Launch command** (run from the repository root,
`/home/chris/coding/sourcerer`):

```
objdir/dist/bin/sourcerer
```

**Instructions -- record all five, in your own words, not a paraphrase:**

1. **What was worked on.** A short description of the actual work done in
   the IDE during the day (the kind of session, not a diary).
2. **Manual process cleanup.** Was a leftover `sourcerer`/backend process
   ever killed from a terminal by hand, at any point in the day? Yes/no, and
   if yes, describe when and why.
3. **Forced relaunch.** Did the window ever freeze, go blank, or otherwise
   need to be force-quit and relaunched, at any point in the day? Yes/no,
   and if yes, describe when and what led to it.
4. **Error-state count and Retry outcome.** How many times (if any) did the
   branded error state (`#sourcerer-error`) appear during the day? For each
   occurrence, did pressing Retry recover the session, and were the open
   editors/tabs still there afterward? If the error state never appeared,
   say so explicitly -- that is a valid and meaningful outcome, not a gap.
5. **Overall verdict**, in the developer's own words: was this a normal day
   of IDE use, or did Sourcerer's lifecycle/failure handling get in the way?

### Outcome — pending

- What was worked on: **pending.**
- Manual process cleanup needed (yes/no, detail): **pending.**
- Forced relaunch needed (yes/no, detail): **pending.**
- Error-state occurrences and Retry outcome each time: **pending.**
- Verdict (developer's own words): **pending.**
- Date: **pending.**
- Observer: **pending — requires a human using Sourcerer as their actual
  primary IDE for a full working day; this cannot be simulated or
  compressed, and no autonomous session can produce it.**

---

## Item B — Retry recovers the session with editor state intact (SHELL-03, D4, hand-off from `05-02-SUMMARY.md`)

**What's already proven, automated, without this item:** the Retry control's
underlying recovery mechanism (`TheiaService.retry()` → `_restart()`) is
exercised end-to-end by `shell03-auto-dismiss-on-selfheal`'s background
recovery probe, which takes the literal same code path Retry does (D-115's
own design: "a passing probe takes the same recovery path Retry takes"). The
button's presence, styling, and wiring to the `sourcererRetry()` global are
also verified by code review and by `xmllint --noout` on the shipped markup.
What is **not** automated is the physical act of clicking the button and
observing the error layer clear with the underlying editor session intact --
Discriminator B (chrome-side Marionette automation) is blocked on Linux
(`capabilities.alwaysMatch['moz:windowless']` is silently ignored outside
`AppInfo.isMac`, confirmed live against a raw Marionette socket client;
`.planning/WINDOWS.md` entry 7), so no automated harness in this repo can
click a chrome-window button.

**Test:** Launch `objdir/dist/bin/sourcerer`, get to a normal working Theia
session, open a file or two so there is visible editor state, then force the
error state to appear (the simplest live trigger: kill the backend process
directly with `pkill -f 'backend/main.js'` from a second terminal while
Sourcerer is running -- this is exactly the mid-session-crash path
`shell03-auto-dismiss-on-selfheal` already proves the machinery for). Once
the branded error layer is visible, click its **Retry** button by hand.

**Expected:** The error layer clears and the previously-open editor tabs and
their contents are still there -- no reload, no lost work, no blank Theia
frontend.

**Instructions -- record:**

1. Did clicking Retry clear the error layer? Yes/no.
2. Were the editor tabs/content from before the crash still present
   afterward? Yes/no, with any discrepancy described.
3. Roughly how long did recovery take, by eye (not a stopwatch requirement,
   just an impression: "near-instant", "a few seconds", "noticeably slow")?

### Outcome — pending

- Retry cleared the error layer: **pending.**
- Editor state intact afterward: **pending.**
- Recovery felt (near-instant/a few seconds/slow): **pending.**
- Verdict: **pending.**
- Date: **pending.**
- Observer: **pending.**

---

## Item C — Diagnostics layer via the chord, with the backend down (SHELL-04, D1/D3/D4, hand-off from `05-03-SUMMARY.md`)

**What's already proven, automated, without this item:**
`shell04-diagnostics-with-backend-down` proves the two halves this repo can
automate without chrome-context driving: the `SOURCERER_APP_IDENTITY`
startup sentinel is populated with the backend unreachable (name/vendor/
version all present), and the error layer's Details control ships enabled
(no `disabled` attribute) in the shipped markup. Code review separately
confirms `sourcererShowDiagnostics()` reads only
`TheiaService.getState()`/`getRecentLog()`/`SourcererAPI.getAppIdentity()`
(no network call, no credential in the rendered output or the
`SOURCERER_DIAGNOSTICS` sentinel), renders via `textContent` only (never
`innerHTML`), and toggles symmetrically (a second call while visible hides
it, one sentinel per call). What is **not** automated is actually pressing
`Ctrl+Alt+Shift+D` (or clicking Details) and reading the rendered fields off
the screen -- the same Discriminator B gap as Item B.

**Test:** Launch Sourcerer with `sourcerer.sidecar.backendMain` pointed at a
path that does not exist (forces the unrecoverable error state immediately,
with genuinely no backend ever running -- the same shape
`shell04-diagnostics-with-backend-down` uses):

```
mkdir -p /tmp/sourcerer-manual-verify
cat > /tmp/sourcerer-manual-verify/user.js <<'EOF'
user_pref("sourcerer.sidecar.backendMain", "/nonexistent/manual-verify/main.js");
EOF
objdir/dist/bin/sourcerer --profile /tmp/sourcerer-manual-verify
```

Once the branded error state is visible (confirming there is genuinely no
backend running), press **Ctrl+Alt+Shift+D**.

**Expected:** The diagnostics layer opens on top of the error state and
shows: port, process id, health status, restart count, a recent-log block,
and the application's brand name/vendor/version -- all populated, none
blank or showing a stale/misleading value given the backend is down. Pressing
the same chord again closes it.

**Instructions -- record:**

1. Did the chord open the diagnostics layer? Yes/no.
2. Were port, pid, health status, and restart count all visibly populated
   (not blank, not a placeholder)? Yes/no, with any field that was blank or
   wrong named explicitly.
3. Was the recent-log block populated with real log lines? Yes/no.
4. Were name/vendor/version all correct ("Sourcerer" / "Deocracy" /
   "153.1.0esr")? Yes/no.
5. Did pressing the same chord again close the layer? Yes/no.

### Outcome — pending

- Chord opened the layer: **pending.**
- Port/pid/health/restart-count populated correctly: **pending.**
- Recent-log block populated: **pending.**
- Identity fields correct: **pending.**
- Chord closed the layer on a second press: **pending.**
- Verdict: **pending.**
- Date: **pending.**
- Observer: **pending.**

---

## Requirement → Evidence Traceability

Every requirement this phase owns, and what carries its verdict -- an
automated check label, a human item above, or both when the automated
coverage is partial. Nothing here is marked done by assertion.

| Requirement | Automated check(s) (`scripts/verify-phase-05.sh`, unless noted) | Human item | Notes |
|---|---|---|---|
| SIDE-04 | `side04-sigkill-no-orphan`, `side04-unsupervised-backend-survives`, `side04-leftover-reaped`, `side04-stale-identity-not-signalled` | none required | Fully automated in both directions (D-125). One sub-claim -- the state file is removed on a genuinely clean quit -- is verified by code review only, not live, because this build installs no SIGTERM handler and SIGINT is ignored (`nsSigHandlers.cpp`); see `05-01-SUMMARY.md` coverage id D6. Not routed here because it needs a *code-level* recovery path (a future BiDi-capable graceful-quit driver), not a human click. |
| SHELL-03 | `shell03-unrecoverable-immediate-error`, `shell03-budget-exhausted-error`, `shell03-auto-dismiss-on-selfheal` | **Item B** above | The give-up/budget/auto-dismiss machinery is fully automated and live-verified; only the literal Retry button click is chrome-context-blocked and routed to Item B. |
| SHELL-04 | `shell04-diagnostics-with-backend-down` | **Item C** above | The identity sentinel and markup fallback are automated; opening the layer by chord and reading its live rendered fields is chrome-context-blocked and routed to Item C. |
| SIDE-05 | `side05-second-launch-focuses`, `side05-no-second-backend` | none required | Fully automated live on a real display (`start_shell_display`, no Xvfb needed on this host) — see `05-04-SUMMARY.md`. |
| ROADMAP criterion 5 (daily-drivable) | none — this criterion is explicitly human-only by D-126 | **Item A** above | The one criterion this phase never attempted to automate; see D-126's own rejected-alternatives reasoning in `05-CONTEXT.md`. |

## Overall Phase Verdict

**pending** — filled in only once Items A, B, and C above all carry a
completed outcome block. Do not fill this in ahead of that.
