import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { nanoid } from "nanoid";
import type { AppletStorage } from "../../host/types";

/**
 * store.ts — the module-level shared Notes store (D-04 live mirror across
 * every open Notes tab). Mirrors src/store/shellStore.ts's
 * createStore/useStore vanilla-zustand shape, but persists through
 * host.storage (per-instance-injected) rather than workspace.json — the
 * module executes exactly once for the app's process lifetime since
 * src/shell/registry.ts statically imports this module exactly once
 * (05-RESEARCH.md Pattern 1).
 *
 * Note ids use plain nanoid() — NOT aiComplete.ts's SESSION_ID_PATTERN
 * alnum-stripping, which exists solely for the sidecar's session-id
 * constraint and does not apply here (05-RESEARCH.md anti-pattern).
 */
export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

interface NotesState {
  notes: Note[];
  hydrated: boolean;
  addNote(): string;
  updateNote(id: string, patch: Partial<Pick<Note, "title" | "body">>): void;
  /** D-02: returns the id of the note that should be selected next — the
   *  note that takes the deleted note's visual slot, the new last note if
   *  the deleted note was last, or null if the list is now empty. */
  deleteNote(id: string): string | null;
}

function sortByUpdatedDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const notesStore = createStore<NotesState>()((set, get) => ({
  notes: [],
  hydrated: false,

  addNote: () => {
    const id = nanoid();
    const now = Date.now();
    const note: Note = { id, title: "", body: "", createdAt: now, updatedAt: now };
    set((state) => ({ notes: sortByUpdatedDesc([note, ...state.notes]) }));
    return id;
  },

  updateNote: (id, patch) => {
    const now = Date.now();
    set((state) => ({
      notes: sortByUpdatedDesc(
        state.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n)),
      ),
    }));
  },

  deleteNote: (id) => {
    const before = get().notes;
    const idx = before.findIndex((n) => n.id === id);
    if (idx === -1) return before[0]?.id ?? null;
    const after = before.filter((n) => n.id !== id);
    set({ notes: after });
    if (after.length === 0) return null;
    const nextIdx = idx < after.length ? idx : after.length - 1;
    return after[nextIdx].id;
  },
}));

/** React binding — components subscribe with a selector so they only
 *  re-render on the slice they read (zustand 5's useStore over a vanilla
 *  store, matching shellStore.ts's useShellStore). */
export function useNotesStore<T>(selector: (state: NotesState) => T): T {
  return useStore(notesStore, selector);
}

let hydratePromise: Promise<void> | null = null;

/** Idempotent — safe to call from every mounting Notes instance; only the
 *  first caller's host.storage.get() actually runs (hydrate-once guard,
 *  05-RESEARCH.md Pattern 1 / Pitfall 3: a second Notes tab must never
 *  re-issue host.storage.get and risk clobbering concurrent edits with
 *  stale disk data). */
export function ensureHydrated(storage: AppletStorage): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = storage.get<Note[]>("notes", []).then((notes) => {
      notesStore.setState({ notes: sortByUpdatedDesc(notes), hydrated: true });
    });
  }
  return hydratePromise;
}

const SAVE_DEBOUNCE_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced write-through of the full notes array to host.storage,
 *  independent of workspace.json's own 300ms scheduleWorkspaceSave debounce
 *  (a different file, different concern — 05-RESEARCH.md Pattern 3). */
export function scheduleNotesSave(storage: AppletStorage, notes: Note[]): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void storage.set("notes", notes);
  }, SAVE_DEBOUNCE_MS);
}

/** Immediate write-through, bypassing the debounce — called on blur so
 *  navigating away from a note doesn't lose the trailing debounce window. */
export function flushNotesSave(storage: AppletStorage, notes: Note[]): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  void storage.set("notes", notes);
}
