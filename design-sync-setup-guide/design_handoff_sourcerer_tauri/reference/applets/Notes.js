// ============================================================
// NOTES — first REAL applet. Proves the framework:
//   · registered in registry.js → appears in rail + catalog
//   · host.storage → notes survive reload
//   · host.ai → optional Claude summarize (works in preview)
// ============================================================

export const manifest = {
  key: 'Notes',
  glyph: '✳',
  code: 'NOTES',
  title: 'Notes',
  desc: 'Persistent scratch notes. The first real applet — everything you type is saved locally and reloads with the app.',
};

export function App({ React, host }) {
  const h = React.createElement;
  const T = host.theme;

  const [notes, setNotes] = React.useState(() => host.storage.get('notes', []));
  const [selId, setSelId] = React.useState(() => host.storage.get('sel', null));
  const [busy, setBusy] = React.useState(false);

  const save = (next) => { setNotes(next); host.storage.set('notes', next); };
  const select = (id) => { setSelId(id); host.storage.set('sel', id); };

  const add = () => {
    const n = { id: 'n' + Date.now(), title: '', body: '', summary: '', updated: Date.now() };
    save([n, ...notes]);
    select(n.id);
  };
  const remove = (id, e) => {
    e.stopPropagation();
    const next = notes.filter(n => n.id !== id);
    save(next);
    if (selId === id) select(next.length ? next[0].id : null);
  };
  const patch = (id, fields) => save(notes.map(n => n.id === id ? { ...n, ...fields, updated: Date.now() } : n));

  const sel = notes.find(n => n.id === selId) || null;

  const summarize = async () => {
    if (!sel || !sel.body.trim() || busy) return;
    setBusy(true);
    try {
      const text = await host.ai('Summarize this note in one plain sentence, no preamble:\n\n' + sel.body);
      patch(sel.id, { summary: text.trim() });
    } catch (err) {
      patch(sel.id, { summary: '(AI unavailable here: ' + err.message + ')' });
    }
    setBusy(false);
  };

  const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ---- left: note list ----
  const list = h('div', { key: 'list', style: { borderRight: '1px solid ' + T.line, display: 'flex', flexDirection: 'column', minHeight: 0 } }, [
    h('div', { key: 'hd', style: { padding: '14px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid ' + T.line } }, [
      h('span', { key: 'l', style: { flex: 1, fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.16em', color: T.dim } }, 'NOTES · ' + notes.length),
      h('span', { key: 'a', onClick: add, title: 'New note', style: { fontFamily: T.mono, fontSize: '14px', color: T.fg, cursor: 'pointer', padding: '0 4px' } }, '＋'),
    ]),
    h('div', { key: 'rows', style: { flex: 1, overflowY: 'auto' } }, notes.length ? notes.map(n =>
      h('div', { key: n.id, onClick: () => select(n.id), style: { padding: '11px 16px', borderBottom: '1px solid ' + T.line, borderLeft: '2px solid ' + (n.id === selId ? T.fg : 'transparent'), marginLeft: '-2px', background: n.id === selId ? T.panel : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: '8px' } }, [
        h('div', { key: 't', style: { flex: 1, minWidth: 0 } }, [
          h('div', { key: 'a', style: { fontSize: '13px', color: n.id === selId ? T.fg : T.mid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, n.title || 'Untitled'),
          h('div', { key: 'b', style: { fontFamily: T.mono, fontSize: '9px', color: T.dim, marginTop: '3px' } }, when(n.updated)),
        ]),
        h('span', { key: 'x', onClick: (e) => remove(n.id, e), title: 'Delete', style: { fontFamily: T.mono, fontSize: '10px', color: T.dim, cursor: 'pointer' } }, '✕'),
      ])
    ) : h('div', { style: { padding: '20px 16px', fontFamily: T.mono, fontSize: '10px', lineHeight: 1.7, color: T.dim } }, 'No notes yet. ＋ to create one — it will still be here after a reload.')),
  ]);

  // ---- right: editor ----
  const editor = sel ? h('div', { key: 'ed', style: { display: 'flex', flexDirection: 'column', minHeight: 0 } }, [
    h('div', { key: 'bar', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderBottom: '1px solid ' + T.line } }, [
      h('input', { key: 'ti', value: sel.title, placeholder: 'Untitled', onInput: (e) => patch(sel.id, { title: e.target.value }), style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.fg, fontFamily: T.serif, fontSize: '18px' } }),
      h('div', { key: 'ai', onClick: summarize, title: 'Ask Claude for a one-line summary', style: { padding: '6px 12px', border: '1px solid ' + T.line, color: busy ? T.dim : T.mid, fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em', cursor: 'pointer', whiteSpace: 'nowrap' } }, busy ? 'THINKING…' : '✦ SUMMARIZE'),
    ]),
    sel.summary ? h('div', { key: 'sum', style: { padding: '12px 20px', borderBottom: '1px solid ' + T.line, fontFamily: T.serif, fontStyle: 'italic', fontSize: '14px', lineHeight: 1.5, color: T.mid } }, sel.summary) : null,
    h('textarea', { key: 'body', value: sel.body, placeholder: 'Write…', onInput: (e) => patch(sel.id, { body: e.target.value }), style: { flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', padding: '18px 20px', color: T.fg, fontFamily: T.sans, fontSize: '14px', lineHeight: 1.65 } }),
  ]) : h('div', { key: 'ed', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.mono, fontSize: '11px', color: T.dim } }, 'Select or create a note');

  return h('div', { style: { height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: '240px 1fr', fontFamily: T.sans, color: T.fg } }, [list, editor]);
}
