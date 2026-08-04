// Divi Home dashboard — card grid with dnd-kit sortable drag & drop.
// Mounted into a dockview panel by Divi Shell (Dockview).dc.html via mountHome(el, ctx).
// Per CLAUDE.md: cards use @dnd-kit/core + @dnd-kit/sortable (not hand-rolled drag).

import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter,
} from 'https://esm.sh/@dnd-kit/core@6.1.0?deps=react@18.3.1,react-dom@18.3.1';
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from 'https://esm.sh/@dnd-kit/sortable@8.0.0?deps=react@18.3.1,react-dom@18.3.1,@dnd-kit/core@6.1.0';
import { CSS } from 'https://esm.sh/@dnd-kit/utilities@3.2.2?deps=react@18.3.1';

const h = React.createElement;
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'IBM Plex Serif', serif";
const SANS = "'IBM Plex Sans', sans-serif";
const STORE_KEY = 'sourcerer-home-cards-v2';

// ---- card registry (ported from Working Sourcerer UX UI Prototype) ----
export const cardDefs = {
  corpus:        { span: 2, kind: 'CORPUS · PRIMARY',      mark: 'live', title: 'Renaissance Papers',              foot: '342 docs · 5 conflicts', bg: '#1E1F22', to: 'Library' },
  dissertation:  { span: 2, kind: 'DISSERTATION · CH.3',   title: "Neoplatonism in Ficino's circle",               foot: '8,412 words',            to: 'Writing' },
  ficino:        { span: 1, kind: 'ENTITY',                mark: 'curated', title: 'Marsilio Ficino',              foot: '34 claims',              to: 'Wiki' },
  thread:        { span: 1, kind: 'THREAD · SAVED',        title: 'Neoplatonism antecedents',                      foot: '6 sources',              to: 'Chat' },
  graphview:     { span: 2, kind: 'GRAPH · VIEW',          title: 'Careggi network',                               foot: '43 nodes · 71 edges',    to: 'Graph' },
  contradiction: { span: 2, kind: 'NEW CONTRADICTION',     bar: true, bg: '#1E1C17', title: 'Alberti — Genoa vs Venice', foot: '2 sources · resolve →', to: 'Wiki' },
  prato:         { span: 2, kind: 'DEEP RESEARCH FINDING', dashed: true, title: 'Medici account book · Prato Archive digitized', foot: '1462 folios · scan →', to: 'Library' },
  claimsnow:     { span: 1, kind: 'CLAIMS · LIVE',         mark: 'live', variant: 'metric', big: '342',            foot: '▲ 18 today', footColor: '#86A38C', title: 'Claims', to: 'Wiki' },
  activity:      { span: 2, kind: 'CLAIM ACTIVITY · 30D',  mark: 'live', variant: 'spark', title: 'Ficino corpus', foot: 'Jun 6 → today · ▲ 42%',  to: 'Graph' },
  fichrono:      { span: 2, kind: 'TIMELINE · FICINO',     variant: 'timeline', title: 'Ficino timeline', events: [['1433', 'Born in Figline', '#C9C6BE'], ['1462', 'Receives Careggi villa', '#86A38C'], ['1484', 'Plato translation printed', '#B8A06E']], foot: '3 of 11 events', to: 'Wiki' },
  excerpt47:     { span: 2, kind: 'EXCERPT · LETTER 47',   mark: 'doc', variant: 'excerpt', title: '"Between the soul and the body there is a spirit, most subtle…"', foot: 'Ficino → Cavalcanti · p. 112', to: 'Library' },
  ingest:        { span: 2, kind: 'INGESTION · MEDICI LETTERS', variant: 'progress', pct: 68, title: '217 / 319 docs', foot: '~11 min remaining', to: 'Library' },
  indexing:      { span: 1, kind: 'INDEXING…',             variant: 'skeleton', title: 'Indexing', foot: '',       to: 'Library' },
  ficnet:        { span: 2, kind: 'CONNECTIONS · FICINO',  variant: 'graph', title: 'Ficino network', foot: '4 direct · 19 second-degree', to: 'Graph' },
  circle:        { span: 2, kind: 'CLUSTER · CAREGGI CIRCLE', variant: 'cluster', bg: '#131417', title: 'Careggi circle', tiles: ['Ficino', 'Pico', 'Poliziano'], foot: 'view all 9 →', to: 'Wiki' },
  vasmanetti:    { span: 2, kind: 'COMPARE · SOURCES',     variant: 'compare', title: 'Vasari vs Manetti', left: ['Vasari', '61', '4 flagged'], right: ['Manetti', '38', '1 flagged'], foot: '7 overlap · 2 disagree', footColor: '#D8C69C', to: 'Library' },
  patrchain:     { span: 2, kind: 'THREAD · CLAIM CHAIN',  variant: 'chain', title: 'Patronage chain', steps: [['Cosimo funds the academy', 'done'], ['Ficino appointed head, 1462', 'done'], ['Patronage precedes doctrine', 'inferred']], foot: 'inferred · conf 0.72', to: 'Chat' },
  platonote:     { span: 2, kind: 'CLAIM',                 variant: 'annotation', mark: 'curated', title: 'Plato translation began 1463', note: 'Hankins dates the commission earlier — check the 1462 deed.', foot: '', to: 'Wiki' },
  pulse:         { span: 2, kind: 'ACTIVITY',              variant: 'feed', mark: 'live', title: 'Activity', items: [['curated', '+3 claims · Prato ledger', '2m'], ['inferred', 'Contradiction · Alberti', '18m'], ['doc', 'Corpus H re-indexed', '1h']], foot: '', to: 'Library' },
  claimstack:    { span: 1, kind: 'CLAIMS · STACK',        variant: 'stack', title: 'Careggi claims', claims: ['Ficino completed the Plato corpus by 1469', 'Cosimo gifted the Careggi villa in 1462', 'The academy met on Plato\u2019s birthday, Nov 7'] },
  actioncard:    { span: 1, kind: 'CONTRADICTION · ACTION', variant: 'action', title: 'Alberti birthplace: Genoa vs Venice' },
  entwiki:       { span: 2, kind: 'ENTITY · WIKI',         mark: 'curated', variant: 'entitywiki', title: 'Marsilio Ficino', desc: 'Italian Neoplatonist, priest and translator (1433\u20131499).', bullets: ['Translated Plato in full', 'Led the Careggi circle'], quote: 'The soul is the mirror of the world.', to: 'Wiki' },
  entlive:       { span: 1, kind: 'ENTITY · LIVE',         mark: 'live', variant: 'entitylive', title: 'Marsilio Ficino', claimsN: 34, openN: 2, to: 'Wiki' },
  audit:         { span: 2, kind: 'CORPUS · AUDIT',        variant: 'audit', title: 'Audit', rows: [['Careggi salon', '3', '\u2713', '#86A38C'], ['Plato dates', '2', '?', '#D8C69C']], tasks: [{ id: 'villa', label: 'Verify villa deed' }, { id: 'vasari', label: 'Cross-check Vasari' }] },
  livingq:       { span: 2, kind: 'LIVING QUESTION · WEEK 2', title: '"Was Ficino\u2019s Careggi a formal institution or an informal salon?"', foot: '14 findings · lean: informal salon (0.68) · OPEN THREAD →', italic: true, to: 'Wiki' },
  'a-mach':      { span: 1, kind: 'CTR',   title: 'Machiavelli birthplace',    foot: 'Jun 24', to: 'Wiki' },
  'a-ch2':       { span: 1, kind: 'PAPER', title: 'Ch. 2 draft complete',      foot: 'Jun 22', to: 'Writing' },
  'a-pdfs':      { span: 1, kind: 'ING',   title: '12 PDFs from Prato',        foot: 'Jun 20', to: 'Library' },
  'a-bruni':     { span: 1, kind: 'RES',   title: 'Bruni translations survey', foot: 'Jun 18', to: 'Library' },
  'a-petrarch':  { span: 1, kind: 'CTR',   title: 'Petrarch death year',       foot: 'Jun 16', to: 'Wiki' },
  'a-stoic':     { span: 1, kind: 'CHAT',  title: 'Q: Stoic revival threads',  foot: 'Jun 14', to: 'Chat' },
  'a-bocc':      { span: 1, kind: 'MRG',   title: 'Boccaccio aliases',         foot: 'Jun 12', to: 'Wiki' },
  'a-bodleian':  { span: 1, kind: 'NEWS',  title: 'Bodleian catalog update',   foot: 'Jun 10', to: 'Library' },
};

const DEFAULT_SECTIONS = {
  pins: ['corpus', 'dissertation', 'ficino', 'thread', 'graphview', 'claimsnow', 'activity', 'fichrono', 'ficnet', 'circle', 'entwiki', 'entlive'],
  fresh: ['contradiction', 'prato', 'excerpt47', 'ingest', 'vasmanetti', 'patrchain', 'platonote', 'pulse', 'claimstack', 'actioncard', 'audit', 'indexing'],
  living: ['livingq'],
  archive: ['a-mach', 'a-ch2', 'a-pdfs', 'a-bruni', 'a-petrarch', 'a-stoic', 'a-bocc', 'a-bodleian'],
};
const SECTION_ORDER = ['pins', 'fresh', 'living', 'archive'];
const SECTION_LABELS = { pins: '◆ PINNED', fresh: 'FRESH', living: 'LIVING' };

// ---- card body renderers (visuals ported from the Card Visuals sheet) ----
function markEl(m) {
  if (m === 'curated') return h('span', { key: 'mk', style: { width: 7, height: 7, background: '#86A38C', transform: 'rotate(45deg)', flexShrink: 0 } });
  if (m === 'doc') return h('span', { key: 'mk', style: { width: 7, height: 7, border: '1.5px solid #6E6C66', borderRadius: '50%', flexShrink: 0 } });
  if (m === 'live') return h('span', { key: 'mk', style: { width: 5, height: 5, borderRadius: '50%', background: '#86A38C', animation: 'cv-pulse 1.6s ease-in-out infinite', flexShrink: 0 } });
  if (m === 'inferred') return h('span', { key: 'mk', style: { width: 7, height: 7, border: '1.5px solid #B8A06E', transform: 'rotate(45deg)', flexShrink: 0 } });
  return null;
}
const shim = (w, hh) => ({ width: w, height: hh, background: 'linear-gradient(90deg,#1E1F22 25%,#2A2B2F 50%,#1E1F22 75%)', backgroundSize: '200px 100%', animation: 'cv-shimmer 1.4s linear infinite' });

function CardBody({ t }) {
  const [stackIndex, setStackIndex] = React.useState(0);
  const [actionState, setActionState] = React.useState('open');
  const [checks, setChecks] = React.useState({ villa: true, vasari: false });

  const inkMain = t.dim ? '#4A4B4F' : '#E6E4DE';
  const inkSub = t.dim ? '#4A4B4F' : (t.bar ? '#D8C69C' : '#A5A29A');
  const kindRow = h('div', { key: 'k', style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } }, [
    h('span', { key: 'l', style: { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: inkSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.kind),
    markEl(t.mark)]);
  const footEl = (c) => h('div', { key: 'f', style: { fontFamily: MONO, fontSize: 10, color: c || inkSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.foot);
  const titleEl = (extra) => h('div', { key: 't', style: { fontFamily: SERIF, fontSize: 15, lineHeight: 1.15, marginTop: 2, flex: 1, fontStyle: t.italic ? 'italic' : 'normal', color: inkMain, ...(extra || {}) } }, t.title);

  let kids, barColor = t.bar ? '#B8A06E' : null, bgOverride = null, onClickExtra = null;

  if (t.variant === 'metric') kids = [kindRow,
    h('div', { key: 'b', style: { fontFamily: SERIF, fontSize: 26, color: inkMain, flex: 1, marginTop: 2 } }, t.big), footEl(t.footColor)];
  else if (t.variant === 'spark') kids = [kindRow, titleEl({ flex: 'none' }),
    h('svg', { key: 'sv', viewBox: '0 0 180 28', preserveAspectRatio: 'none', style: { width: '100%', height: 24, display: 'block', flex: 1 } },
      h('polyline', { points: '0,24 22,20 44,22 66,15 88,18 110,10 132,13 154,5 180,2', fill: 'none', stroke: '#86A38C', strokeWidth: 1.5 })), footEl()];
  else if (t.variant === 'progress') kids = [kindRow,
    h('div', { key: 'b', style: { display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, marginTop: 2 } }, [
      h('span', { key: 'n', style: { fontFamily: SERIF, fontSize: 24, color: inkMain } }, t.pct + '%'),
      h('span', { key: 'm', style: { fontFamily: MONO, fontSize: 10, color: inkSub } }, t.title)]),
    h('div', { key: 'bar', style: { height: 3, background: '#26272B', margin: '4px 0 6px' } },
      h('div', { style: { height: '100%', width: t.pct + '%', background: '#86A38C' } })), footEl()];
  else if (t.variant === 'excerpt') kids = [kindRow,
    h('div', { key: 'q', style: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.4, color: '#C9C6BE', flex: 1, marginTop: 4 } }, t.title), footEl()];
  else if (t.variant === 'timeline') kids = [kindRow,
    h('div', { key: 'tl', style: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6, flex: 1 } }, (t.events || []).map((ev, i) => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: '34px 9px 1fr', gap: 7, alignItems: 'center' } }, [
      h('span', { key: 'y', style: { fontFamily: MONO, fontSize: 9, color: '#6E6C66', textAlign: 'right' } }, ev[0]),
      h('span', { key: 'd', style: { width: 6, height: 6, borderRadius: '50%', background: ev[2] || '#C9C6BE', justifySelf: 'center' } }),
      h('span', { key: 't', style: { fontSize: 11, color: '#C9C6BE' } }, ev[1])]))), footEl()];
  else if (t.variant === 'skeleton') kids = [
    h('div', { key: 's1', style: shim(56, 7) }), h('div', { key: 's2', style: shim(110, 13) }),
    h('div', { key: 's3', style: shim('100%', 8) }), h('div', { key: 's4', style: shim(72, 8) })];
  else if (t.variant === 'compare') {
    const col = (side, key) => h('div', { key, style: { display: 'flex', flexDirection: 'column', gap: 1 } }, [
      h('span', { key: 'n', style: { fontFamily: SERIF, fontSize: 13, color: inkMain } }, side[0]),
      h('span', { key: 'v', style: { fontFamily: SERIF, fontSize: 19, color: inkMain } }, side[1]),
      h('span', { key: 'm', style: { fontFamily: MONO, fontSize: 9, color: inkSub } }, side[2])]);
    kids = [kindRow,
      h('div', { key: 'b', style: { display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 10, flex: 1, marginTop: 4 } }, [
        col(t.left, 'l'), h('div', { key: 'd', style: { background: '#26272B' } }), col(t.right, 'r')]),
      footEl(t.footColor)];
  }
  else if (t.variant === 'graph') kids = [kindRow,
    h('svg', { key: 'sv', viewBox: '0 0 180 58', style: { width: '100%', flex: 1, display: 'block', marginTop: 4, minHeight: 44 } }, [
      h('line', { key: 'l1', x1: 90, y1: 29, x2: 32, y2: 12, stroke: '#3A3B40', strokeWidth: 1 }),
      h('line', { key: 'l2', x1: 90, y1: 29, x2: 150, y2: 10, stroke: '#3A3B40', strokeWidth: 1 }),
      h('line', { key: 'l3', x1: 90, y1: 29, x2: 42, y2: 48, stroke: '#3A3B40', strokeWidth: 1 }),
      h('line', { key: 'l4', x1: 90, y1: 29, x2: 146, y2: 46, stroke: '#3A3B40', strokeWidth: 1 }),
      h('circle', { key: 'c0', cx: 90, cy: 29, r: 6, fill: '#86A38C' }),
      h('circle', { key: 'c1', cx: 32, cy: 12, r: 3.5, fill: '#C9C6BE' }),
      h('circle', { key: 'c2', cx: 150, cy: 10, r: 3.5, fill: '#C9C6BE' }),
      h('circle', { key: 'c3', cx: 42, cy: 48, r: 3.5, fill: '#B8A06E' }),
      h('circle', { key: 'c4', cx: 146, cy: 46, r: 3.5, fill: '#6E6C66' })]), footEl()];
  else if (t.variant === 'chain') kids = [kindRow,
    h('div', { key: 'ch', style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, flex: 1 } }, (t.steps || []).map((st, i) => h('div', { key: i, style: { display: 'flex', alignItems: 'baseline', gap: 8 } }, [
      h('span', { key: 'd', style: { width: 6, height: 6, flexShrink: 0, transform: 'rotate(45deg)', background: st[1] === 'inferred' ? 'transparent' : '#86A38C', border: st[1] === 'inferred' ? '1.5px solid #B8A06E' : 'none' } }),
      h('span', { key: 't', style: { fontSize: 11.5, lineHeight: 1.3, color: st[1] === 'inferred' ? '#D8C69C' : '#C9C6BE' } }, st[0])]))), footEl()];
  else if (t.variant === 'feed') kids = [kindRow,
    h('div', { key: 'fd', style: { display: 'flex', flexDirection: 'column', marginTop: 2, flex: 1 } }, (t.items || []).map((it, i) => h('div', { key: i, style: { display: 'grid', gridTemplateColumns: '10px 1fr 26px', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < (t.items.length - 1) ? '1px solid #222327' : 'none' } }, [
      h('span', { key: 'm', style: { display: 'flex', alignItems: 'center' } }, markEl(it[0])),
      h('span', { key: 't', style: { fontSize: 11, color: '#C9C6BE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it[1]),
      h('span', { key: 'w', style: { fontFamily: MONO, fontSize: 9, color: '#6E6C66', textAlign: 'right' } }, it[2])])))];
  else if (t.variant === 'annotation') kids = [kindRow, titleEl({ flex: 'none' }),
    h('div', { key: 'n', style: { margin: '4px 0 0 10px', background: '#211F1A', border: '1px solid #333026', padding: '7px 10px', flex: 1 } }, [
      h('div', { key: 'l', style: { fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.14em', color: '#B8A06E' } }, 'NOTE · YOU'),
      h('div', { key: 't', style: { fontSize: 11, color: '#C9C6BE', lineHeight: 1.4, marginTop: 3 } }, t.note)])];
  else if (t.variant === 'cluster') kids = [kindRow,
    h('div', { key: 'g', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, margin: '6px 0', flex: 1 } }, (t.tiles || []).map((nm, i) => h('div', { key: i, style: { background: '#1A1B1E', border: '1px solid #26272B', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } }, [
      h('span', { key: 'k', style: { fontFamily: MONO, fontSize: 7, letterSpacing: '0.14em', color: '#6E6C66' } }, 'ENTITY'),
      h('span', { key: 'n', style: { fontFamily: SERIF, fontSize: 12, color: inkMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, nm)]))), footEl()];
  else if (t.variant === 'stack') {
    const claims = t.claims || [];
    const idx = stackIndex % (claims.length || 1);
    onClickExtra = () => setStackIndex(i => (i + 1) % claims.length);
    kids = [
      h('div', { key: 'k', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
        h('span', { key: 'l', style: { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: inkSub } }, t.kind),
        h('span', { key: 'p', style: { fontFamily: MONO, fontSize: 10, color: '#6E6C66' } }, (idx + 1) + ' / ' + claims.length)]),
      h('div', { key: 'c', style: { fontFamily: SERIF, fontSize: 14, lineHeight: 1.3, color: inkMain, flex: 1, marginTop: 2, minHeight: 38 } }, claims[idx]),
      h('span', { key: 'f', style: { fontFamily: MONO, fontSize: 10, color: '#6E6C66' } }, 'click to cycle →')];
  }
  else if (t.variant === 'action') {
    const open = actionState === 'open';
    barColor = open ? '#B8A06E' : (actionState === 'resolved' ? '#86A38C' : '#3A3B40');
    bgOverride = open ? '#1E1C17' : '#16171A';
    const lbl = open ? 'CONTRADICTION · ACTION' : (actionState === 'resolved' ? 'RESOLVED ✓' : 'DISMISSED');
    const lblC = open ? '#D8C69C' : (actionState === 'resolved' ? '#86A38C' : '#6E6C66');
    const txt = open ? t.title : (actionState === 'resolved' ? 'Genoa confirmed via baptismal record' : 'Alberti birthplace — set aside');
    const btn = (label, onc, primary) => h('button', { key: label, onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); onc(); }, style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: primary ? '#1A1B1E' : '#A5A29A', background: primary ? '#B8A06E' : 'transparent', border: primary ? 'none' : '1px solid #3A3B40', padding: '5px 12px', cursor: 'pointer' } }, label);
    kids = [
      h('span', { key: 'k', style: { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: lblC } }, lbl),
      h('div', { key: 't', style: { fontFamily: SERIF, fontSize: 14, lineHeight: 1.2, color: inkMain, flex: 1 } }, txt),
      open ? h('div', { key: 'b', style: { display: 'flex', gap: 8 } }, [btn('RESOLVE', () => setActionState('resolved'), true), btn('DISMISS', () => setActionState('dismissed'), false)])
           : h('span', { key: 'u', onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); setActionState('open'); }, style: { fontFamily: MONO, fontSize: 9, color: '#6E6C66', cursor: 'pointer', alignSelf: 'flex-start' } }, 'undo →')];
  }
  else if (t.variant === 'entitywiki') kids = [kindRow,
    h('div', { key: 't', style: { fontFamily: SERIF, fontSize: 17, lineHeight: 1.1, color: inkMain } }, t.title),
    h('div', { key: 'd', style: { fontSize: 12, color: '#C9C6BE', lineHeight: 1.5 } }, t.desc),
    h('div', { key: 'b', style: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#A5A29A' } }, (t.bullets || []).map((b, i) => h('span', { key: i }, '· ' + b))),
    h('div', { key: 'q', style: { borderLeft: '2px solid #3A3B40', paddingLeft: 11, fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: '#C9C6BE', flex: 1 } }, t.quote)];
  else if (t.variant === 'entitylive') kids = [kindRow,
    h('div', { key: 't', style: { fontFamily: SERIF, fontSize: 17, lineHeight: 1.1, color: inkMain } }, t.title),
    h('div', { key: 'n', style: { display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, marginTop: 2 } }, [
      h('span', { key: 'c', style: { fontFamily: SERIF, fontSize: 28, color: inkMain } }, t.claimsN),
      h('span', { key: 'cl', style: { fontFamily: MONO, fontSize: 10, color: '#A5A29A' } }, 'claims'),
      h('span', { key: 'o', style: { fontFamily: SERIF, fontSize: 28, color: '#D8C69C' } }, t.openN),
      h('span', { key: 'ol', style: { fontFamily: MONO, fontSize: 10, color: '#D8C69C' } }, 'open')]),
    h('span', { key: 's', style: { fontFamily: MONO, fontSize: 10, color: '#6E6C66' } }, 'synced 2m ago')];
  else if (t.variant === 'audit') kids = [kindRow,
    h('div', { key: 'tbl', style: { display: 'grid', gridTemplateColumns: '1fr 34px 26px', fontFamily: MONO, fontSize: 11, marginTop: 2 } }, [
      h('div', { key: 'h1', style: { color: '#6E6C66', padding: '4px 0', borderBottom: '1px solid #26272B' } }, 'Claim'),
      h('div', { key: 'h2', style: { color: '#6E6C66', padding: '4px 0', borderBottom: '1px solid #26272B', textAlign: 'right' } }, 'Src'),
      h('div', { key: 'h3', style: { color: '#6E6C66', padding: '4px 0', borderBottom: '1px solid #26272B', textAlign: 'right' } }, 'OK'),
      ...(t.rows || []).flatMap((r, i) => [
        h('div', { key: 'a' + i, style: { color: '#C9C6BE', padding: '5px 0' } }, r[0]),
        h('div', { key: 'b' + i, style: { color: '#A5A29A', padding: '5px 0', textAlign: 'right' } }, r[1]),
        h('div', { key: 'c' + i, style: { color: r[3], padding: '5px 0', textAlign: 'right' } }, r[2])])]),
    h('div', { key: 'tasks', style: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 } }, (t.tasks || []).map((tk) => {
      const done = !!checks[tk.id];
      return h('div', { key: tk.id, onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); setChecks(c => ({ ...c, [tk.id]: !c[tk.id] })); }, style: { display: 'flex', alignItems: 'center', gap: 8, color: done ? '#8A8880' : '#C9C6BE', cursor: 'pointer' } }, [
        h('span', { key: 'x', style: { width: 13, height: 13, flexShrink: 0, border: '1px solid ' + (done ? '#86A38C' : '#3A3B40'), background: done ? '#86A38C' : 'transparent', color: '#1A1B1E', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, done ? '✓' : ''),
        h('span', { key: 'l', style: { textDecoration: done ? 'line-through' : 'none' } }, tk.label)]);
    }))];
  else kids = [kindRow, titleEl(), footEl()];

  return { kids, barColor, bgOverride, onClickExtra };
}

// wrapper: card frame in the style of the section it sits in
function CardFrame({ t, sec, listView, body, style, innerRef, extra }) {
  if (sec === 'archive' && listView) {
    return h('div', { ref: innerRef, ...extra, style: { display: 'grid', gridTemplateColumns: '68px 1fr 90px', alignItems: 'center', gap: 12, padding: '8px 4px', borderBottom: '1px solid #1E1F22', cursor: 'grab', ...style } }, [
      h('span', { key: 'k', style: { fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#6E6C66', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.kind),
      h('span', { key: 's', style: { fontSize: 12, color: '#A5A29A' } }, t.title),
      h('span', { key: 'w', style: { fontFamily: MONO, fontSize: 10, color: '#6E6C66', textAlign: 'right' } }, t.foot)]);
  }
  if (sec === 'living') {
    return h('div', { ref: innerRef, ...extra, style: { background: '#1A1B1E', padding: 16, marginBottom: 4, cursor: 'grab', ...style } }, [
      h('div', { key: 'k', style: { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: '#A5A29A' } }, t.kind),
      h('div', { key: 'q', style: { fontFamily: SERIF, fontStyle: t.italic ? 'italic' : 'normal', fontSize: 19, color: '#E6E4DE', lineHeight: 1.2, marginTop: 6 } }, t.title),
      h('div', { key: 'm', style: { fontFamily: MONO, fontSize: 10, color: '#A5A29A', marginTop: 10 } }, t.foot)]);
  }
  const { kids, barColor, bgOverride } = body;
  return h('div', { ref: innerRef, ...extra, style: {
    gridColumn: 'span ' + (t.span === 2 ? 2 : 1), minWidth: 0, minHeight: 82,
    background: t.dashed ? 'transparent' : (bgOverride || t.bg || '#1A1B1E'),
    border: t.dashed ? '1px dashed #3A3B40' : 'none',
    boxShadow: t.variant === 'stack' ? '3px 3px 0 #131417, 6px 6px 0 #0D0E10' : (barColor ? 'inset 2px 0 0 ' + barColor : 'none'),
    color: t.dim ? '#4A4B4F' : '#E6E4DE', padding: barColor ? '10px 12px 10px 14px' : '10px 12px',
    display: 'flex', flexDirection: 'column', gap: t.variant === 'skeleton' ? 8 : 4,
    cursor: 'grab', ...style } }, kids);
}

function SortableCard({ id, sec, listView, onOpen }) {
  const t = cardDefs[id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const body = CardBody({ t });
  const lastDrag = React.useRef(0);
  if (isDragging) lastDrag.current = Date.now();
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.25 : 1,
  };
  const extra = {
    ...attributes, ...listeners,
    title: 'Drag to move · click to open',
    onClick: () => {
      if (Date.now() - lastDrag.current < 250) return;
      if (body.onClickExtra) { body.onClickExtra(); return; }
      if (t.to) onOpen(t.to);
    },
  };
  return h(CardFrame, { t, sec, listView, body, style, innerRef: setNodeRef, extra });
}

function OverlayCard({ id, sec, listView }) {
  const t = cardDefs[id];
  const body = CardBody({ t });
  return h('div', { style: { width: t.span === 2 ? 356 : 176, transform: 'scale(1.05)', boxShadow: '0 18px 44px rgba(0,0,0,0.65)', opacity: 0.95 } },
    h(CardFrame, { t, sec, listView, body, style: { gridColumn: 'auto' }, extra: {} }));
}

function SectionHeader({ label, right }) {
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' } }, [
    h('div', { key: 'l', style: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: '#A5A29A' } }, label),
    h('div', { key: 'r', style: { height: 1, flex: 1, background: 'linear-gradient(to right,#3A3B40,#1E1F22)' } }),
    right || null]);
}

function Home({ ctx }) {
  const [cards, setCards] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.pins) return saved;
    } catch (e) {}
    return DEFAULT_SECTIONS;
  });
  const [archiveView, setArchiveView] = React.useState('cards');
  const [activeId, setActiveId] = React.useState(null);
  React.useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cards)); } catch (e) {} }, [cards]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const findSec = (id) => SECTION_ORDER.find(k => (cards[k] || []).includes(id));

  const onDragOver = ({ active, over }) => {
    if (!over) return;
    const from = findSec(active.id);
    const to = SECTION_ORDER.includes(over.id) ? over.id : findSec(over.id);
    if (!from || !to || from === to) return;
    setCards(c => {
      const src = c[from].filter(x => x !== active.id);
      const dst = [...c[to]];
      const overIdx = dst.indexOf(over.id);
      dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, active.id);
      return { ...c, [from]: src, [to]: dst };
    });
  };
  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const sec = findSec(active.id);
    if (!sec) return;
    const items = cards[sec];
    const oldIdx = items.indexOf(active.id), newIdx = items.indexOf(over.id);
    if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
      setCards(c => ({ ...c, [sec]: arrayMove(c[sec], oldIdx, newIdx) }));
    }
  };

  const grid = (sec) => {
    const listMode = sec === 'living' || (sec === 'archive' && archiveView !== 'cards');
    return h(SortableContext, { items: cards[sec] || [], strategy: rectSortingStrategy },
      h('div', { style: listMode ? { minHeight: 36 } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 176px)', gridAutoRows: 'minmax(82px, auto)', gap: 4, alignContent: 'flex-start', justifyContent: 'start', minHeight: 36 } },
        (cards[sec] || []).map(id => h(SortableCard, { key: id, id, sec, listView: archiveView !== 'cards', onOpen: ctx.open }))));
  };

  const archToggle = h('div', { style: { display: 'flex', alignItems: 'stretch', border: '1px solid #26272B', fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em' } }, [
    h('div', { key: 'c', onClick: () => setArchiveView('cards'), style: { padding: '4px 10px', cursor: 'pointer', background: archiveView === 'cards' ? '#1E1F22' : 'transparent', color: archiveView === 'cards' ? '#E6E4DE' : '#6E6C66' } }, '◧ CARDS'),
    h('div', { key: 'li', onClick: () => setArchiveView('list'), style: { padding: '4px 10px', cursor: 'pointer', background: archiveView !== 'cards' ? '#1E1F22' : 'transparent', color: archiveView !== 'cards' ? '#E6E4DE' : '#6E6C66' } }, '≡ LIST')]);

  const activeSec = activeId ? findSec(activeId) : null;

  return h(DndContext, { sensors, collisionDetection: closestCenter, onDragStart: ({ active }) => setActiveId(active.id), onDragOver, onDragEnd, onDragCancel: () => setActiveId(null) },
    h('div', { style: { padding: '20px 24px', fontFamily: SANS } }, [
      h('div', { key: 'pins', style: { marginBottom: 18 } }, [h(SectionHeader, { key: 'h', label: SECTION_LABELS.pins }), grid('pins')]),
      h('div', { key: 'fresh', style: { marginBottom: 18 } }, [h(SectionHeader, { key: 'h', label: SECTION_LABELS.fresh }), grid('fresh')]),
      h('div', { key: 'living', style: { marginBottom: 18 } }, [h(SectionHeader, { key: 'h', label: SECTION_LABELS.living }), grid('living')]),
      h('div', { key: 'archive', style: { marginBottom: 18 } }, [h(SectionHeader, { key: 'h', label: 'ARCHIVE · ' + (34 + (cards.archive || []).length), right: archToggle }), grid('archive')]),
    ]),
    h(DragOverlay, null, activeId ? h(OverlayCard, { id: activeId, sec: activeSec, listView: archiveView !== 'cards' }) : null));
}

export function mountHome(el, ctx) {
  el.style.cssText = 'height:100%;overflow-y:auto;overflow-x:hidden;background:#0A0A0B;color:#E6E4DE;';
  const root = createRoot(el);
  root.render(h(Home, { ctx }));
  return () => root.unmount();
}
