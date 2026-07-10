# Phase 4: Applet Framework - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 4-applet-framework
**Areas discussed:** host.ai() contract for applets, Demo stub depth, host.storage scoping, Registry ↔ rail/catalog behavior

---

## host.ai() contract for applets

| Option | Description | Selected |
|--------|-------------|----------|
| Real Pi sidecar | Route applet calls through the Phase 7 sidecar; FWK-04 "stubbed" wording superseded | ✓ |
| Canned stub, sidecar-shaped | Deterministic fake responses, sidecar-matching signature | |
| Stub with runtime toggle | Stub by default, dev flag routes to sidecar | |

**User's choice:** Real Pi sidecar

| Option | Description | Selected |
|--------|-------------|----------|
| Simple promise | ai(prompt) → Promise<string> only | |
| Streaming events | Full sidecar event stream to applets | |
| Promise + optional onDelta | Promise resolution + opt-in incremental text callback | ✓ |

**User's choice:** Initially asked to discuss capabilities/drawbacks; after a trade-off
chart and a per-applet fit mapping (~6 applets need promise-only, ~5 want streaming text,
only Chat/Builder want full events), user raised "should we have 3 applet types, 1 with
options, or 2?" — settled on **ONE applet type with capability options** (promise+onDelta),
with a reserved additive agentic seam for Chat/Builder.
**Notes:** Stateless one-shot calls (no applet conversation state). Sessions question
explicitly surfaced; Chat's conversation needs deferred to its own phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Lean, no tools | Plain completions, no corpus tools | ✓ |
| Same tools as assistant | Corpus-aware but slower/costlier | |
| Per-call opt-in flag | Lean default + {tools:true} opt-in | |

**User's choice:** Lean, no tools

| Option | Description | Selected |
|--------|-------------|----------|
| Promise rejects | Typed error; applet renders its own error UI | ✓ |
| Resolve with error string | Never rejects | |
| Reject + shell-level notice | Rejects + global notice (no toast system exists) | |

**User's choice:** Promise rejects

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-cancel on unmount | Call tied to instance; tab close abandons it; no manual cancel v1 | ✓ |
| AbortSignal in the contract | Standard AbortController pattern | |
| Fire-and-forget | Calls run to completion regardless | |

**User's choice:** Auto-cancel on unmount

| Option | Description | Selected |
|--------|-------------|----------|
| Concurrent, per-instance | One in-flight call per instance, alongside the assistant | ✓ |
| Global queue | One AI call at a time app-wide | |
| Unlimited free-for-all | No limits | |

**User's choice:** Concurrent, per-instance. User asked whether concurrent calls have
cross-awareness (assistant seeing applet AI activity and vice versa); three escalating
flavors were sketched (activity log / state tools / shared memory). **Correction during
discussion:** user initially appeared to pick flavor 1, then clarified they meant
concurrency option 1 — cross-awareness stays **deferred with mechanism undecided**; no
activity log built in Phase 4.

---

## Demo stub depth

| Option | Description | Selected |
|--------|-------------|----------|
| Rich where handoff has one | Port wiki.js + library.js as full demos; templated stubs for the rest | ✓ |
| Uniform template for all 13 | One templated stub everywhere | |
| Rich demos for every applet | Hand-author content for all 13 | |

**User's choice:** Rich where handoff has one

| Option | Description | Selected |
|--------|-------------|----------|
| Stubs are applets too | Every stub registered through registry.ts; dogfoods the contract | ✓ |
| Stubs are shell built-ins | Registry holds only real applets | |

**User's choice:** Stubs are applets too

| Option | Description | Selected |
|--------|-------------|----------|
| Per-applet fake rows | 3–5 believable rows per applet | |
| Generic rows for all | Same neutral rows everywhere | |
| You decide | Claude picks per applet during planning | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle DEMO marker | Small mono DEMO chip/eyebrow on every stub | ✓ |
| No marker — fully believable | Stubs pass as real | |
| Loud placeholder banner | Obvious "not yet built" notice | |

**User's choice:** Subtle DEMO marker

---

## host.storage scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Applet-scoped + instance slot | Shared per applet; per-tab UI state via Phase 3 instanceId slot | ✓ |
| Applet-scoped only | Leave the D-10 slot unsettled | |
| Per-instance by default | Isolated storage per tab | |

**User's choice:** Applet-scoped + instance slot

| Option | Description | Selected |
|--------|-------------|----------|
| Separate applets store | Dedicated plugin-store file (applets.json) | ✓ |
| Fold into workspace.json | One file for everything | |
| One file per applet | 13 files | |

**User's choice:** Separate applets store

| Option | Description | Selected |
|--------|-------------|----------|
| Async Promise API | get/set/remove return Promises | ✓ |
| Preload + sync reads | Host preloads namespace before mount | |

**User's choice:** Async Promise API
**Notes:** Before answering, the user shared the Power Browser vision (multi-engine:
Lightpanda/ungoogled-Chromium, headless/headful, tab hibernation, assistant loading/observing
tabs, KeyPass autofill the assistant can't read). Captured as deferred ideas + one contract
note (future additive pane geometry/visibility host capability); research deferred to the
Power Browser phase.

---

## Registry ↔ rail/catalog behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Focus-or-open | Focus existing tab, else open fresh instance in active group | ✓ |
| Always new instance | Every call opens a new tab | |
| Replace active pane | Swap the caller's own pane content | |

**User's choice:** Focus-or-open

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, catalog picker | Real registry-fed picker replaces the '+' cycle hack | ✓ |
| No, keep the cycle | Defer picker | |
| Minimal menu | Plain dropdown of titles | |

**User's choice:** Yes, catalog picker

| Option | Description | Selected |
|--------|-------------|----------|
| Append to end | New keys append at bottom of main group, above pinned footer | ✓ |
| Registry order wins | Rail mirrors registry order | |
| You decide | Claude picks the merge rule | |

**User's choice:** Append to end

---

## Claude's Discretion

- Templated stub demo-row content per applet (richer where cheap, generic where not)
- appletDefs.ts merge-into-registry vs derived map
- host.theme delivery shape (tokens object vs CSS vars)
- Per-instance state surface API shape (over Phase 3's D-10 slot)
- Catalog picker placement/interaction details (pixel pass via /gsd-ui-phase 4)
- Manifest `code` crumb values (from handoff where specified)

## Deferred Ideas

- Assistant↔applet AI cross-awareness — mechanism deliberately undecided
- Agentic host.ai extension (events/tools/sessions) for Chat + Applet Builder
- Power Browser engine selection (Lightpanda vs ungoogled-Chromium, headless/headful, per-tab redirect)
- Power Browser tab hibernation/sleep (survey Chromium discarding, Auto Tab Discard, CDP lifecycle)
- Assistant↔browser interplay (pre-load session tabs, observe, pull notes across tabs)
- KeyPass autofill boundary (assistant triggers fill, never reads secrets)
- Pane geometry/visibility host capability (additive; enables native webview over a pane)
