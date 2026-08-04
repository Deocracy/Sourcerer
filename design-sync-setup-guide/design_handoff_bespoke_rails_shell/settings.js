// Settings applet — ported from Working Sourcerer UX UI Prototype.
// Mounted into a dockview panel by Sourcerer Bespoke Rails.dc.html via mountSettings(el, ctx).
// Sourcerer dark palette · IBM Plex. Left group nav + preference body.

import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';

const h = React.createElement;
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'IBM Plex Serif', serif";
const SANS = "'IBM Plex Sans', sans-serif";
const STORE_KEY = 'sourcerer-settings-v1';

const settingsIndex = [
  { id: 'you',          label: 'YOU',          children: [ {id:'profile',glyph:'○',label:'Profile'}, {id:'identity',glyph:'⌾',label:'Identity & voice'} ] },
  { id: 'workspace',    label: 'WORKSPACE',    children: [ {id:'appearance',glyph:'◧',label:'Appearance'}, {id:'layout',glyph:'▤',label:'Layout & panels'}, {id:'shortcuts',glyph:'⌘',label:'Shortcuts'}, {id:'notifications',glyph:'✧',label:'Notifications'} ] },
  { id: 'corpus',       label: 'CORPUS',       children: [ {id:'sources',glyph:'▤',label:'Sources'}, {id:'trust',glyph:'§',label:'Trust & provenance'}, {id:'backups',glyph:'⎈',label:'Backups'} ] },
  { id: 'intelligence', label: 'INTELLIGENCE', children: [ {id:'assistant',glyph:'≋',label:'Assistant & Agents'}, {id:'applets',glyph:'◍',label:'Applets'}, {id:'models',glyph:'◐',label:'Local models'}, {id:'external',glyph:'⌕',label:'External sources'} ] },
  { id: 'advanced',     label: 'ADVANCED',     children: [ {id:'data',glyph:'▦',label:'Data & export'}, {id:'developer',glyph:'⌗',label:'Developer'}, {id:'about',glyph:'◇',label:'About'} ] },
];

const DEFAULT = {
  activeLeaf: 'assistant',
  expanded: { you: false, workspace: false, corpus: false, intelligence: true, advanced: false },
  model: 'sonnet',
  approvals: { corpus: 'EVERY', external: 'AUTO', research: 'START' },
};

function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return { ...DEFAULT, ...JSON.parse(raw) }; } catch (e) {}
  return DEFAULT;
}

function Settings() {
  const [si, setSi] = React.useState(loadState);
  React.useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(si)); } catch (e) {} }, [si]);

  const toggleGroup = (id) => setSi(s => ({ ...s, expanded: { ...s.expanded, [id]: !s.expanded[id] } }));
  const setLeaf = (id) => setSi(s => ({ ...s, activeLeaf: id }));
  const setModel = (id) => setSi(s => ({ ...s, model: id }));
  const setApproval = (key, v) => setSi(s => ({ ...s, approvals: { ...s.approvals, [key]: v } }));

  // ---- VM ----
  let activeLeaf = null, activeGroupLabel = '';
  const settingsGroups = settingsIndex.map(g => {
    const open = !!si.expanded[g.id];
    return { label: g.label, count: String(g.children.length), open, caret: open ? '▾' : '▸',
      caretFg: open ? '#E6E4DE' : '#6E6C66', labelFg: open ? '#E6E4DE' : '#A5A29A', toggle: () => toggleGroup(g.id),
      children: g.children.map(c => { const on = si.activeLeaf === c.id; if (on) { activeLeaf = c; activeGroupLabel = g.label; }
        return { glyph: c.glyph, label: c.label, fg: on ? '#E6E4DE' : '#A5A29A', bg: on ? '#131418' : 'transparent', rail: on ? '#E6E4DE' : 'transparent', select: () => setLeaf(c.id) }; }) };
  });
  if (!activeLeaf) { activeLeaf = { label: 'Assistant & Agents' }; activeGroupLabel = 'INTELLIGENCE'; }
  const settingsIsAssistant = si.activeLeaf === 'assistant';
  const settingsTitle = activeLeaf.label;
  const settingsCrumb = 'SETTINGS · ' + activeGroupLabel + ' · ' + (activeLeaf.label || '').toUpperCase();
  const modelOptions = [
    { id: 'sonnet', label: 'Claude Sonnet 4.5', meta: 'default' },
    { id: 'gpt5',   label: 'GPT-5', meta: '' },
    { id: 'local',  label: 'Local · Llama 3.3 70B', meta: 'not installed' },
  ].map(m => { const on = si.model === m.id; return { ...m, fg: on ? '#E6E4DE' : '#A5A29A', dotBg: on ? '#E6E4DE' : 'transparent', dotBorder: on ? 'none' : '1px solid #26272B', select: () => setModel(m.id) }; });
  const approvalRows = [
    { key: 'corpus', label: 'Corpus mutations', opts: ['EVERY','BATCH','AUTO'] },
    { key: 'external', label: 'External searches', opts: ['EVERY','BATCH','AUTO'] },
    { key: 'research', label: 'Long-running research', opts: ['START','HOURLY','END'] },
  ].map(r => ({ label: r.label, opts: r.opts.map(v => { const on = si.approvals[r.key] === v; return { label: v, bg: on ? '#1E1F22' : 'transparent', fg: on ? '#E6E4DE' : '#6E6C66', select: () => setApproval(r.key, v) }; }) }));

  const assistantPane = h('div', { key: 'ap' }, [
    h('div', { key: 'm', style: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', padding: '18px 0', borderTop: '1px solid #1E1F22' } }, [
      h('div', { key: 'l' }, [ h('div', { key: 't', style: { fontSize: '14px', color: '#E6E4DE' } }, 'Model'), h('div', { key: 'd', style: { fontSize: '12px', color: '#6E6C66', lineHeight: 1.5, marginTop: '4px' } }, 'Which model handles reasoning + tool use.') ]),
      h('div', { key: 'r', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, modelOptions.map((m, i) => h('div', { key: i, onClick: m.select, style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', color: m.fg, cursor: 'pointer' } }, [
        h('span', { key: 'd', style: { width: '8px', height: '8px', background: m.dotBg, border: m.dotBorder } }),
        h('span', { key: 'l', style: { flex: 1, fontSize: '13px' } }, m.label),
        m.meta ? h('span', { key: 'me', style: { fontFamily: MONO, fontSize: '10px', color: '#6E6C66' } }, m.meta) : null,
      ]))),
    ]),
    h('div', { key: 'ap2', style: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', padding: '18px 0', borderTop: '1px solid #1E1F22' } }, [
      h('div', { key: 'l' }, [ h('div', { key: 't', style: { fontSize: '14px', color: '#E6E4DE' } }, 'Approvals'), h('div', { key: 'd', style: { fontSize: '12px', color: '#6E6C66', lineHeight: 1.5, marginTop: '4px' } }, 'When must Dashboard ask before acting?') ]),
      h('div', { key: 'r', style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, approvalRows.map((r, i) => h('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #1E1F22' } }, [
        h('span', { key: 'l', style: { flex: 1, fontSize: '13px', color: '#E6E4DE' } }, r.label),
        h('div', { key: 'o', style: { display: 'flex', border: '1px solid #26272B' } }, r.opts.map((o, k) => h('div', { key: k, onClick: o.select, style: { padding: '5px 10px', background: o.bg, color: o.fg, cursor: 'pointer', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.14em' } }, o.label))),
      ]))),
    ]),
    h('div', { key: 'v', style: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', padding: '18px 0', borderTop: '1px solid #1E1F22' } }, [
      h('div', { key: 'l' }, [ h('div', { key: 't', style: { fontSize: '14px', color: '#E6E4DE' } }, 'Voice'), h('div', { key: 'd', style: { fontSize: '12px', color: '#6E6C66', lineHeight: 1.5, marginTop: '4px' } }, 'How Dashboard writes back.') ]),
      h('div', { key: 'r' }, h('div', { style: { fontFamily: SERIF, fontSize: '15px', lineHeight: 1.6, color: '#C5C2BA', padding: '14px 16px', background: '#0F1013', borderLeft: '2px solid #26272B' } }, 'Cite everything. No hedging when evidence is solid. Never write "delve", "moreover", or emoji.')),
    ]),
  ]);
  const genericPane = h('div', { key: 'gp', style: { borderTop: '1px solid #1E1F22', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '18px' } }, [
    h('div', { key: 't', style: { fontSize: '14px', color: '#A5A29A', lineHeight: 1.6, maxWidth: '520px' } }, 'This preference group is wired as a placeholder. Pick Intelligence → Assistant & Agents to see a fully-built pane.'),
    h('div', { key: 'd', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', border: '1px dashed #26272B', color: '#6E6C66', fontFamily: MONO, fontSize: '11px' } }, [ h('span', { key: 'g', style: { color: '#A5A29A' } }, '⚙'), h('span', { key: 's' }, 'Dummy settings section — ' + settingsTitle) ]),
  ]);

  return h('div', { style: { display: 'grid', gridTemplateColumns: '210px 1fr', height: '100%', minHeight: 0, fontFamily: SANS, background: '#0A0A0B', color: '#E6E4DE' } }, [
    h('nav', { key: 'nav', style: { borderRight: '1px solid #1E1F22', padding: '16px 0', overflowY: 'auto' } }, [
      h('div', { key: 'h', style: { padding: '0 16px 12px', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', color: '#6E6C66' } }, 'SETTINGS'),
      ...settingsGroups.flatMap((g, gi) => [
        h('div', { key: 'g' + gi, onClick: g.toggle, style: { padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } }, [
          h('span', { key: 'c', style: { fontFamily: MONO, fontSize: '10px', color: g.caretFg, width: '10px' } }, g.caret),
          h('span', { key: 'l', style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '0.14em', color: g.labelFg, flex: 1 } }, g.label),
          h('span', { key: 'n', style: { fontFamily: MONO, fontSize: '10px', color: '#6E6C66' } }, g.count),
        ]),
        ...(g.open ? g.children.map((c, ci) => h('div', { key: 'g' + gi + 'c' + ci, onClick: c.select, style: { padding: '7px 16px 7px 36px', display: 'flex', alignItems: 'center', gap: '10px', color: c.fg, background: c.bg, borderLeft: '2px solid ' + c.rail, marginLeft: '-2px', cursor: 'pointer' } }, [
          h('span', { key: 'g', style: { width: '18px', textAlign: 'center', fontFamily: MONO, fontSize: '13px' } }, c.glyph),
          h('span', { key: 'l', style: { fontSize: '13px' } }, c.label),
        ])) : []),
      ]),
    ]),
    h('div', { key: 'body', style: { padding: '28px 32px', overflowY: 'auto' } }, [
      h('div', { key: 'crumb', style: { fontFamily: MONO, fontSize: '10px', letterSpacing: '0.14em', color: '#6E6C66' } }, settingsCrumb),
      h('h1', { key: 'title', style: { fontFamily: SERIF, fontWeight: 400, fontSize: '26px', margin: '6px 0 24px', color: '#E6E4DE', lineHeight: 1.1 } }, settingsTitle),
      settingsIsAssistant ? assistantPane : genericPane,
    ]),
  ]);
}

export function mountSettings(el, ctx = {}) {
  el.style.cssText = 'height:100%;';
  const root = createRoot(el);
  root.render(h(Settings, { ctx }));
  return () => root.unmount();
}
