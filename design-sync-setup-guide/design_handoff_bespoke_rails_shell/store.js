// Shared/cross-applet state for the Divi shell.
// Per CLAUDE.md: zustand is the state layer. Vanilla createStore so it works
// both inside React applets and in the DC logic class (outside React).

import { createStore } from 'https://esm.sh/zustand@4.5.5/vanilla';

const LS = 'sourcerer-shell-store-v1';
function load() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
}
const saved = load();

export const store = createStore((set, get) => ({
  // ---- corpora (status-bar corpus switcher re-scopes the whole app) ----
  corpora: [
    { id: 'ficino',  name: 'Ficino corpus',    tier: 'Full',     docs: 342, conflicts: 5 },
    { id: 'medici',  name: 'Medici letters',   tier: 'Standard', docs: 319, conflicts: 2 },
    { id: 'sandbox', name: 'Scratch corpus',   tier: 'Simple',   docs: 12,  conflicts: 0 },
  ],
  activeCorpus: saved.activeCorpus || 'ficino',
  setCorpus: (id) => { set({ activeCorpus: id }); persist(get); },

  // ---- which applet's rail is showing (follows the active dockview panel) ----
  railApplet: 'Home',
  setRailApplet: (key) => { if (get().railApplet !== key) set({ railApplet: key }); },

  // ---- side rail (B zone) collapse ----
  railOpen: saved.railOpen !== false,
  toggleRail: () => { set(s => ({ railOpen: !s.railOpen })); persist(get); },
  setRailOpen: (v) => { set({ railOpen: v }); persist(get); },

  // ---- left applet rail: 3-state cycle (expanded → compact → hidden) ----
  railMode: saved.railMode || 'expanded',
  setRailMode: (m) => { set({ railMode: m, railOpen: m !== 'hidden' }); persist(get); },
  cycleRailMode: () => {
    const next = { expanded: 'compact', compact: 'hidden', hidden: 'expanded' }[get().railMode] || 'expanded';
    set({ railMode: next, railOpen: next !== 'hidden' });
    persist(get);
  },

  // ---- right rail (D zone) collapse + pins ----
  rightRailOpen: saved.rightRailOpen !== false,
  toggleRightRail: () => { set(s => ({ rightRailOpen: !s.rightRailOpen })); persist(get); },
  // pinned = rail keeps its current view; unpinned = follows context
  leftRailPinned: saved.leftRailPinned === true,
  toggleLeftPin: () => { set(s => ({ leftRailPinned: !s.leftRailPinned })); persist(get); },
  rightRailPinned: saved.rightRailPinned !== false,
  toggleRightPin: () => { set(s => ({ rightRailPinned: !s.rightRailPinned })); persist(get); },

  // ---- rail selection per applet (selected doc / entity / conversation) ----
  selection: saved.selection || { Library: 'doc-ficino-vita', Wiki: 'ficino', Chat: 'conv-neoplatonism' },
  select: (applet, id) => { set(s => ({ selection: { ...s.selection, [applet]: id } })); persist(get); },

  // ---- review queue count (surfaced in status bar + Home CTA) ----
  reviewCount: 3,
  setReviewCount: (n) => set({ reviewCount: n }),
}));

function persist(get) {
  const s = get();
  try {
    localStorage.setItem(LS, JSON.stringify({
      activeCorpus: s.activeCorpus, railOpen: s.railOpen, railMode: s.railMode, selection: s.selection,
      rightRailOpen: s.rightRailOpen, leftRailPinned: s.leftRailPinned, rightRailPinned: s.rightRailPinned,
    }));
  } catch (e) {}
}

// convenience: subscribe to a selector, call cb on change (used by the DC logic class)
export function subscribe(selector, cb) {
  let prev = selector(store.getState());
  return store.subscribe((state) => {
    const next = selector(state);
    if (next !== prev) { prev = next; cb(next); }
  });
}
