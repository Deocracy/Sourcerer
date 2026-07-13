import { useEffect, useRef, useState } from "react";
import type { AppletManifest, AppletModule, Host } from "../../host/types";
import { appletDefs } from "../../shell/appletDefs";
import { getInstanceState, setInstanceState, scheduleWorkspaceSave } from "../../host/instanceState";
import { notesStore, useNotesStore, ensureHydrated, scheduleNotesSave, flushNotesSave } from "./store";
import { relativeTime } from "./relativeTime";
import styles from "./Notes.module.css";

/**
 * src/applets/Notes/index.tsx — the real Notes applet (FWK-02 stub swap,
 * NOTE-01, 05-01-PLAN.md). Two-pane list+editor over the module-level shared
 * store (D-04), persisted through host.storage. Create/edit (Task 2) plus
 * delete and per-tab selected-note memory (Task 3, D-02/D-06/D-07).
 *
 * D-12 exception: Notes is real, not a stub — the eyebrow renders
 * `APPLET · {TITLE} · {CODE}` (TemplatedStub.tsx's exact format) with no
 * sibling .demoChip.
 *
 * Boundary-safe: only imports from ../../host/** and ../../shell/appletDefs
 * (the one sanctioned shell/** exception) — src/applets/boundary.test.ts
 * enforces this mechanically. `getInstanceState`/`setInstanceState`/
 * `scheduleWorkspaceSave` come from src/host/instanceState.ts directly
 * (NOT the host prop — Host stays five members, RESEARCH Pattern 2).
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
  const deleteNote = useNotesStore((s) => s.deleteNote);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seededRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const focusTitleRef = useRef(false);

  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState(false);
  // CR-02: monotonic token guarding in-flight host.ai() results. Bumped on
  // every selection change and every new summarize, so a request that resolves
  // after the user moved to another note is discarded instead of leaking its
  // summary across notes (D-03).
  const summarizeSeqRef = useRef(0);

  useEffect(() => {
    void ensureHydrated(host.storage);
  }, [host.storage]);

  // First-hydrate restore (D-06/D-07): the per-tab remembered selection only
  // wins if that note still exists (CR-02 GC-tolerant); otherwise fall back
  // silently to notes[0] (most-recently-updated, D-01's sort order) or null
  // — never an error.
  useEffect(() => {
    if (hydrated && !seededRef.current) {
      seededRef.current = true;
      const saved = getInstanceState(host.instanceId) as { selectedNoteId?: string } | undefined;
      const initial =
        saved?.selectedNoteId && notes.some((n) => n.id === saved.selectedNoteId)
          ? saved.selectedNoteId
          : (notes[0]?.id ?? null);
      setSelectedId(initial);
    }
  }, [hydrated, notes, host.instanceId]);

  // WR-02: repair a dangling selection. Another tab (D-04 live mirror) can
  // delete the note this tab has selected; without this, the editor shows the
  // misleading "No notes yet" empty state beside a populated list and never
  // recovers until the user manually clicks a row. Re-point at the top note
  // (or null when truly empty). Only runs once seeded so it can't fight the
  // D-06 restore.
  useEffect(() => {
    if (
      hydrated &&
      seededRef.current &&
      selectedId !== null &&
      !notes.some((n) => n.id === selectedId)
    ) {
      selectNote(notes[0]?.id ?? null);
    }
    // selectNote is a hoisted, stable-enough handler; deps track the state it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, hydrated, selectedId]);

  useEffect(() => {
    if (focusTitleRef.current) {
      focusTitleRef.current = false;
      titleRef.current?.focus();
    }
  }, [selectedId]);

  // WR-03: React does not fire input blur on unmount, so closing the Notes
  // panel or switching layouts (Phase 4 CR-02 disposes panels) within the
  // 400ms debounce window drops the trailing edits. Flush on unmount, guarded
  // on hydrated so a pre-hydration unmount can't write an empty array over
  // real persisted notes.
  useEffect(
    () => () => {
      if (notesStore.getState().hydrated) flushNotesSave(host.storage);
    },
    [host.storage],
  );

  // WR-05 single-tracked-timer discipline (mirrors Library's toast timer) —
  // clear any pending confirm-flip timer on unmount.
  useEffect(
    () => () => {
      if (confirmTimerRef.current != null) clearTimeout(confirmTimerRef.current);
    },
    [],
  );

  // Mutate-then-persist idiom (src/shell/Dock.tsx's exact shape): mutate the
  // in-memory instanceState slice, then flush via scheduleWorkspaceSave.
  function selectNote(id: string | null) {
    // WR-01: disarm any pending delete confirmation — consent given for the
    // previously-selected note must not carry onto a different record.
    if (confirmTimerRef.current != null) clearTimeout(confirmTimerRef.current);
    setConfirming(false);
    // CR-02: invalidate any in-flight summarize so its late result is dropped.
    summarizeSeqRef.current++;
    setSelectedId(id);
    setInstanceState(host.instanceId, { selectedNoteId: id });
    scheduleWorkspaceSave();
    // D-03: the AI summary is ephemeral — never persisted, and must not leak
    // across notes. Clear it (and any error) on every selection change.
    setSummary(null);
    setSummarizeError(false);
  }

  function handleAddNote() {
    const id = addNote();
    scheduleNotesSave(host.storage);
    selectNote(id);
    focusTitleRef.current = true;
  }

  function handleTitleChange(id: string, value: string) {
    updateNote(id, { title: value });
    scheduleNotesSave(host.storage);
  }

  function handleBodyChange(id: string, value: string) {
    updateNote(id, { body: value });
    scheduleNotesSave(host.storage);
  }

  function flush() {
    flushNotesSave(host.storage);
  }

  function handleDeleteClick() {
    if (!confirming) {
      setConfirming(true);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (confirmTimerRef.current != null) clearTimeout(confirmTimerRef.current);
    setConfirming(false);
    if (!selectedId) return;
    const nextId = deleteNote(selectedId);
    flushNotesSave(host.storage);
    selectNote(nextId);
  }

  // NOTE-02: the Summarize action — host.ai() is the sole AI seam (never
  // invoke("host_ai") directly). One try/catch covers every failure mode
  // aiComplete's Promise contract can produce (in-band error event OR the
  // 120s inactivity watchdog) — exactly one honest-degrade error, never a
  // hang. The result is local-only state (D-03 ephemeral): never written to
  // host.storage, and cleared on note switch by selectNote() above.
  async function handleSummarize(note: { title: string; body: string }) {
    const seq = ++summarizeSeqRef.current;
    setSummarizing(true);
    setSummarizeError(false);
    try {
      const result = await host.ai(
        `Summarize this note in 1-2 sentences:\n\n${note.title}\n\n${note.body}`,
      );
      // CR-02: only apply the result if the user is still on this note.
      if (seq === summarizeSeqRef.current) setSummary(result);
    } catch {
      if (seq === summarizeSeqRef.current) setSummarizeError(true);
    } finally {
      if (seq === summarizeSeqRef.current) setSummarizing(false);
    }
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
            <button
              type="button"
              className={styles.newNoteBtn}
              onClick={handleAddNote}
              disabled={!hydrated}
            >
              + New Note
            </button>
          </div>
          <div className={styles.listBody}>
            {notes.map((note) => (
              <div
                key={note.id}
                className={note.id === selectedId ? `${styles.row} ${styles.active}` : styles.row}
                onClick={() => selectNote(note.id)}
              >
                <div className={styles.rowLabel}>{note.title.trim() || "Untitled"}</div>
                <div className={styles.rowMeta}>{relativeTime(note.updatedAt)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.editorPane}>
          {/* CR-01: don't render the mutation UI until hydration completes —
              a note created pre-hydration would be silently wiped when disk
              state loads, and (with WR-02) the empty state pre-hydration is
              misleading. */}
          {!hydrated ? null : selectedNote ? (
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
              <div className={styles.toolbar}>
                <span className={styles.toolbarTime}>{relativeTime(selectedNote.updatedAt)}</span>
                <button
                  type="button"
                  className={styles.summarize}
                  disabled={summarizing}
                  onClick={() => void handleSummarize(selectedNote)}
                >
                  {summarizing ? "Summarizing…" : "Summarize"}
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  aria-label="Delete note"
                  onClick={handleDeleteClick}
                >
                  {confirming ? "Delete for real?" : "Delete"}
                </button>
              </div>
              {summary != null && <div className={styles.summaryBlock}>{summary}</div>}
              {summarizeError && (
                <div className={styles.summaryError}>
                  <div>Couldn&#39;t summarize this note.</div>
                  <div>Check your connection and try again.</div>
                </div>
              )}
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
