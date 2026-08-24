---
id: SEED-001
status: dormant
planted: 2026-08-24
planted_during: "v4.0 — Phase 4 (Full-Window Theia Shell), planning"
trigger_when: when the chrome-owned tab model / unified tab strip is scoped (post-4.0 browser GUI milestone), or when any persistent store for browsing data is designed
scope: Large
---

# SEED-001: Unified SQL store for tabs, history, sessions and bookmarks

_Was: "SQL-backed persistent tab state machine." Widened 2026-08-24 — the state machine is
one part of a single store, alongside an MCP organiser, an organiser GUI, and optional
encryption._

> **Status: capture only.** Nothing here is scheduled. No spike, no phase, no prototype, and
> no plan to create one. Every "order", "method", and "first" below is reasoning recorded so
> it does not have to be re-derived — not a queue. This seed sits dormant until
> `/gsd-new-milestone` surfaces it and someone decides to act on it.

## Goal

**One store for everything that is "a place you have been or want to go back to."**
Tabs, tab history (back/forward), closed-tab tombstones, sessions, saved tab groups,
browsing history, and bookmarks are today four disconnected mechanisms in two storage
formats. They are the same kind of object at different lifetimes. Merge them into a
single queryable store, with lifetime as a column rather than as a choice of file format.

On top of that store, give Sourcerer's chrome-owned tab model an explicit, persisted
state machine — one row per tab, real transitions, real timestamps — instead of Firefox's
model of "DOM attributes on a live element, plus one whole-file JSON blob rewritten every
15 seconds."

Five parts, separable in delivery but sharing one schema decision:

1. **Unified store.** Tabs, history, sessions, groups, bookmarks in one SQLite database.
   Lifetime (live / suspended / saved / closed / bookmarked / historical) is a state
   column, not a separate subsystem.
2. **State machine.** Persisted transitions with timestamps and TTLs, replacing ephemeral
   DOM attributes and the single coarse `lastAccessed` integer.
3. **Snapshot presentation.** A suspended tab renders its last painted frame (PNG)
   instantly on selection, real page swapping in underneath. The app-switcher trick:
   suspension stops feeling like degradation.
4. **MCP server over the store.** Expose the store to an LLM so it can organise it —
   cluster, name groups, prune, resurface, answer "what was I working on."
5. **Organiser GUI.** A real surface for the above, with encryption of the database
   offered as an option.

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

## The Unified Store

The merge is the reframe, and it is the part that makes everything else cheap.

Today: open tabs and sessions live in `recovery.jsonlz4` (blob, no queries); bookmarks and
history live in `places.sqlite` (relational, queryable); saved tab groups live in the blob
despite being long-lived named objects. A tab, a closed tab, a bookmark, and a history
entry are all "a URL with a title, a time, and some context" — the difference is lifetime
and intent, not kind.

One store means:
- **"Where have I seen this URL?"** is one query across every lifetime, not three lookups
  in two formats.
- **Promotion is an UPDATE, not an export.** Tab → saved group → bookmark stops being three
  serialisation paths.
- **Nothing falls between the cracks.** A closed tab that ages out today is simply gone;
  in a unified store it degrades into history rather than vanishing.
- **The LLM has one thing to read.** See below — an organiser that has to reconcile a blob
  and a database is doing archaeology, not organising.

Open question, and it is the load-bearing one: does this **replace** `places.sqlite` for
our tabs' purposes, **wrap** it, or **sit alongside** it? Firefox's own machinery (awesomebar
frecency, history sidebar, sync) reads places directly and we do not patch Gecko. Most likely
shape: places stays as Gecko's, our store is authoritative for the Sourcerer tab model, and
one of the two mirrors into the other. Which direction that mirror runs is unresolved.

## LLM Organiser (MCP Server)

Expose the unified store as an MCP server so an LLM can do the organising that no heuristic
does well.

Plausible tools: query tabs/history/bookmarks by time, domain, group, or content; propose
and apply groupings; name a group from its contents; suggest what to suspend, archive, or
close; reconstruct "what was I working on last Tuesday"; find duplicates and near-duplicates;
surface stale bookmarks that were never revisited.

This is the payoff for putting the data in SQL: an LLM can write a query, but it cannot
usefully grep a 15-second-stale LZ4 blob. It is also why the transition/event history matters
more than current state alone — "you opened these eleven tabs in one burst on Tuesday
afternoon and never returned to nine of them" needs timestamps that Firefox does not keep.

Hard boundary: the MCP server reads the user's entire browsing life. Read/write scoping,
which fields are exposed at all, whether page snapshots or titles are visible, and whether
this ever reaches a remote model are gating design decisions, not implementation details.
See Encryption below — they interact.

## Organiser GUI

A real surface for organising, not a context menu. Groups, workspaces, archived sets,
snapshot thumbnails as the visual unit, drag-to-group, bulk suspend/archive/close, and the
LLM's proposals shown as reviewable suggestions rather than applied silently.

Post-4.0 by definition — v4.0 has no custom browser chrome. Whether this is browser chrome,
a Theia view, or a page is open. A Theia view is cheapest to build and the most natural home
for an IDE-shaped audience; browser chrome is the correct long-term answer for something that
manages tabs. It may be both, over time.

## Encryption at Rest

Offer encryption of the database as an option. Checked during capture — the "easy" depends
entirely on which process owns the DB, and this is the sharpest fork in the whole design:

- **Gecko side: not easy.** The bundled SQLite has no encryption support — no `SQLITE_HAS_CODEC`,
  no SQLCipher anywhere in `storage/` or `third_party/sqlite3/`. mozStorage cannot encrypt a
  database file. Adding it means patching Gecko's SQLite build, which the hard rules forbid.
  What *does* exist is NSS's Secret Decoder Ring (`security/manager/ssl/nsISecretDecoderRing.idl`),
  which the password manager uses to encrypt individual values into `logins.json` under the
  primary password. That gives per-field encryption, not an encrypted database.
- **Node/Theia side: genuinely easy.** The sidecar is an ordinary Node process; SQLCipher via
  a native binding is a normal dependency, and `PRAGMA key` is one line. If our store lives
  with the sidecar rather than in Gecko, "encrypt the DB" is close to free.

So this question is not really about encryption — it is about **where the store lives**, and
encryption is the forcing function that makes the answer obvious. That is a useful thing to
have learned before designing the schema.

Either way: key management is the real work. Primary-password integration, key at rest, what
happens on a forgotten password, whether snapshots (which are files on disk, not rows) are
encrypted too, and whether the MCP server can read the store while it is locked.

## Cookies and Certificates — probably not ours

Raised as an open question 2026-08-24. Current reading: **no, keep them out of the store**,
but the tab model has to reference them, and one narrow case does land in our DB.

**Cookies are already SQLite, and already someone else's.** `cookies.sqlite`, table
`moz_cookies`, owned by C++ `CookiePersistentStorage`
([netwerk/cookie/CookiePersistentStorage.cpp:52](upstream/netwerk/cookie/CookiePersistentStorage.cpp#L52)),
partitioned by origin attributes and `partitionKey`. Nothing is gained by moving it — it is
not a blob problem, it is not queried by the tab model, and every network request depends on
it. Taking it over means reimplementing cookie policy, partitioning, and expiry inside our
process. That is a Gecko rewrite wearing a schema.

**Certificates are not even mozStorage.** `cert9.db` and `key4.db` are NSS-owned softoken
databases with their own format, plus `pkcs11.txt` for modules
([security/manager/ssl/nsNSSComponent.cpp:1437-1480](upstream/security/manager/ssl/nsNSSComponent.cpp#L1437-L1480));
user-accepted cert exceptions live in `cert_override.txt`
([nsCertOverrideService.cpp:38](upstream/security/manager/ssl/nsCertOverrideService.cpp#L38)).
These are the trust root of the browser. Reimplementing them is out of the question, and they
are not "places you have been" — they are capabilities and credentials, a different kind of
object with a different lifetime.

**The general principle worth keeping:** our store owns *navigational intent* — where you
went, where you want to go back to, how it was arranged. It does not own *authority* — what
you are allowed to do there. Cookies and certs are authority. Merging authority into a store
whose whole purpose is to be freely queried by a GUI and an LLM is the wrong direction.

**But three real touchpoints:**

1. **Container / partition identity must be a column.** A tab is already stamped with
   `userContextId`, and cookie storage is keyed by origin attributes including `partitionKey`.
   A restored tab that loses its container identity restores into the wrong cookie jar. We
   store the key, never the cookies.
2. **Session-only cookies are the one genuine overlap.** `SessionCookies.sys.mjs` already
   copies `isSession` cookies into the session blob, gated by `PrivacyLevel.canSave`
   ([SessionCookies.sys.mjs:170-195](upstream/browser/components/sessionstore/SessionCookies.sys.mjs#L170-L195)) —
   that is what the `cookies` array at the top of the blob is. If our store becomes
   authoritative for restoring our tabs, we inherit that job for suspended and saved tabs.
   That is the case where the DB really does hold credentials, and it is the strongest
   argument for the encryption option being on by default rather than optional. It also
   means `PrivacyLevel` (or our equivalent) has to exist before we save anything.
3. **The MCP organiser must never see any of it.** If session cookies land in the store,
   that table is outside the organiser's view, full stop — not filtered at the query layer,
   but not exposed as a tool at all.

**Open:**
- Do we save session cookies for saved/archived tabs, or deliberately not — accepting that a
  restored saved tab is logged out? "Logged out" may be the better default.
- Does an encrypted DB become mandatory the moment session cookies are in it?
- Is there any case for *referencing* cert exceptions from a tab row (this tab was accepted
  under an override), or is that just a footgun?
- Does the store record enough origin-attribute detail to restore a container tab exactly,
  including partitioned state?

## Form Data — three different things, three different answers

Raised 2026-08-24. "Form fillers" is really three subsystems that Firefox stores three ways,
and they do not get one answer. Verified in the ESR 153 tree:

| what | where today | verdict |
|---|---|---|
| per-tab form state (restore-what-I-typed) | inside the session blob, `entries[].formdata` | **ours, definitely** |
| form history (the input-field dropdown) | `formhistory.sqlite`, `moz_formhistory` | **merge candidate** |
| autofill profiles (addresses, cards) | `autofill-profiles.json`, cards via `OSKeyStore` | **not ours** |

**1. Per-tab form data — ours, and non-negotiable.** `formdata` already rides in the session
blob per history entry ([SessionStore.sys.mjs:6581](upstream/browser/components/sessionstore/SessionStore.sys.mjs#L6581)),
with a nested `children[]` for iframes. It is tab state by definition: the half-written
comment you want back after a crash. If our store owns tab restore, it owns this. It is also
the thing that most directly delivers "prevent lost data" — losing a session is annoying,
losing a half-written form is the part people actually swear about.

*How:* store it with the entry it belongs to, same shape, opaque to us. The design question
is **write cadence**, not schema. Firefox throttles at ~15s and accepts the loss. Form data is
exactly where that tradeoff hurts most, and a row-level store can afford to write a single
field's state on blur without rewriting the world. That is the concrete "row-level beats blob"
win, and it is the cheapest thing that would prove the whole thesis — if and when anyone
decides to test the thesis at all.

**2. Form history — the real merge candidate.** Already SQLite
([FormHistory.sys.mjs:97](upstream/toolkit/components/satchel/FormHistory.sys.mjs#L97), table
`moz_formhistory` with a `moz_history_to_...` join and its own index), Gecko-owned but
satellite — nothing in the network stack depends on it, unlike cookies. It is genuinely the
same kind of object as our store's contents: *things you typed, with timestamps, that you
might want back*. Same "navigational intent" test that cookies fail, it passes.

*How:* same question as `places.sqlite` — replace, wrap, or mirror. Same likely answer:
Gecko keeps its copy so the built-in dropdown keeps working, ours is authoritative for our
surfaces, one direction mirrors. Do not solve this twice; whatever we decide for places
decides this too.

**3. Autofill profiles — not ours.** Addresses and credit cards live in a `JSONFile`, not
SQLite, and card numbers are encrypted through `OSKeyStore`
([FormAutofillStorageBase.sys.mjs:143, 1819](upstream/toolkit/components/formautofill/FormAutofillStorageBase.sys.mjs#L143))
— OS-level keychain, not our key, deliberately. Passwords are the same story via NSS SDR into
`logins.json`. These are authority, not intent: they fail the same test cookies fail, harder.
Pulling a credit card number out of the OS keychain and into a DB we hand to a GUI and an MCP
server is the single worst idea available in this design space.

**The line, restated:** if losing it costs you *work*, it belongs in our store. If leaking it
costs you *money or identity*, it stays where the OS or NSS put it.

**If this is ever built, the order that makes sense (recorded, not scheduled):**
1. Per-tab `formdata` in our store from day one, with a write-on-blur cadence — the cheapest
   proof that row-level persistence beats the blob.
2. Form history second, folded into whatever places decision we make. Not before.
3. Autofill and passwords: never. Reference them if a tab needs to know a field was
   autofilled; never store the values.

**Open:**
- Write cadence for form data: on blur, debounced on input, or on navigation? What is the
  durability promise, and what does it cost in writes per minute on a heavy form?
- Does form data belong in the tab row, the entry row, or its own table keyed by entry?
- Privacy gate: Firefox has `PrivacyLevel` deciding whether form data on HTTPS pages is saved
  at all. We need an equivalent before we save anything, not after.
- Does the MCP organiser see form history? It is genuinely useful for "what was I working on"
  and genuinely creepy. Probably opt-in, separate from the rest.
- If form data is in the store and the store is encrypted, does that change the answer on
  whether encryption is optional?

## Which Engine — open, not decided

Flagged 2026-08-24: "SQL" in this seed means *relational and queryable*, not specifically
SQLite. Engine choice is deliberately open. What is known so far:

**The workload has two halves that want opposite things.**

- *Transactional half* — the tab state machine, write-on-blur form data, transitions,
  tombstones. Thousands of tiny writes, point lookups by id, one writer, many readers,
  latency-sensitive, must survive a crash mid-write.
- *Analytical half* — the LLM organiser and the GUI's "what was I working on Tuesday",
  duplicate detection, clustering, aggregate scans over a large history table. Few writes,
  wide reads, latency-tolerant.

**SQLite** fits the first half almost exactly: WAL gives concurrent readers with one writer,
tiny transactions are cheap, crash semantics are proven, the binary is ~1MB, and SQLCipher
covers the encryption requirement. It is also already embedded in Gecko, and `better-sqlite3`
is a routine Node dependency on the sidecar side. It is mediocre at the analytical half —
large aggregate scans are row-wise and unhelped by indexes.

**DuckDB** inverts that. Columnar, vectorised, genuinely excellent at the analytical half —
the exact queries the organiser wants. Against it, for this workload:
- Built for bulk/analytical writes, not thousands of small point updates per session. The
  transactional half is its weak case, and that half is the load-bearing one.
- Concurrency model is narrower than SQLite's — historically single-process write access,
  which matters if both Gecko and the sidecar ever need to touch the store.
- Materially larger to ship (tens of MB against ~1MB) inside a browser we distribute.
- Native Node binding is a heavier build dependency in the Nix dev shell than
  `better-sqlite3`. Not a blocker, but not free either.
- Encryption at rest exists in recent versions (1.4+), so it is not disqualified on the
  encryption requirement — **verify this against the version we would actually pin.**

**The likely shape, if the split holds:** SQLite as the system of record, DuckDB attached
read-only over it for the organiser's analytics (DuckDB can read SQLite files directly via
its sqlite scanner). That gets the transactional guarantees where they matter and the
columnar scans where they matter, with one copy of the data. It is also reversible — start
SQLite-only, add DuckDB when the organiser's queries actually get slow, and never add it if
they do not.

**Open:**
- Does the analytical half ever get big enough to justify a second engine? A single user's
  browsing history is large by human standards and trivial by database standards. Measure
  before adding.
- If encryption lands, does the DuckDB-over-SQLite read path still work on an encrypted file?
  Likely not without decryption in between — this may settle the question by itself.
- Other candidates not yet considered: libSQL (SQLite fork with encryption built in and a
  server mode), plain SQLite with FTS5 for the search half.
- Whatever is chosen, the schema should not depend on engine-specific features early —
  keep the option to swap while the store is still small.

## Caching — open, and measure before building

Raised 2026-08-24. Whether a cache layer (Redis-like, or in-process) is needed at all, and
where, is unresolved and should be settled by measurement rather than argument.

**The framing that matters:** Firefox's current design already *is* a cache. In-memory state
(the DOM attributes, the live tab objects) is authoritative; the disk blob is a periodic
snapshot behind it. This seed proposes inverting that — the DB becomes authoritative and
writes go through on transition. The cache question is therefore not "should we add a cache"
but **"how much of the in-memory model do we keep in front of the DB, and is it a cache or
just the live object graph?"**

The live tab model will be in memory regardless, because the strip renders from it. That is
not a cache decision, it is unavoidable. The open part is everything below it.

**Prior expectation, to be tested not assumed:** a separate cache daemon is very likely
unnecessary here. This is single-user, single-machine, with a working set measured in
thousands of rows — SQLite's page cache plus the OS page cache already sit in front of the
file, and a warm SQLite point lookup is microseconds. Redis would add a third supervised
process to a lifecycle that already juggles the browser and the Node sidecar, plus a
serialisation boundary, to cache data that fits in RAM anyway. If caching turns out to matter,
an in-process map is the first thing to try, not a daemon.

**Where it might genuinely matter — the things worth measuring:**
- **Snapshot thumbnails.** Not rows: file reads plus image decode, on the critical path of
  strip rendering. If anything needs a real cache (decoded, size-bounded, LRU), it is this.
- **Startup.** Reading N tab rows plus N thumbnails before the window is interactive. Whether
  this needs a precomputed "startup set" rather than a general cache.
- **Organiser aggregate queries.** Wide scans over history — but this is the case the engine
  question already covers, and a columnar read path may beat any cache.
- **Write amplification, the opposite problem.** Write-on-blur form data could produce enough
  small transactions to want *buffering* — a write-behind queue — which is a cache in the
  other direction and has real crash-semantics consequences.

### Firefox already has several caches — name which one before adding another

"Firefox cache" is ambiguous and the distinction decides the answer. What already exists,
underneath anything we would build:

- **bfcache** (back/forward cache) — keeps whole live documents parked in memory so back and
  forward are instant. `browser.sessionhistory.max_total_viewers`
  ([all.js:166](upstream/modules/libpref/init/all.js#L166)), implemented across
  `nsDocShell` / `CanonicalBrowsingContext`. This is the closest existing thing to "a
  suspended tab that comes back instantly" — worth understanding thoroughly before inventing
  a parallel mechanism, because a bfcached tab already achieves the feel we are chasing, for
  a small number of tabs, at full memory cost.
- **HTTP cache (cache2)** — `netwerk/cache2/`, disk and memory. Decides whether a restored
  tab refetches from network or from disk. Much of the perceived cost of "restoring a tab"
  is really this, not our store.
- **Image cache** — `image/imgLoader.cpp`, decoded surfaces.
- **In-memory session state** — the live tab objects and DOM attributes, which as noted are
  themselves the cache in front of today's blob.

So the real question is not "do we need a cache" but **which layer is actually responsible
for the feel we want**, and the honest possibilities are:

1. Firefox's existing caches already carry it, and our DB is only ever on the cold path
   (startup, restore-after-days). No new layer at all.
2. Firefox's caches plus one thin layer of ours — most likely decoded thumbnails, which no
   existing Firefox cache holds.
3. A genuine hierarchy: Firefox caches → our cache → DB. Only justified if measurement shows
   the middle actually earns its keep.

Prior expectation is (1) or (2). (3) should have to prove itself.

### What is in RAM vs on disk today — verified 2026-08-24

Checked because it changes the caching answer. Firefox's session state is RAM-first; the file
is a periodic snapshot of memory and is **never read during normal operation**.

**RAM only, never persisted:** `TAB_STATE_FOR_BROWSER` (the restore-state WeakMap); the DOM
attributes `pending` / `discarded` / `crashed` / `busy` / `muted`; `_lastSeenActive`;
`_lastUnloaded`; live browser objects and content processes; bfcached documents; the restore
queue buckets and `_restoreCount`.

**RAM and disk:** `TabStateCache._data` — a WeakMap keyed by `permanentKey`
([TabStateCache.sys.mjs:44](upstream/browser/components/sessionstore/TabStateCache.sys.mjs#L44)) —
where per-tab data pushed up from content processes accumulates (entries, scroll, formdata).
Being a WeakMap it dies with the browser element: no eviction policy, no bound, not
enumerable. Also `SessionStoreInternal._windows` (including `_closedTabs` and the tabData of
lazy tabs never restored), `_closedWindows`, window geometry, session cookies.

**Disk only:** effectively nothing of the current session — just the older backup generations
(`recovery.baklz4`, `previous.jsonlz4`, `upgrade.jsonlz4-*`), which exist so a corrupt write
has a fallback.

**Write path:** `SessionFile.write()` → `getWriter()` → a ChromeWorker off the main thread
([SessionFile.sys.mjs:440](upstream/browser/components/sessionstore/SessionFile.sys.mjs#L440)),
which does the LZ4 compression and the atomic write.

**Read path:** once, at startup, whole. `SessionFile.read()` then `JSON.parse` of the entire
blob into `_initialState`
([SessionStartup.sys.mjs:116-168](upstream/browser/components/sessionstore/SessionStartup.sys.mjs#L116-L168)).
Not lazy, not partial, not indexed — the whole session graph is materialised before the first
window is usable.

**Two consequences for the caching question above:**

1. **The blob is not a cache and never was** — it is write-only during a session. So "is
   Firefox's existing cache enough?" cannot be answered by looking at the session store at
   all. The caches that affect feel are bfcache, cache2, and the image cache. This rules out
   one framing of possibility (1) above: our DB would not be replacing a cache, it would be
   replacing a write-only snapshot.
2. **Startup costs everything at once**, and that is the one place a row store wins
   structurally rather than incidentally: reading the selected tab's row plus a few thumbnails
   and deferring the rest makes the access pattern *partial*, which `JSON.parse` of a whole
   file can never be. Note this is a different and stronger claim than "SQLite is faster than
   JSON" — worth keeping the distinction, because the weak version of the claim is the one
   that would not survive measurement.

### The acceptance criterion is real-world feel, not benchmark numbers

Explicit decision 2026-08-24: this gets settled by daily-driving, not by a synthetic
throughput chart. Benchmarks will happily show a cache "working" while the browser still
feels slow, because what users perceive is time-to-first-paint on the paths they hit
constantly, not aggregate throughput.

**How this would be settled, if it is ever built:**
1. Build the store with no new cache at all beyond the live tab model.
2. Daily-drive it on a real profile with a real tab load, for long enough that the cold paths
   (restore after days, a large archived set) actually get hit.
3. Instrument the paths, but treat the numbers as *explanation* for a felt problem, not as
   the trigger. The sequence is: notice it feels bad → look at the numbers → find which layer
   → fix that layer. Not: find a slow number → add a cache → declare victory.
4. Realistic corpus for the cold paths daily use will not reach quickly: thousands of tabs,
   a year of history, matching thumbnails.
5. Add a layer only where feel is bad and a number explains it. Re-drive to confirm it helped.

**Paths where feel is the whole product:** tab switch to first paint (hit hundreds of times a
day), cold start to interactive, clicking a suspended tab, opening the organiser on a large
set. Everything else is secondary.

**Open:**
- Does anything beyond the live tab model and a thumbnail cache justify a layer?
- Write-behind buffering for form data: how much can be buffered before the durability
  promise it exists to deliver is broken?
- If encryption is on, does that change the cost profile enough to move the answer?
- What are the actual thresholds — how many tabs and how much history before any of this
  stops being free?

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

### Unified store
- Replace, wrap, or sit alongside `places.sqlite`? Which direction does the mirror run?
- What breaks in Gecko if places stops being the whole truth — awesomebar frecency, history
  sidebar, Firefox Sync?
- Is bookmark import/export (the `bookmarkbackups/` JSON path) preserved for portability?
- Retention: history grows unbounded today by design. Does a unified store inherit that, or
  does everything get a TTL?

### LLM organiser
- Which tools does the MCP server expose — read-only query, or propose-and-apply?
- Does the LLM see URLs and titles only, page content, or snapshots?
- Local model, or does this data leave the machine? What is the default, and is it opt-in?
- Are the LLM's changes reversible — an undo log, or a proposals-then-review flow?
- What does it cost to run continuously versus on demand?

### Organiser GUI
- Browser chrome, Theia view, or a page? (Chrome is correct long-term; a Theia view is
  cheapest first.)
- Are snapshot thumbnails the primary visual unit, or a detail?
- How are LLM suggestions surfaced without feeling like the browser is rearranging itself?

### Encryption
- Where does the store live — Gecko process or Node sidecar? Encryption forces this answer.
- If sidecar: SQLCipher via native binding, and how does that interact with the Nix dev
  shell's node-gyp toolchain?
- Primary-password integration, or an independent key? Where is the key at rest?
- Are PNG snapshots on disk encrypted too, or is an encrypted DB with plaintext thumbnails
  of every page a false promise?
- Can the MCP server read the store while it is locked? Presumably not — what does it do then?

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
tabs," then expanded the same day into the unified-store framing (tabs + history + sessions +
bookmarks as one thing) plus the MCP organiser, organiser GUI, and optional encryption. Verified against the pinned ESR 153 tree rather than recall; one earlier claim
(saved groups in `places.sqlite`) was wrong and is corrected above.

A throwaway mozLz4 decoder was written during capture and is worth rebuilding if needed —
pure Python, ~40 lines, no `lz4` dependency: read the 8-byte magic, 4-byte LE size, then
decode the raw LZ4 block byte-wise (overlapping matches are legal and must not be
memcpy'd in bulk).
