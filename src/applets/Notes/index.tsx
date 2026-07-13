import { useEffect, useRef, useState } from "react";
import type { AppletManifest, AppletModule, Host } from "../../host/types";
import { appletDefs } from "../../shell/appletDefs";
import { notesStore, useNotesStore, ensureHydrated, scheduleNotesSave, flushNotesSave } from "./store";
import { relativeTime } from "./relativeTime";
import styles from "./Notes.module.css";

/**
 * src/applets/Notes/index.tsx — the real Notes applet (FWK-02 stub swap,
 * NOTE-01, 05-01-PLAN.md Task 2). Two-pane list+editor over the module-level
 * shared store (D-04), persisted through host.storage. Create + edit +
 * auto-persist land here; delete + per-tab selected-note memory (D-06/D-07,
 * via src/host/instanceState.ts) land in Task 3.
 *
 * D-12 exception: Notes is real, not a stub — the eyebrow renders
 * `APPLET · {TITLE} · {CODE}` (TemplatedStub.tsx's exact format) with no
 * sibling .demoChip.
 *
 * Boundary-safe: only imports from ../../host/** and ../../shell/appletDefs
 * (the one sanctioned shell/** exception) — src/applets/boundary.test.ts
 * enforces this mechanically.
 */

const def = appletDefs.Notes;

export const manifest: AppletManifest = {
  key: "Notes",
  glyph: def.glyph,
  code: def.code,
  title: def.title,
  desc: def.line,
};

function Notes({ host }: { host: Host }) {
  const notes = useNotesStore((s) => s.notes);
  const hydrated = useNotesStore((s) => s.hydrated);
  const addNote = useNotesStore((s) => s.addNote);
  const updateNote = useNotesStore((s) => s.updateNote);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seededRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const focusTitleRef = useRef(false);

  useEffect(() => {
    void ensureHydrated(host.storage);
  }, [host.storage]);

  // First-hydrate default selection (most-recently-updated note, D-01's
  // sort order). Task 3 replaces this with the getInstanceState-driven
  // per-tab restore (D-06/D-07).
  useEffect(() => {
    if (hydrated && !seededRef.current) {
      seededRef.current = true;
      setSelectedId(notes[0]?.id ?? null);
    }
  }, [hydrated, notes]);

  useEffect(() => {
    if (focusTitleRef.current) {
      focusTitleRef.current = false;
      titleRef.current?.focus();
    }
  }, [selectedId]);

  function handleAddNote() {
    const id = addNote();
    scheduleNotesSave(host.storage, notesStore.getState().notes);
    setSelectedId(id);
    focusTitleRef.current = true;
  }

  function handleTitleChange(id: string, value: string) {
    updateNote(id, { title: value });
    scheduleNotesSave(host.storage, notesStore.getState().notes);
  }

  function handleBodyChange(id: string, value: string) {
    updateNote(id, { body: value });
    scheduleNotesSave(host.storage, notesStore.getState().notes);
  }

  function flush() {
    flushNotesSave(host.storage, notesStore.getState().notes);
  }

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className={styles.host}>
      <div className={styles.eyebrow}>
        APPLET · {manifest.title.toUpperCase()} · {manifest.code}
      </div>
      <div className={styles.layout}>
        <div className={styles.listPane}>
          <div className={styles.listHeader}>
            <button type="button" className={styles.newNoteBtn} onClick={handleAddNote}>
              + New Note
            </button>
          </div>
          <div className={styles.listBody}>
            {notes.map((note) => (
              <div
                key={note.id}
                className={note.id === selectedId ? `${styles.row} ${styles.active}` : styles.row}
                onClick={() => setSelectedId(note.id)}
              >
                <div className={styles.rowLabel}>{note.title.trim() || "Untitled"}</div>
                <div className={styles.rowMeta}>{relativeTime(note.updatedAt)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.editorPane}>
          {selectedNote ? (
            <>
              <input
                ref={titleRef}
                className={styles.titleInput}
                aria-label="Note title"
                placeholder="Untitled"
                value={selectedNote.title}
                onChange={(e) => handleTitleChange(selectedNote.id, e.target.value)}
                onBlur={flush}
              />
              <textarea
                className={styles.bodyInput}
                aria-label="Note body"
                value={selectedNote.body}
                onChange={(e) => handleBodyChange(selectedNote.id, e.target.value)}
                onBlur={flush}
              />
            </>
          ) : (
            <div className={styles.editorEmpty}>
              <div className={styles.editorEmptyHeading}>No notes yet</div>
              <div className={styles.editorEmptyBody}>
                Create your first note to start capturing quick thoughts. Notes save
                automatically and can graduate into the corpus later.
              </div>
              <button type="button" className={styles.newNoteBtn} onClick={handleAddNote}>
                + New Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const App: AppletModule["App"] = ({ host }) => <Notes host={host} />;
