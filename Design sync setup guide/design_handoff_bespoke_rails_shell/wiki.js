// Wiki applet — the moat. Article view + provenance inspector + Unresolved block
// + review queue + the flagship edit → dry-run preview → apply → undo flow.
// React module mounted into a dockview panel; reads the shared zustand store
// for the selected entity (set by the side rail) and the review count.

import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import { store } from './store.js';

const h = React.createElement;
const T = { bg: '#0A0A0B', panel: '#131418', panel2: '#0F1013', line: '#1E1F22', line2: '#26272B', text: '#E6E4DE', muted: '#A5A29A', faint: '#6E6C66', accent: '#86A38C', amber: '#D8C69C', amberBg: '#1E1C17', warm: '#B8A06E', red: '#B05A4E' };
const MONO = "'IBM Plex Mono', monospace", SERIF = "'IBM Plex Serif', serif", SANS = "'IBM Plex Sans', sans-serif";

// ---- content (a small hand-authored corpus slice) ----
const ARTICLES = {
  ficino: {
    title: 'Marsilio Ficino', kind: 'PERSON · PHILOSOPHER', trust: 'curated',
    lede: 'Italian scholar, priest and the foremost Platonist of the Florentine Renaissance; first translator of the complete works of Plato into Latin.',
    sections: [
      { g: 'Identity', claims: [
        { id: 'ficino-born', attr: 'Born', val: '19 October 1433, Figline Valdarno', trust: 'curated', prov: { won: 'trust', docs: [['Corsi · Vita Ficini', 'p. 3', '1506'], ['Baptismal register, Figline', 'fol. 12', 'transcr. 1901']], why: 'Human-curated over two agreeing sources.' }, copies: 3 },
        { id: 'ficino-died', attr: 'Died', val: '1 October 1499, Careggi', trust: 'library', prov: { won: 'recency', docs: [['Kristeller · Supplementum', 'v.1 p.cxx', '1937']], why: 'Single authoritative source; no conflict.' }, copies: 2 },
      ]},
      { g: 'Work', claims: [
        { id: 'ficino-plato', attr: 'Completed Plato translation', val: '1469 (revised through 1484)', trust: 'library', prov: { won: 'provenance', docs: [['Hankins · Plato in the Ital. Ren.', 'p. 300', '1990'], ['Ficino · Epistolae I', 'letter 47', '1495']], why: 'Two sources agree on the 1469 draft; 1484 is the printed edition.' }, copies: 4 },
        { id: 'ficino-academy', attr: 'Led', val: 'The Careggi circle (from 1462)', trust: 'library', prov: { won: 'recency', docs: [['Field · Origins of the Platonic Academy', 'ch.2', '1988']], why: 'Field reframes it as an informal circle, not a chartered academy.' }, copies: 2 },
      ]},
    ],
    unresolved: null,
  },
  alberti: {
    title: 'Leon Battista Alberti', kind: 'PERSON · POLYMATH', trust: 'library',
    lede: 'Italian humanist, architect and art theorist; author of De pictura and De re aedificatoria.',
    sections: [
      { g: 'Identity', claims: [
        { id: 'alberti-died', attr: 'Died', val: '25 April 1472, Rome', trust: 'library', prov: { won: 'recency', docs: [['Grafton · Alberti', 'p. 4', '2000']], why: 'Single source; uncontested.' }, copies: 2 },
      ]},
    ],
    unresolved: {
      attr: 'Birthplace', note: 'Sources genuinely disagree. Surfaced, never silently resolved.',
      candidates: [
        { val: 'Genoa', trust: 'curated', docs: [['Grafton · Alberti', 'p. 3', '2000'], ['Genoese notarial record', 'fol. 8', 'transcr. 1889']], conf: 0.58 },
        { val: 'Venice', trust: 'library', docs: [['Mancini · Vita di L.B. Alberti', 'p. 12', '1882']], conf: 0.42 },
      ],
    },
  },
};
const FALLBACK = (id) => ({ title: (id || 'Entity').replace(/(^|\s)\S/g, c => c.toUpperCase()), kind: 'ENTITY', trust: 'library', lede: 'No composed article yet for this entity in the current corpus.', sections: [], unresolved: null });

const REVIEW = [
  { id: 'rq-alberti', entity: 'Leon Battista Alberti', attr: 'Birthplace', a: ['Genoa', 'Grafton · Alberti (2000)'], b: ['Venice', 'Mancini · Vita (1882)'] },
  { id: 'rq-plato', entity: 'Marsilio Ficino', attr: 'Plato translation begun', a: ['1463', 'Hankins (1990)'], b: ['1462', 'Careggi deed'] },
  { id: 'rq-careggi', entity: 'Villa di Careggi', attr: 'Type', a: ['Formal academy', 'Vasari (1550)'], b: ['Informal salon', 'Field (1988)'] },
];

// ---- trust flag chip (consistent visual identity across applets) ----
function TrustChip({ t }) {
  const curated = t === 'curated';
  return h('span', { title: curated ? 'Human-verified' : 'Machine-ingested', style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: curated ? T.accent : T.faint, border: '1px solid ' + (curated ? T.accent : T.line2), padding: '2px 7px' } }, [
    h('span', { key: 'd', style: { width: 6, height: 6, background: curated ? T.accent : 'transparent', border: curated ? 'none' : '1.5px solid ' + T.faint, transform: 'rotate(45deg)' } }),
    curated ? 'CURATED' : 'LIBRARY']);
}

function DocRow({ d, dim }) {
  return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '8px 0', borderBottom: '1px solid ' + T.line } }, [
    h('div', { key: 'l', style: { minWidth: 0 } }, [
      h('div', { key: 't', style: { fontSize: 12.5, color: dim ? T.muted : T.text, overflow: 'hidden', textOverflow: 'ellipsis' } }, d[0]),
      h('div', { key: 'p', style: { fontFamily: MONO, fontSize: 9.5, color: T.faint, marginTop: 2 } }, d[1] + ' · ' + d[2])]),
    h('span', { key: 'a', style: { fontFamily: MONO, fontSize: 9, color: T.accent, alignSelf: 'center', cursor: 'pointer' } }, 'open →')]);
}

// ---- provenance inspector (right panel) ----
function Provenance({ claim, onClose }) {
  if (!claim) return h('div', { style: { padding: '18px 16px', color: T.faint, fontSize: 12.5, lineHeight: 1.6 } }, [
    h('div', { key: 'h', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: T.muted, marginBottom: 10 } }, 'PROVENANCE'),
    'Select any claim to see its receipts — which document, which passage, and why its value won.']);
  const p = claim.prov;
  const whyLabel = { trust: 'TRUST > provenance > recency', provenance: 'PROVENANCE > recency', recency: 'RECENCY (most recent source)' }[p.won] || p.won.toUpperCase();
  return h('div', { style: { padding: '18px 16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' } }, [
    h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', marginBottom: 12 } }, [
      h('span', { key: 't', style: { flex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: T.muted } }, 'PROVENANCE'),
      h('span', { key: 'x', onClick: onClose, style: { cursor: 'pointer', color: T.faint, fontFamily: MONO } }, '×')]),
    h('div', { key: 'attr', style: { fontFamily: MONO, fontSize: 10, color: T.faint } }, claim.attr.toUpperCase()),
    h('div', { key: 'val', style: { fontFamily: SERIF, fontSize: 17, color: T.text, lineHeight: 1.25, margin: '3px 0 12px' } }, claim.val),
    h('div', { key: 'chip', style: { marginBottom: 14 } }, h(TrustChip, { t: claim.trust })),
    h('div', { key: 'wl', style: { fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: T.faint } }, 'WHY THIS VALUE WON'),
    h('div', { key: 'w', style: { fontSize: 12.5, color: T.muted, lineHeight: 1.55, margin: '4px 0 6px' } }, p.why),
    h('div', { key: 'r', style: { display: 'inline-block', fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: T.accent, border: '1px solid ' + T.line2, padding: '3px 8px', marginBottom: 16 } }, 'RULE · ' + whyLabel),
    h('div', { key: 'sl', style: { fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: T.faint, marginBottom: 2 } }, 'SOURCES (' + p.docs.length + ')'),
    ...p.docs.map((d, i) => h(DocRow, { key: i, d })),
    h('div', { key: 'copies', style: { marginTop: 16, fontFamily: MONO, fontSize: 10, color: T.faint, lineHeight: 1.5 } }, 'Propagates to ' + claim.copies + ' derived cop' + (claim.copies === 1 ? 'y' : 'ies') + ' across the corpus.'),
  ]);
}

// ---- claim row (with inline edit) ----
function Claim({ c, selected, onSelect, onEdit }) {
  return h('div', { onClick: () => onSelect(c), style: { display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 16, alignItems: 'baseline', padding: '11px 14px', cursor: 'pointer', background: selected ? T.panel : 'transparent', borderLeft: '2px solid ' + (selected ? T.accent : 'transparent') } }, [
    h('div', { key: 'a', style: { fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', color: T.faint } }, c.attr),
    h('div', { key: 'v', style: { fontSize: 14, color: T.text, lineHeight: 1.4 } }, c.val),
    h('div', { key: 'r', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
      h('span', { key: 'tr', style: { width: 7, height: 7, background: c.trust === 'curated' ? T.accent : 'transparent', border: c.trust === 'curated' ? 'none' : '1.5px solid ' + T.faint, transform: 'rotate(45deg)' }, title: c.trust === 'curated' ? 'Curated' : 'Library' }),
      h('span', { key: 'e', onClick: (e) => { e.stopPropagation(); onEdit(c); }, style: { fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: T.faint, cursor: 'pointer', border: '1px solid ' + T.line2, padding: '2px 7px' }, title: 'Edit → dry-run preview → apply' }, 'EDIT')])]);
}

// ---- Unresolved block (HARD REQUIREMENT — first-class, never a fake answer) ----
function Unresolved({ u }) {
  return h('div', { style: { margin: '18px 0 8px', border: '1px solid ' + T.warm, background: T.amberBg } }, [
    h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + T.warm } }, [
      h('span', { key: 'i', style: { fontFamily: MONO, fontSize: 11, color: T.warm } }, '⚠'),
      h('span', { key: 't', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.amber } }, 'UNRESOLVED · ' + u.attr.toUpperCase()),
      h('span', { key: 's', style: { flex: 1, textAlign: 'right', fontFamily: MONO, fontSize: 9, color: T.warm } }, 'SOURCES DISAGREE')]),
    h('div', { key: 'n', style: { padding: '8px 14px 4px', fontSize: 12, color: T.amber, fontStyle: 'italic' } }, u.note),
    h('div', { key: 'c', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: T.warm, margin: '8px 14px 14px' } }, u.candidates.map((cand, i) =>
      h('div', { key: i, style: { background: T.bg, padding: '12px 14px' } }, [
        h('div', { key: 'v', style: { display: 'flex', alignItems: 'baseline', gap: 10 } }, [
          h('span', { key: 'val', style: { fontFamily: SERIF, fontSize: 20, color: T.text } }, cand.val),
          h('span', { key: 'cf', style: { fontFamily: MONO, fontSize: 10, color: T.faint } }, 'conf ' + cand.conf.toFixed(2))]),
        h('div', { key: 'ch', style: { margin: '6px 0 8px' } }, h(TrustChip, { t: cand.trust })),
        ...cand.docs.map((d, j) => h('div', { key: j, style: { fontFamily: MONO, fontSize: 10, color: T.muted, padding: '2px 0' } }, '· ' + d[0] + ' · ' + d[1])),
      ]))),
  ]);
}

// ---- edit → dry-run → apply → undo modal ----
function EditFlow({ claim, onDone }) {
  const [stage, setStage] = React.useState('edit'); // edit | preview | applied
  const [val, setVal] = React.useState(claim.val);
  const changed = val.trim() !== claim.val;
  const wrap = (kids) => h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 } },
    h('div', { style: { width: 520, maxWidth: '90%', background: T.panel, border: '1px solid ' + T.line2, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' } }, kids));
  const head = (label) => h('div', { key: 'h', style: { padding: '12px 16px', borderBottom: '1px solid ' + T.line, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted } }, label);
  const btn = (label, onc, primary, danger) => h('button', { key: label, onClick: onc, disabled: primary && !changed, style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: primary ? (changed ? '#0A0A0B' : T.faint) : (danger ? T.amber : T.muted), background: primary ? (changed ? T.accent : T.line2) : 'transparent', border: primary ? 'none' : '1px solid ' + T.line2, padding: '7px 14px', cursor: primary && !changed ? 'default' : 'pointer' } }, label);

  if (stage === 'edit') return wrap([head('EDIT CLAIM · ' + claim.attr.toUpperCase()),
    h('div', { key: 'b', style: { padding: 16 } }, [
      h('textarea', { key: 'ta', value: val, onChange: (e) => setVal(e.target.value), autoFocus: true, rows: 2, style: { width: '100%', boxSizing: 'border-box', background: T.panel2, border: '1px solid ' + T.line2, color: T.text, fontFamily: SERIF, fontSize: 15, padding: '10px 12px', resize: 'vertical' } }),
      h('div', { key: 'note', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 8 } }, 'Your edit carries human authority — it will be applied as curated.')]),
    h('div', { key: 'f', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid ' + T.line } }, [btn('CANCEL', () => onDone(null)), btn('PREVIEW CHANGES →', () => setStage('preview'), true)])]);

  if (stage === 'preview') return wrap([head('DRY-RUN PREVIEW'),
    h('div', { key: 'b', style: { padding: 16 } }, [
      h('div', { key: 'w', style: { fontSize: 13, color: T.text, marginBottom: 12 } }, ['This will update ', h('b', { key: 'n', style: { color: T.accent } }, claim.copies + ' derived cop' + (claim.copies === 1 ? 'y' : 'ies')), ' across the corpus.']),
      h('div', { key: 'diff', style: { border: '1px solid ' + T.line2, fontFamily: SERIF, fontSize: 14 } }, [
        h('div', { key: 'o', style: { padding: '8px 12px', background: '#1E1618', color: '#C99', borderBottom: '1px solid ' + T.line } }, [h('span', { key: 'm', style: { fontFamily: MONO, fontSize: 11, color: T.red, marginRight: 10 } }, '−'), claim.val]),
        h('div', { key: 'n', style: { padding: '8px 12px', background: '#16201A', color: '#9C9' } }, [h('span', { key: 'm', style: { fontFamily: MONO, fontSize: 11, color: T.accent, marginRight: 10 } }, '+'), val])])]),
    h('div', { key: 'f', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid ' + T.line } }, [btn('← BACK', () => setStage('edit')), btn('APPLY', () => { setStage('applied'); }, true)])]);

  return wrap([head('APPLIED ✓'),
    h('div', { key: 'b', style: { padding: 16 } }, [
      h('div', { key: 't', style: { fontSize: 13, color: T.text } }, 'Claim updated and propagated to ' + claim.copies + ' cop' + (claim.copies === 1 ? 'y' : 'ies') + '.'),
      h('div', { key: 'v', style: { fontFamily: SERIF, fontSize: 15, color: T.accent, marginTop: 8 } }, val)]),
    h('div', { key: 'f', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid ' + T.line } }, [
      h('span', { key: 'u', onClick: () => onDone(null), style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: T.amber, cursor: 'pointer' } }, '↩ UNDO / REVERT'),
      btn('DONE', () => onDone(val), true)])]);
}

function Tab({ label, on, onClick, badge }) {
  return h('div', { onClick, style: { display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 38, cursor: 'pointer', color: on ? T.text : T.faint, borderBottom: '2px solid ' + (on ? T.accent : 'transparent'), fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em' } }, [
    label, badge != null ? h('span', { key: 'b', style: { fontFamily: MONO, fontSize: 9, color: T.amber, background: T.amberBg, padding: '1px 6px' } }, badge) : null]);
}

function Wiki({ ctx }) {
  const [view, setView] = React.useState('article');
  const [entity, setEntity] = React.useState(store.getState().selection.Wiki || 'ficino');
  const [selClaim, setSelClaim] = React.useState(null);
  const [edit, setEdit] = React.useState(null);
  const [edited, setEdited] = React.useState({}); // id -> new value
  const [review, setReview] = React.useState(REVIEW);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => store.subscribe((st) => {
    if (st.selection.Wiki && st.selection.Wiki !== entity) { setEntity(st.selection.Wiki); setView('article'); setSelClaim(null); }
  }), [entity]);

  const art = ARTICLES[entity] || FALLBACK(entity);
  const valOf = (c) => edited[c.id] || c.val;

  const resolve = (id, how) => {
    setReview(r => r.filter(x => x.id !== id));
    const n = Math.max(0, store.getState().reviewCount - 1);
    store.getState().setReviewCount(n);
    setToast(how === 'both' ? 'Kept both — genuine dispute recorded.' : how === 'dismiss' ? 'Dismissed.' : 'Winner chosen — article recomposed.');
    setTimeout(() => setToast(null), 2600);
  };

  const header = h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', borderBottom: '1px solid ' + T.line, background: T.panel2, flexShrink: 0 } }, [
    h(Tab, { key: 'a', label: 'ARTICLE', on: view === 'article', onClick: () => setView('article') }),
    h(Tab, { key: 'r', label: 'REVIEW QUEUE', on: view === 'review', onClick: () => setView('review'), badge: review.length || null }),
    h(Tab, { key: 'h', label: 'HISTORY', on: view === 'history', onClick: () => setView('history') }),
  ]);

  let body;
  if (view === 'article') {
    body = h('div', { key: 'split', style: { flex: 1, display: 'grid', gridTemplateColumns: selClaim ? '1fr 300px' : '1fr', minHeight: 0 } }, [
      h('div', { key: 'art', style: { overflowY: 'auto', padding: '28px 32px' } }, [
        h('div', { key: 'k', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: T.faint } }, art.kind),
        h('div', { key: 'ti', style: { display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 4px' } }, [
          h('h1', { key: 't', style: { fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1.1 } }, art.title),
          h(TrustChip, { key: 'c', t: art.trust })]),
        h('div', { key: 'l', style: { fontSize: 14, color: T.muted, lineHeight: 1.6, maxWidth: 620, marginBottom: 10 } }, art.lede),
        art.unresolved ? h(Unresolved, { key: 'u', u: art.unresolved }) : null,
        ...art.sections.map((sec, i) => h('div', { key: i, style: { marginTop: 18 } }, [
          h('div', { key: 'g', style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } }, [
            h('span', { key: 'l', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted } }, sec.g.toUpperCase()),
            h('span', { key: 'r', style: { flex: 1, height: 1, background: 'linear-gradient(to right,' + T.line2 + ',' + T.line + ')' } })]),
          ...sec.claims.map(c => h(Claim, { key: c.id, c: { ...c, val: valOf(c) }, selected: selClaim && selClaim.id === c.id, onSelect: setSelClaim, onEdit: setEdit })),
        ])),
        art.sections.length === 0 && !art.unresolved ? h('div', { key: 'empty', style: { marginTop: 20, fontFamily: MONO, fontSize: 11, color: T.faint } }, 'No claims composed yet.') : null,
      ]),
      selClaim ? h('div', { key: 'prov', style: { borderLeft: '1px solid ' + T.line, background: T.panel2, minHeight: 0 } }, h(Provenance, { claim: { ...selClaim, val: valOf(selClaim) }, onClose: () => setSelClaim(null) })) : null,
    ]);
  } else if (view === 'review') {
    body = h('div', { key: 'rev', style: { flex: 1, overflowY: 'auto', padding: '20px 28px' } }, review.length === 0
      ? h('div', { style: { maxWidth: 460, margin: '40px auto 0', textAlign: 'center', color: T.muted, lineHeight: 1.6 } }, [
          h('div', { key: 'e', style: { fontFamily: SERIF, fontSize: 22, color: T.text } }, 'No open contradictions'),
          h('div', { key: 's', style: { fontSize: 13, marginTop: 8 } }, 'Your corpus currently agrees with itself.'),
          h('div', { key: 'c', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 10, lineHeight: 1.6 } }, 'Surfaced ≠ guaranteed-none. ', h('a', { key: 'l', href: '#', style: { color: T.accent } }, 'Trust & limitations'))])
      : review.map(rq => h('div', { key: rq.id, style: { border: '1px solid ' + T.line2, marginBottom: 12, background: T.panel } }, [
          h('div', { key: 'h', style: { display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + T.line } }, [
            h('span', { key: 'e', style: { fontFamily: SERIF, fontSize: 15, color: T.text } }, rq.entity),
            h('span', { key: 'a', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: T.faint } }, '· ' + rq.attr.toUpperCase())]),
          h('div', { key: 'c', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: T.line } }, [rq.a, rq.b].map((s, i) => h('div', { key: i, style: { background: T.bg, padding: '11px 14px' } }, [
            h('div', { key: 'v', style: { fontFamily: SERIF, fontSize: 18, color: T.text } }, s[0]),
            h('div', { key: 'src', style: { fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 3 } }, s[1])]))),
          h('div', { key: 'act', style: { display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid ' + T.line } }, [
            h('button', { key: 'wa', onClick: () => resolve(rq.id, 'winner'), style: btnS(true) }, 'CHOOSE ' + rq.a[0].toUpperCase()),
            h('button', { key: 'wb', onClick: () => resolve(rq.id, 'winner'), style: btnS(true) }, 'CHOOSE ' + rq.b[0].toUpperCase()),
            h('div', { key: 'sp', style: { flex: 1 } }),
            h('button', { key: 'both', onClick: () => resolve(rq.id, 'both'), style: btnS(false) }, 'KEEP BOTH'),
            h('button', { key: 'dis', onClick: () => resolve(rq.id, 'dismiss'), style: btnS(false) }, 'DISMISS')])])));
  } else {
    body = h('div', { key: 'hist', style: { flex: 1, overflowY: 'auto', padding: '24px 32px' } }, [
      h('div', { key: 'h', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: T.muted, marginBottom: 14 } }, 'VERSION HISTORY · ' + art.title.toUpperCase()),
      ...[['just now', 'You', 'Curated edit — Plato translation date'], ['2h ago', 'Ingest', '+3 claims from Prato ledger'], ['yesterday', 'You', 'Merged "Marsilio F." into this entity'], ['3d ago', 'Ingest', 'Entity created from 4 sources']].map((r, i) => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: '90px 60px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid ' + T.line } }, [
        h('span', { key: 't', style: { fontFamily: MONO, fontSize: 10, color: T.faint } }, r[0]),
        h('span', { key: 'w', style: { fontFamily: MONO, fontSize: 10, color: r[1] === 'You' ? T.accent : T.muted } }, r[1]),
        h('span', { key: 'd', style: { fontSize: 13, color: T.text } }, r[2]),
        h('span', { key: 'r', style: { fontFamily: MONO, fontSize: 9, color: T.faint, cursor: 'pointer', border: '1px solid ' + T.line2, padding: '2px 8px' } }, 'REVERT')])),
    ]);
  }

  return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, color: T.text, fontFamily: SANS, position: 'relative' } }, [
    header, body,
    edit ? h(EditFlow, { key: 'ef', claim: { ...edit, val: valOf(edit) }, onDone: (v) => { if (v != null) { setEdited(e => ({ ...e, [edit.id]: v })); setToast('Claim applied · undo available'); setTimeout(() => setToast(null), 2600); } setEdit(null); } }) : null,
    toast ? h('div', { key: 't', style: { position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: T.panel, border: '1px solid ' + T.line2, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', padding: '10px 16px', fontSize: 12.5, color: T.text, zIndex: 60 } }, toast) : null,
  ]);
}

function btnS(primary) {
  return { fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: primary ? '#0A0A0B' : T.muted, background: primary ? T.accent : 'transparent', border: primary ? 'none' : '1px solid ' + T.line2, padding: '6px 11px', cursor: 'pointer' };
}

export function mountWiki(el, ctx = {}) {
  el.style.cssText = 'height:100%;';
  const root = createRoot(el);
  root.render(h(Wiki, { ctx }));
  return () => root.unmount();
}
