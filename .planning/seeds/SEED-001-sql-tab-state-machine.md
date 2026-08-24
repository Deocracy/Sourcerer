---
id: SEED-001
status: dormant
planted: 2026-08-24
planted_during: "v4.0 — Phase 4 (Full-Window Theia Shell), planning"
trigger_when: when the chrome-owned tab model / unified tab strip is scoped (post-4.0 browser GUI milestone)
scope: Large
---

# SEED-001: SQL-backed persistent tab state machine, with snapshot-rendered suspended tabs

## Goal

Give Sourcerer's chrome-owned tab model an explicit, persisted, queryable state
machine — one row per tab, with real transitions and real timestamps — instead of
Firefox's model of "DOM attributes on a live element, plus one whole-file JSON blob
rewritten every 15 seconds."

Two halves, which are separable but reinforce each other:

1. **State in SQLite.** Tab lifetime (live / suspended / saved / closed) becomes
   persisted rows with transition timestamps, group membership, and TTLs — not
   ephemeral element attributes.
2. **Snapshot presentation.** A suspended tab renders its last painted frame (PNG)
   instantly on selection, with the real page swapping in underneath once loaded.
   The app-switcher trick: suspension stops feeling like degradation.

## Why This Matters

**Preventing lost data.** This is the origin of the idea. Firefox's session store is
all-or-nothing: a truncated or stale `recovery.jsonlz4` doesn't lose one tab, it loses
the set, and you fall back to a backup copy that may be minutes or a whole session old.
Row-level writes degrade gracefully instead of cliff-edging. Chris loses tabs regularly
on the real browser; this is not a hypothetical failure mode.

**Organisation.** Named, saved groups/workspaces of tabs — and the ability to save a
*section* of tabs — are the feature Firefox handles awkwardly today. They are trivially
expressible as rows with a group foreign key, and awkward as a nested array inside a
blob that is rewritten wholesale on every scroll event.

**Speed.** Two distinct wins. (a) Startup: restore selection + snapshot first, defer
content-process spin-up, so the window is interactive before anything loads. (b) Steady
state: a query-driven unloader can suspend on real policy ("untouched for a week",
"not in the active workspace") instead of Firefox's single-integer LRU heuristic.

**Firefox updates.** The reason this is a Sourcerer feature and not a Gecko patch. See
Constraints below — the whole point is that our tab model lives *outside* Gecko, so it
costs nothing at ESR rebase time. Replacing `SessionStore.sys.mjs` upstream would be the
largest imaginable patch against the most race-prone module in the front end, and the
~4-weekly rebase CI would fail forever.

**Theia peers.** Post-4.0, editors and web pages are peers in one strip. They need one
state model with per-type restore adapters. Designing that model on top of Firefox's
session store is not possible — it only knows how to serialize things it owns.

## What We Know — verified against the pinned ESR 153 tree

Read directly from `upstream/` on 2026-08-24. All line numbers are that tree.

**Session persistence is a compressed JSON blob, not a database.**
`sessionstore-backups/recovery.jsonlz4`, mozLz4 framing (`mozLz40\0` magic + 4-byte LE
decompressed size + raw LZ4 block — not standard `.lz4` framing, so `lz4 -d` fails on it).
Rewritten on a throttle (`browser.sessionstore.interval`, ~15s). Backup copies:
`recovery.baklz4`, `previous.jsonlz4`, `upgrade.jsonlz4-*`.

Confirmed by decoding this repo's own dev profile
(`~/.config/deocracy/sourcerer/1nubsoxs.default-default/sessionstore.jsonlz4`).
Top-level keys observed: `version`, `windows`, `selectedWindow`, `_closedWindows`,
`savedGroups`, `maxSplitViewId`, `session`, `global`, `cookies`.

**Bookmarks/history are the opposite case** — `places.sqlite` (`moz_bookmarks`,
`moz_places`, `moz_historyvisits`), WAL mode, with JSON only as a daily *export*
in `bookmarkbackups/`. Note: **saved tab groups are in the session-store blob
(`savedGroups`), not in places.sqlite.** That was checked and corrected during capture —
it strengthens the case here, since a saved group is exactly the long-lived named object
that should not ride in a file overwritten wholesale every 15 seconds.

**There is no single tab-state enum.** State is spread across three mechanisms:

1. *Restore state* — a two-value enum in a WeakMap, per browser:
   `TAB_STATE_NEEDS_RESTORE = 1`, `TAB_STATE_RESTORING = 2`
   ([SessionStore.sys.mjs:13-15](upstream/browser/components/sessionstore/SessionStore.sys.mjs#L13-L15)).
   "Loaded" is the *absence* of an entry — not a value, so not persistable or queryable.
2. *DOM attributes on the `<tab>` element* — the real state surface: `pending`,
   `discarded`, `crashed`, plus `busy`/`progress`/`soundplaying`/`muted`/`hidden`/
   `pinned`/`closing`.
3. *Restore priority buckets* — `tabs: { priority: [], visible: [], hidden: [] }`
   ([SessionStore.sys.mjs:8946](upstream/browser/components/sessionstore/SessionStore.sys.mjs#L8946)),
   drained in that order at startup.

**`discarded` is a styling hint, nothing more.** Set only when `aForceDiscard`
([tabbrowser.js:3128](upstream/browser/components/tabbrowser/content/tabbrowser.js#L3128));
the in-source comment says it exists "in case we want to style that differently."
An unloaded tab and a not-yet-restored tab are otherwise the same state.

**`discardBrowser` never captures a frame**
([tabbrowser.js:3098](upstream/browser/components/tabbrowser/content/tabbrowser.js#L3098)):
it resets sharing, aborts dialogs, calls `SessionStore.resetBrowserToLazyState`, removes
the progress listener, and drops the browser from the document. A suspended tab therefore
renders blank with a spinner. This is the exact seam the snapshot half fills.

**Timestamps are thin — and only one persists.**

| field | updates on | survives restart |
|---|---|---|
| `lastAccessed` | tab switch only | yes |
| `lastSeenActive` | tab switch, window focus | no |
| `_lastUnloaded` | unload (telemetry, then deleted) | no |
| `closedAt` | close | yes, until reopened |

`updateLastAccessed` ([tab.js:416](upstream/browser/components/tabbrowser/content/tab.js#L416))
stores the selected tab as `Infinity` and the getter substitutes `Date.now()` — "active"
is a sentinel, not a time. It is called in exactly two non-restore places
([tabbrowser.js:1796-1797](upstream/browser/components/tabbrowser/content/tabbrowser.js#L1796-L1797)),
on tab switch. **It does not update on page load, navigation, in-page click, form input,
or background activity.** `lastSeenActive`
([tab.js:321-343](upstream/browser/components/tabbrowser/content/tab.js#L321-L343)) has a
three-level fallback chain (`_lastSeenActive` → `container.startupTime` → `_lastAccessed`),
which is the tell that the underlying data is too thin to answer the question honestly.

Consequence: **"suspend tabs I haven't touched in a week" is not answerable today.**

**Per-history-entry payload is security-bearing.** Each entry carries
`triggeringPrincipal_base64` and `principalToInherit_base64` (serialized `nsIPrincipal`),
plus `resultPrincipalURI`, `docshellUUID`, `cacheKey`, `docIdentifier`,
`hasUserInteraction`, `navigationKey`/`navigationId`. Restoring a tab means restoring
*who was allowed to load it*, not just a URL. Any replacement store must round-trip these
opaquely and exactly.

**This ESR line has grown window-level concepts beyond tabs** — `splitViews`,
`maxSplitViewId`, `workspaceID`, `isAIWindow` appear in the window record. Split views are
a second layout model that will compete with Theia's own.

## Sketch — not a decision, just the shape

```
lazy/pending ──restore──> RESTORING ──> live ──suspend──> suspended (PNG + scroll + form)
                                          │                    │
                                       crashed ──────────> saved / archived (URL + PNG + meta)
                                          │                    │
                                          └──── closed (tombstone row, TTL) ────┘
```

| state | resident | strip shows |
|---|---|---|
| live | full content process | live page |
| suspended | nothing; PNG + scroll + form state on disk | the PNG, instantly |
| saved | URL + PNG + metadata only | the PNG, restores on click |
| closed | tombstone row with TTL | undo list |

Thumbnail is a **file path in a row**, not a blob in the row.

## Open Questions

### GUI / presentation
- How does the strip switch states visually — is the PNG a real element swapped for the
  live browser, or a background on the tab panel that the live view paints over?
- What is the handoff moment? Snapshot → live swap must not flash, double-scroll, or
  lose focus. Who owns the crossfade?
- Does the user ever see state explicitly (a badge, a dimmed tab), or is it invisible
  until they act? Firefox chose "invisible"; is that right for an IDE?
- Do saved/archived tabs live in the strip at all, or in a separate surface (a panel, a
  Theia view)?
- What does a suspended *editor* show — last frame, or a cheap re-render from buffer state?

### Capture
- Where does the frame come from? Firefox's `PageThumbs` already captures to a disk cache
  for New Tab tiles — reuse it, or capture our own at suspend time?
- Capture on suspend is too late if the process is already gone. Capture on navigate?
  On blur? On a timer? What is the cost?
- Storage budget: N tabs × PNG at what resolution? Eviction policy for thumbnails
  independent of the rows that reference them?
- Privacy: snapshots of private-browsing tabs, or of pages behind auth, must not persist.
  Where is that boundary enforced?

### Schema and persistence
- One table or several — tabs, groups, transitions, tombstones?
- Do we log every transition (an event table, full history) or only current state plus
  a few timestamps? The event table is what makes "speed up / organise" queries possible,
  but it grows unbounded.
- Which timestamps do we actually record: last-loaded, last-navigated, last-interacted,
  last-seen, last-suspended? Firefox has effectively one; what is the minimum that
  answers the policy questions we want to ask?
- WAL + crash safety: what is the durability contract? Firefox deliberately accepts
  losing ~15s. Do we promise better, and what does that cost per keystroke?
- **The sync problem we are buying.** Firefox's state cannot desync from its rendering
  because state *is* the DOM attribute. Move state into SQL and every transition is
  write-then-render; a failed write leaves the strip lying. Design for this from the
  start — it is the single biggest new risk in the idea.
- How do the opaque principal blobs round-trip? Store as-is in a column, never parsed?

### Theia peers
- One state machine with per-tab-type restore adapters, or two parallel models?
- An editor's "suspended" involves dirty buffers, cursor, scroll, panel layout —
  is that our store's problem, or does Theia keep owning it and we store a handle?
- Does Theia's own layout persistence conflict or double-store?

### Upstream and updates
- Firefox's session store keeps running for the tabs *it* owns. Do we let it, and simply
  not route our tabs through it — or do we disable it? What breaks if we do?
- Confirm the whole thing stays behind `SourcererAPI.sys.mjs` and adds zero Gecko patches,
  so the ~4-weekly ESR rebase is unaffected. If any part needs a Gecko touchpoint, it must
  be catalogued in `sourcerer/INTERNAL-APIS.md` before it is built.
- ESR 153 → 154 and beyond: `splitViews` / `workspaceID` / `isAIWindow` suggest upstream is
  actively reshaping the window record. How much of our model do their changes churn?
- Migration: if a user has an existing `recovery.jsonlz4`, do we import it once?

## Constraints (non-negotiable, from CLAUDE.md)

- **Never modify Gecko.** This is a Sourcerer-side model, not a `SessionStore.sys.mjs`
  rewrite. Any Firefox-internals touch goes through `SourcererAPI.sys.mjs` and is
  catalogued in `sourcerer/INTERNAL-APIS.md`.
- **Never fork or patch Theia core.** Editor-side work is a `@sourcerer/*` extension.
- **Not v4.0 scope.** Theia is the only GUI in v4.0. This lands with the chrome-owned tab
  model, post-4.0. Nothing in v4.0 may make it harder to land.

## Breadcrumbs

- [docs/research/sourcerer-architecture.md](docs/research/sourcerer-architecture.md) —
  mirror/proxy bridge, chrome-owned tab model, `@sourcerer/browser-bridge`
- [docs/PRODUCT-REQUIREMENTS.md](docs/PRODUCT-REQUIREMENTS.md) — R1–R9
- [.planning/ROADMAP.md](.planning/ROADMAP.md) — Phase 4 (Full-Window Theia Shell),
  Phase 5 (Lifecycle & Failure Hardening); this seed is downstream of both
- Upstream sources read for this seed:
  - [upstream/browser/components/sessionstore/SessionStore.sys.mjs](upstream/browser/components/sessionstore/SessionStore.sys.mjs)
  - [upstream/browser/components/tabbrowser/content/tabbrowser.js](upstream/browser/components/tabbrowser/content/tabbrowser.js)
  - [upstream/browser/components/tabbrowser/content/tab.js](upstream/browser/components/tabbrowser/content/tab.js)
  - [upstream/browser/components/tabbrowser/TabUnloader.sys.mjs](upstream/browser/components/tabbrowser/TabUnloader.sys.mjs)

## Notes

Captured 2026-08-24 from a design conversation that started as "why does Firefox lose my
tabs." Verified against the pinned ESR 153 tree rather than recall; one earlier claim
(saved groups in `places.sqlite`) was wrong and is corrected above.

A throwaway mozLz4 decoder was written during capture and is worth rebuilding if needed —
pure Python, ~40 lines, no `lz4` dependency: read the 8-byte magic, 4-byte LE size, then
decode the raw LZ4 block byte-wise (overlapping matches are legal and must not be
memcpy'd in bulk).
