// ============================================================
// APPLET TEMPLATE — copy this file to start a new real applet.
// See applets/README.md for the full host API contract.
// ============================================================

// 1. MANIFEST — how the applet appears in the rail, tabs, and catalog.
export const manifest = {
  key: 'Template',          // unique id. If it matches a demo applet key
                            // (Library, Wiki, Graph, Chat, Writing, Browser,
                            // Kanban, News, KeyPass, Dadabase) it REPLACES
                            // that demo with your real implementation.
  glyph: '◌',               // single mono glyph for rail / tabs
  code: 'TMPL',             // short code shown in headers
  title: 'Template',        // human name
  desc: 'Starter applet. Copy me.',
};

// 2. APP — a React function component. React comes in via props
//    (do not import it). `host` is your door to the shell.
export function App({ React, host }) {
  const h = React.createElement;
  const T = host.theme; // shared colors + fonts — use these, don't invent

  // Persistent state: read once from host.storage, write on every change.
  const [count, setCount] = React.useState(() => host.storage.get('count', 0));
  const bump = () => {
    const next = count + 1;
    setCount(next);
    host.storage.set('count', next); // survives reload
  };

  return h('div', { style: { padding: '32px 36px', fontFamily: T.sans, color: T.fg, display: 'flex', flexDirection: 'column', gap: '18px' } }, [
    h('div', { key: 'k', style: { fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.16em', color: T.dim } }, 'APPLET · ' + manifest.code + ' · REAL'),
    h('div', { key: 't', style: { fontFamily: T.serif, fontSize: '26px', lineHeight: 1.1 } }, manifest.title),
    h('div', { key: 'c', onClick: bump, style: { alignSelf: 'flex-start', padding: '10px 16px', background: T.panel, border: '1px solid ' + T.line, fontFamily: T.mono, fontSize: '12px', cursor: 'pointer' } }, 'CLICKED ' + count + '× — reload to verify it persists'),
  ]);
}
