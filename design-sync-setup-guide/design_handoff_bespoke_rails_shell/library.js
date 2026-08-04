// Library applet — the Obsidian-familiar documents-and-databases home (spec §7.1).
// Three workspace views: corpus Dashboard · Ingest · Document detail.
// React module mounted into a dockview panel; reads the shared zustand store for
// the active corpus (status-bar switcher re-scopes everything) and selection.Library
// (set by the side rail). Trust flag (library vs curated) is a first-class, consistent
// concept. Every mutating action follows the write-safety pattern: Preview → Confirm → Undo.

import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import { store } from './store.js';

const h = React.createElement;
const T = { bg: '#0A0A0B', panel: '#131418', panel2: '#0F1013', line: '#1E1F22', line2: '#26272B', text: '#E6E4DE', muted: '#A5A29A', faint: '#6E6C66', accent: '#86A38C', amber: '#D8C69C', amberBg: '#1E1C17', warm: '#B8A06E', red: '#B05A4E' };
const MONO = "'IBM Plex Mono', monospace", SERIF = "'IBM Plex Serif', serif", SANS = "'IBM Plex Sans', sans-serif";

// ---- per-corpus dashboard figures ----
const CORPUS_STATS = {
  ficino:  { docs: 342, entities: 1284, claims: 5107, contradictions: 5, curated: 41 },
  medici:  { docs: 319, entities: 980,  claims: 3990, contradictions: 2, curated: 18 },
  sandbox: { docs: 12,  entities: 28,   claims: 94,   contradictions: 0, curated: 0 },
};

// ---- document corpus slice (ids match side-rail.js RAIL.Library) ----
const DOCS = {
  'doc-ficino-vita': { title: 'Vita Ficini', author: 'Giovanni Corsi', kind: 'PDF · biography', trust: 'curated', status: 'ok', added: '2026-06-14', size: '2.1 MB', pages: 88, chunks: 214, entities: 63, claims: 190, note: 'Human-verified. Primary biographical source for the Ficino article.' },
  'doc-letters':      { title: 'Epistolae · Book I', author: 'Marsilio Ficino', kind: 'PDF · letters', trust: 'library', status: 'ok', added: '2026-06-14', size: '4.8 MB', pages: 240, chunks: 612, entities: 129, claims: 401, note: 'Machine-ingested. 401 claims extracted; 3 flagged for review.' },
  'doc-prato-ledger': { title: 'Prato account book 1462', author: 'Datini archive', kind: 'scan · ledger', trust: 'library', status: 'proc', added: '2026-07-07', size: '18.3 MB', pages: 512, chunks: 0, entities: 0, claims: 0, note: 'Ingestion in progress — OCR + chunking + extraction running.' },
  'doc-vasari':       { title: 'Lives of the Artists', author: 'Giorgio Vasari', kind: 'PDF · secondary', trust: 'library', status: 'ok', added: '2026-06-15', size: '9.2 MB', pages: 604, chunks: 1508, entities: 402, claims: 1120, note: 'Machine-ingested secondary source. Contributes to several contested claims.' },
  'doc-manetti':      { title: 'Vita di Ficino', author: 'Giannozzo Manetti', kind: 'PDF · biography', trust: 'library', status: 'fail', added: '2026-07-06', size: '3.4 MB', pages: 0, chunks: 0, entities: 0, claims: 0, note: 'Ingestion failed — encrypted PDF could not be parsed. Retry after removing protection.' },
};

const RECENT = [
  ['just now', 'Ingest', 'Prato account book 1462 — OCR 41%', 'proc'],
  ['2h ago', 'You', 'Promoted "Vita Ficini · Corsi" to curated', 'ok'],
  ['5h ago', 'Ingest', '+401 claims from Epistolae · Book I', 'ok'],
  ['yesterday', 'Ingest', 'Manetti · Vita failed — encrypted PDF', 'fail'],
];

// ---- shared bits ----
function TrustChip({ t, big }) {
  const curated = t === 'curated';
  return h('span', { title: curated ? 'Human-verified' : 'Machine-ingested', style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: big ? 10 : 9, letterSpacing: '0.1em', color: curated ? T.accent : T.faint, border: '1px solid ' + (curated ? T.accent : T.line2), padding: big ? '3px 9px' : '2px 7px' } }, [
    h('span', { key: 'd', style: { width: 6, height: 6, background: curated ? T.accent : 'transparent', border: curated ? 'none' : '1.5px solid ' + T.faint, transform: 'rotate(45deg)' } }),
    curated ? 'CURATED' : 'LIBRARY']);
}
function StatusChip({ st }) {
  const map = { ok: [T.accent, 'PROCESSED'], proc: [T.amber, 'PROCESSING'], fail: [T.red, 'FAILED'] };
  const [c, label] = map[st] || [T.faint, 'UNKNOWN'];
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: c } }, [
    h('span', { key: 'd', style: { width: 6, height: 6, borderRadius: '50%', background: st === 'fail' ? 'transparent' : c, border: st === 'fail' ? '1.5px solid ' + c : 'none', animation: st === 'proc' ? 'cv-pulse 1.6s ease-in-out infinite' : 'none' } }), label]);
}
function Wire({ f }) {
  const map = { WIRED: [T.accent, T.line2], 'NOT WIRED': [T.warm, T.warm], FUTURE: [T.faint, T.line2] };
  const [c] = map[f] || [T.faint];
  return h('span', { title: f === 'WIRED' ? 'Backend exists — live' : f === 'NOT WIRED' ? 'Backend planned — UI designed ahead' : 'Later milestone', style: { fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.12em', color: c, border: '1px solid ' + (map[f] ? map[f][1] : T.line2), padding: '1px 6px' } }, f);
}
function btnS(primary, danger) {
  return { fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: primary ? '#0A0A0B' : (danger ? T.red : T.muted), background: primary ? T.accent : 'transparent', border: primary ? 'none' : '1px solid ' + (danger ? T.red : T.line2), padding: '7px 13px', cursor: 'pointer' };
}
function Tab({ label, on, onClick, badge }) {
  return h('div', { onClick, style: { display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 38, cursor: 'pointer', color: on ? T.text : T.faint, borderBottom: '2px solid ' + (on ? T.accent : 'transparent'), fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em' } }, [
    label, badge != null ? h('span', { key: 'b', style: { fontFamily: MONO, fontSize: 9, color: T.amber, background: T.amberBg, padding: '1px 6px' } }, badge) : null]);
}
function Stat({ n, label, accent }) {
  return h('div', { style: { padding: '16px 18px', background: T.panel, border: '1px solid ' + T.line2 } }, [
    h('div', { key: 'n', style: { fontFamily: SERIF, fontSize: 30, lineHeight: 1, color: accent || T.text } }, n),
    h('div', { key: 'l', style: { fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: T.faint, marginTop: 7 } }, label)]);
}
const fmt = (n) => n.toLocaleString('en-US');

// ---- Dashboard view ----
function Dashboard({ corpus, stats, onReview, onIngest, onDoc }) {
  return h('div', { style: { flex: 1, overflowY: 'auto', padding: '28px 32px' } }, [
    h('div', { key: 'k', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: T.faint } }, 'CORPUS DASHBOARD'),
    h('div', { key: 'ti', style: { display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 4px' } }, [
      h('h1', { key: 't', style: { fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1.1 } }, corpus.name),
      h('span', { key: 'tier', style: { fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: T.faint, border: '1px solid ' + T.line2, padding: '2px 8px' } }, corpus.tier.toUpperCase() + ' TIER'),
      h(Wire, { key: 'w', f: 'WIRED' })]),
    h('div', { key: 'l', style: { fontSize: 13.5, color: T.muted, lineHeight: 1.6, maxWidth: 620, marginBottom: 20 } }, 'Everything ingested into this corpus, with counts, pipeline activity, and what needs your attention.'),

    // counts
    h('div', { key: 'stats', style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: T.line, border: '1px solid ' + T.line2, marginBottom: 20 } }, [
      h(Stat, { key: 'd', n: fmt(stats.docs), label: 'DOCUMENTS' }),
      h(Stat, { key: 'e', n: fmt(stats.entities), label: 'ENTITIES' }),
      h(Stat, { key: 'c', n: fmt(stats.claims), label: 'CLAIMS' }),
      h(Stat, { key: 'cu', n: fmt(stats.curated), label: 'CURATED', accent: T.accent })]),

    // review CTA
    stats.contradictions > 0
      ? h('div', { key: 'cta', onClick: onReview, style: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: T.amberBg, boxShadow: 'inset 3px 0 0 ' + T.amber, cursor: 'pointer', marginBottom: 22 } }, [
          h('span', { key: 'n', style: { fontFamily: SERIF, fontSize: 30, color: T.amber, lineHeight: 1 } }, stats.contradictions),
          h('div', { key: 'x', style: { flex: 1 } }, [
            h('div', { key: 't', style: { fontSize: 14, color: T.text } }, 'contradiction' + (stats.contradictions === 1 ? '' : 's') + ' need review'),
            h('div', { key: 's', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: T.amber, marginTop: 2 } }, 'SOURCES DISAGREE — OPEN THE REVIEW QUEUE →')])])
      : h('div', { key: 'cta', style: { padding: '14px 18px', border: '1px solid ' + T.line2, marginBottom: 22, fontSize: 13, color: T.muted } }, [
          h('span', { key: 'i', style: { color: T.accent, marginRight: 8 } }, '✓'), 'No open contradictions — this corpus currently agrees with itself.']),

    // recent activity + pipeline
    h('div', { key: 'grid', style: { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 } }, [
      h('div', { key: 'act' }, [
        h('div', { key: 'h', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted, marginBottom: 6 } }, 'RECENT ACTIVITY'),
        ...RECENT.map((r, i) => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: '80px 54px 1fr', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid ' + T.line } }, [
          h('span', { key: 't', style: { fontFamily: MONO, fontSize: 10, color: T.faint } }, r[0]),
          h('span', { key: 'w', style: { fontFamily: MONO, fontSize: 10, color: r[1] === 'You' ? T.accent : T.muted } }, r[1]),
          h('span', { key: 'd', style: { fontSize: 12.5, color: r[3] === 'fail' ? T.red : T.text } }, r[2])]))]),
      h('div', { key: 'pipe' }, [
        h('div', { key: 'h', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted, marginBottom: 6 } }, 'PIPELINE'),
        h('div', { key: 'box', style: { border: '1px solid ' + T.line2, padding: '14px' } }, [
          h('div', { key: 's', style: { marginBottom: 10 } }, h(StatusChip, { st: 'proc' })),
          h('div', { key: 'd', style: { fontSize: 12.5, color: T.text } }, 'Prato account book 1462'),
          h('div', { key: 'bar', style: { height: 4, background: T.line, marginTop: 10, overflow: 'hidden' } }, h('div', { style: { width: '41%', height: '100%', background: T.amber } })),
          h('div', { key: 'p', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 6 } }, 'OCR · 41% · ~3 min left'),
          h('button', { key: 'go', onClick: onIngest, style: { ...btnS(false), marginTop: 12, width: '100%' } }, 'OPEN INGEST →')])])]),
  ]);
}

// ---- Ingest view ----
function Ingest({ onOpenDoc, toast }) {
  const [over, setOver] = React.useState(false);
  const queue = [
    { id: 'doc-prato-ledger', label: 'Prato account book 1462', st: 'proc', pct: 41, note: 'OCR + chunking' },
    { id: 'doc-manetti', label: 'Manetti · Vita', st: 'fail', pct: 0, note: 'encrypted PDF — parse failed' },
    { id: 'q1', label: 'Bruni · Historiae (queued)', st: 'queue', pct: 0, note: 'waiting for pipeline' },
  ];
  const dz = (label, sub) => h('div', { key: label, style: { flex: 1, border: '1px solid ' + T.line2, padding: '14px', cursor: 'pointer', background: T.panel } }, [
    h('div', { key: 'l', style: { fontSize: 13, color: T.text } }, label),
    h('div', { key: 's', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 4 } }, sub)]);
  return h('div', { style: { flex: 1, overflowY: 'auto', padding: '28px 32px' } }, [
    h('div', { key: 'k', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: T.faint } }, 'INGEST' ),
    h('div', { key: 'ti', style: { display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 16px' } }, [
      h('h1', { key: 't', style: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: T.text, margin: 0 } }, 'Add documents'),
      h(Wire, { key: 'w', f: 'WIRED' })]),
    // dropzone
    h('div', { key: 'drop', onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false), onDrop: (e) => { e.preventDefault(); setOver(false); },
      style: { border: '1.5px dashed ' + (over ? T.accent : T.line2), background: over ? 'rgba(134,163,140,0.06)' : T.panel2, padding: '34px', textAlign: 'center', marginBottom: 14 } }, [
      h('div', { key: 'i', style: { fontFamily: MONO, fontSize: 22, color: over ? T.accent : T.faint } }, '⬇'),
      h('div', { key: 't', style: { fontSize: 14, color: T.text, marginTop: 8 } }, 'Drop PDFs, text, or a folder here'),
      h('div', { key: 's', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 4 } }, 'drag-drop anywhere in the window · re-read like new docs — conflicts resurface for review')]),
    // source buttons
    h('div', { key: 'src', style: { display: 'flex', gap: 12, marginBottom: 24 } }, [dz('⤒  Upload files', 'choose from disk'), dz('¶  Paste text', 'a note or transcript'), dz('▤  Scan folder', 'watch a directory')]),

    // progress list
    h('div', { key: 'ph', style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 } }, [
      h('span', { key: 'l', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted } }, 'PIPELINE QUEUE'),
      h('span', { key: 'sp', style: { flex: 1 } }),
      h('button', { key: 'c', style: btnS(false), title: 'Cancel the running pipeline' }, 'CANCEL PIPELINE')]),
    ...queue.map(q => h('div', { key: q.id, style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center', padding: '11px 14px', border: '1px solid ' + T.line, marginBottom: 8, background: T.panel } }, [
      h('div', { key: 'l', style: { minWidth: 0 } }, [
        h('div', { key: 't', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
          h('span', { key: 'n', onClick: () => q.id.startsWith('doc') && onOpenDoc(q.id), style: { fontSize: 13, color: T.text, cursor: q.id.startsWith('doc') ? 'pointer' : 'default' } }, q.label),
          h(StatusChip, { key: 's', st: q.st === 'queue' ? 'proc' : q.st })]),
        q.st === 'proc' ? h('div', { key: 'bar', style: { height: 3, background: T.line, marginTop: 8, maxWidth: 320 } }, h('div', { style: { width: q.pct + '%', height: '100%', background: T.amber } })) : null,
        h('div', { key: 'nt', style: { fontFamily: MONO, fontSize: 10, color: q.st === 'fail' ? T.red : T.faint, marginTop: 6 } }, q.note)]),
      h('div', { key: 'act', style: { display: 'flex', gap: 8 } }, [
        q.st === 'fail' ? h('button', { key: 'r', style: btnS(true) }, 'RETRY') : null,
        h('button', { key: 'd', style: btnS(false, true), title: 'Delete (guarded)' }, 'DELETE')])])),
  ]);
}

// ---- Document detail view ----
function DocDetail({ doc, onPromote, onDelete }) {
  if (!doc) return h('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint, fontSize: 13 } }, 'Select a document in the rail to see its detail.');
  const meta = [['Author', doc.author], ['Type', doc.kind], ['Added', doc.added], ['Size', doc.size], ['Pages', doc.pages || '—'], ['Chunks', doc.chunks || '—'], ['Entities', doc.entities || '—'], ['Claims', doc.claims || '—']];
  return h('div', { style: { flex: 1, overflowY: 'auto', padding: '28px 32px' } }, [
    h('div', { key: 'k', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: T.faint } }, 'DOCUMENT'),
    h('div', { key: 'ti', style: { display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 4px', flexWrap: 'wrap' } }, [
      h('h1', { key: 't', style: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1.15 } }, doc.title),
      h(TrustChip, { key: 'c', t: doc.trust, big: true }),
      h(StatusChip, { key: 's', st: doc.status })]),
    h('div', { key: 'note', style: { fontSize: 13.5, color: doc.status === 'fail' ? T.red : T.muted, lineHeight: 1.6, maxWidth: 640, margin: '8px 0 20px' } }, doc.note),

    // metadata grid
    h('div', { key: 'meta', style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: T.line, border: '1px solid ' + T.line2, marginBottom: 22 } }, meta.map((m, i) =>
      h('div', { key: i, style: { padding: '11px 14px', background: T.panel } }, [
        h('div', { key: 'l', style: { fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: T.faint } }, m[0].toUpperCase()),
        h('div', { key: 'v', style: { fontSize: 13, color: T.text, marginTop: 4 } }, String(m[1]))]))),

    // trust / promote
    h('div', { key: 'trust', style: { border: '1px solid ' + T.line2, padding: '16px 18px', marginBottom: 18 } }, [
      h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 } }, [
        h('span', { key: 'l', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted } }, 'TRUST FLAG'),
        h(Wire, { key: 'w', f: 'NOT WIRED' })]),
      h('div', { key: 'b', style: { display: 'flex', alignItems: 'center', gap: 16 } }, [
        h('div', { key: 'x', style: { flex: 1, fontSize: 12.5, color: T.muted, lineHeight: 1.55 } },
          doc.trust === 'curated'
            ? 'Human-verified. Claims from this document carry human authority and win over machine-ingested values.'
            : 'Machine-ingested (default). Promote to curated once you have verified this source by hand.'),
        doc.trust === 'curated'
          ? h(TrustChip, { key: 'c', t: 'curated', big: true })
          : h('button', { key: 'p', onClick: onPromote, disabled: doc.status !== 'ok', style: { ...btnS(true), opacity: doc.status === 'ok' ? 1 : 0.4, cursor: doc.status === 'ok' ? 'pointer' : 'default' } }, '↑ PROMOTE TO CURATED')])]),

    // chunk preview
    doc.chunks ? h('div', { key: 'ch', style: { marginBottom: 20 } }, [
      h('div', { key: 'h', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted, marginBottom: 6 } }, 'CHUNKS · ' + doc.chunks + ' total'),
      ...[0, 1, 2].map(i => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: '54px 1fr', gap: 12, padding: '9px 0', borderBottom: '1px solid ' + T.line } }, [
        h('span', { key: 'n', style: { fontFamily: MONO, fontSize: 10, color: T.faint } }, '#' + String(i + 1).padStart(3, '0')),
        h('span', { key: 't', style: { fontSize: 12.5, color: T.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ['…nato in Figline Valdarno il xix d\u2019ottobre 1433, figliuolo di Diotifeci…', '…tradusse tutte l\u2019opere di Platone in lingua latina, compiute intorno al…', '…nel giardino di Careggi convennero gli uomini dotti che egli chiamava…'][i])]))]) : null,

    // danger zone
    h('div', { key: 'del', style: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid ' + T.line, marginTop: 4 } }, [
      h('div', { key: 'x', style: { flex: 1, fontFamily: MONO, fontSize: 10.5, color: T.faint, lineHeight: 1.5 } }, 'Delete removes this document and its extracted claims. Guarded — you\u2019ll confirm the consequences.'),
      h('button', { key: 'd', onClick: onDelete, style: btnS(false, true) }, 'DELETE DOCUMENT')]),
  ]);
}

// ---- write-safety modal (promote / delete: Preview → Confirm → Undo) ----
function ConfirmFlow({ kind, doc, onDone }) {
  const [applied, setApplied] = React.useState(false);
  const wrap = (kids) => h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 } },
    h('div', { style: { width: 500, maxWidth: '90%', background: T.panel, border: '1px solid ' + T.line2, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' } }, kids));
  const head = (label) => h('div', { key: 'h', style: { padding: '12px 16px', borderBottom: '1px solid ' + T.line, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted } }, label);
  const promote = kind === 'promote';

  if (applied) return wrap([head((promote ? 'PROMOTED' : 'DELETED') + ' ✓'),
    h('div', { key: 'b', style: { padding: 16, fontSize: 13, color: T.text, lineHeight: 1.55 } },
      promote ? ['"', doc.title, '" is now ', h('b', { key: 'c', style: { color: T.accent } }, 'curated'), '. Its claims carry human authority.']
              : ['"', doc.title, '" and its ', doc.claims || 0, ' claims were removed from the corpus.']),
    h('div', { key: 'f', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid ' + T.line } }, [
      h('span', { key: 'u', onClick: () => onDone(false), style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: T.amber, cursor: 'pointer' } }, '↩ UNDO / REVERT'),
      h('button', { key: 'd', onClick: () => onDone(true), style: btnS(true) }, 'DONE')])]);

  return wrap([head(promote ? 'PROMOTE TO CURATED' : 'DELETE DOCUMENT'),
    h('div', { key: 'b', style: { padding: 16 } }, [
      h('div', { key: 'w', style: { fontSize: 13, color: T.text, lineHeight: 1.6 } },
        promote ? ['Mark ', h('b', { key: 'n' }, '"' + doc.title + '"'), ' as human-verified. Its ', h('b', { key: 'c', style: { color: T.accent } }, (doc.claims || 0) + ' claims'), ' will win over machine-ingested values in every article.']
                : ['This permanently removes ', h('b', { key: 'n' }, '"' + doc.title + '"'), ' and its ', h('b', { key: 'c', style: { color: T.red } }, (doc.claims || 0) + ' extracted claims'), '. Articles that cited it will recompose. This can be undone right after.']),
      promote ? h('div', { key: 'note', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 10 } }, 'Your action carries human authority.') : null]),
    h('div', { key: 'f', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid ' + T.line } }, [
      h('button', { key: 'c', onClick: () => onDone(false), style: btnS(false) }, 'CANCEL'),
      h('button', { key: 'ok', onClick: () => setApplied(true), style: btnS(true, false) }, promote ? 'PROMOTE' : 'DELETE')])]);
}

function Library({ ctx }) {
  const [view, setView] = React.useState('dashboard');
  const [sel, setSel] = React.useState(store.getState().selection.Library || null);
  const [corpusId, setCorpusId] = React.useState(store.getState().activeCorpus);
  const [flow, setFlow] = React.useState(null); // {kind, doc}
  const [promoted, setPromoted] = React.useState({});
  const [toast, setToast] = React.useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  React.useEffect(() => store.subscribe((st) => {
    if (st.activeCorpus !== corpusId) { setCorpusId(st.activeCorpus); setView('dashboard'); }
    if (st.selection.Library && st.selection.Library !== sel) { setSel(st.selection.Library); setView('document'); }
  }), [sel, corpusId]);

  const corpus = store.getState().corpora.find(c => c.id === corpusId) || { name: 'Corpus', tier: 'Standard' };
  const stats = CORPUS_STATS[corpusId] || CORPUS_STATS.sandbox;
  const baseDoc = sel ? DOCS[sel] : null;
  const doc = baseDoc ? { ...baseDoc, trust: promoted[sel] ? 'curated' : baseDoc.trust } : null;

  const header = h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', borderBottom: '1px solid ' + T.line, background: T.panel2, flexShrink: 0 } }, [
    h(Tab, { key: 'd', label: 'DASHBOARD', on: view === 'dashboard', onClick: () => setView('dashboard') }),
    h(Tab, { key: 'i', label: 'INGEST', on: view === 'ingest', onClick: () => setView('ingest'), badge: 1 }),
    h(Tab, { key: 'doc', label: 'DOCUMENT', on: view === 'document', onClick: () => setView('document') }),
    h('div', { key: 'sp', style: { flex: 1 } }),
    h('div', { key: 'okf', title: 'Portable interchange — export/import corpus', style: { display: 'flex', alignItems: 'center', gap: 10, paddingRight: 14 } }, [
      h('span', { key: 'e', onClick: () => flash('Exported corpus to folder (OKF).'), style: { fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em', color: T.muted, cursor: 'pointer', border: '1px solid ' + T.line2, padding: '4px 9px' } }, 'OKF EXPORT'),
      h('span', { key: 'i', onClick: () => flash('Imports are re-read like new documents — conflicts will resurface for review.'), style: { fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em', color: T.muted, cursor: 'pointer', border: '1px solid ' + T.line2, padding: '4px 9px' } }, 'IMPORT')]),
  ]);

  let body;
  if (view === 'dashboard') body = h(Dashboard, { corpus, stats, onReview: () => ctx.open && ctx.open('Wiki'), onIngest: () => setView('ingest'), onDoc: (id) => { store.getState().select('Library', id); } });
  else if (view === 'ingest') body = h(Ingest, { onOpenDoc: (id) => store.getState().select('Library', id) });
  else body = h(DocDetail, { doc, onPromote: () => setFlow({ kind: 'promote', doc }), onDelete: () => setFlow({ kind: 'delete', doc }) });

  return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, color: T.text, fontFamily: SANS, position: 'relative' } }, [
    header, body,
    flow ? h(ConfirmFlow, { key: 'flow', kind: flow.kind, doc: flow.doc, onDone: (committed) => {
      if (committed && flow.kind === 'promote') { setPromoted(p => ({ ...p, [sel]: true })); flash('Promoted to curated · undo available'); }
      else if (committed && flow.kind === 'delete') flash('Document deleted · undo available');
      setFlow(null);
    } }) : null,
    toast ? h('div', { key: 't', style: { position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: T.panel, border: '1px solid ' + T.line2, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', padding: '10px 16px', fontSize: 12.5, color: T.text, zIndex: 60, maxWidth: 460, textAlign: 'center' } }, toast) : null,
  ]);
}

export function mountLibrary(el, ctx = {}) {
  el.style.cssText = 'height:100%;';
  const root = createRoot(el);
  root.render(h(Library, { ctx }));
  return () => root.unmount();
}
