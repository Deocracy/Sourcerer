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

/** WR-04: shape-guard a single persisted note. host.storage.get returns
 *  `raw as T` with zero validation, so a hand-edited / partially-written /
 *  schema-drifted applets.json can hand us non-Note values that crash the
 *  editor on `note.title.trim()`. Filter to well-formed notes only. */
function isNote(v: unknown): v is Note {
  const n = v as Note;
  return (
    !!n &&
    typeof n === "object" &&
    typeof n.id === "string" &&
    typeof n.title === "string" &&
    typeof n.body === "string" &&
    typeof n.createdAt === "number" &&
    typeof n.updatedAt === "number"
  );
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
    hydratePromise = storage
      .get<unknown>("notes", [])
      .then((raw) => {
        const diskNotes = Array.isArray(raw) ? raw.filter(isNote) : [];
        // CR-01: the UI is interactive before this resolves. If the user
        // already created/edited a note in the race window, those local
        // mutations must win — replacing the array here would wipe them from
        // the UI and (with the flush-time save below) clobber disk. Only
        // adopt disk state when the store is still empty.
        notesStore.setState((s) =>
          s.notes.length > 0
            ? { hydrated: true }
            : { notes: sortByUpdatedDesc(diskNotes), hydrated: true },
        );
      })
      .catch(() => {
        // WR-04: never cache a rejected promise — degrade to empty and flip
        // hydrated so the applet isn't wedged on the empty state for the
        // whole session (every remount reuses this same promise).
        notesStore.setState({ hydrated: true });
      });
  }
  return hydratePromise;
}

const SAVE_DEBOUNCE_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced write-through of the full notes array to host.storage,
 *  independent of workspace.json's own 300ms scheduleWorkspaceSave debounce
 *  (a different file, different concern — 05-RESEARCH.md Pattern 3).
 *
 *  CR-01: reads the notes array at FLUSH time, not schedule time. Snapshotting
 *  at schedule time let a pre-hydration `[newNote]` capture reach disk 400ms
 *  later and clobber every previously persisted note. Reading at flush mirrors
 *  workspaceStore's read-at-flush contract. */
export function scheduleNotesSave(storage: AppletStorage): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void storage.set("notes", notesStore.getState().notes);
  }, SAVE_DEBOUNCE_MS);
}

/** Immediate write-through, bypassing the debounce — called on blur (and on
 *  unmount, WR-03) so navigating away from a note doesn't lose the trailing
 *  debounce window. Reads current store state at call time (CR-01). */
export function flushNotesSave(storage: AppletStorage): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  void storage.set("notes", notesStore.getState().notes);
}
