import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { applyLayout, deleteLayout, resetToDefault, saveLayout } from "../persistence/layouts";
import { getSavedLayouts, subscribeSavedLayouts } from "../persistence/workspaceStore";
import styles from "./LayoutsMenu.module.css";

/**
 * LayoutsMenu — the `LAYOUTS ▾` title-bar dropdown (D-01, PERS-02). Net-new
 * UI with no design-handoff precedent (03-PATTERNS.md/03-UI-SPEC.md §Interaction
 * Contract) — a `useState`-driven open/closed panel, no popover library.
 *
 * Mounted in TitleBar.tsx between the drag spacer and `<RailToggleButtons />`
 * (D-01). Reads the savedLayouts slice reactively via a small pub/sub seam
 * on workspaceStore.ts (subscribeSavedLayouts/getSavedLayouts) so a save or
 * delete triggers a re-render without a manual refresh.
 */
export function LayoutsMenu() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const savedLayouts = useSyncExternalStore(subscribeSavedLayouts, getSavedLayouts);
  // Most-recently-saved first (03-UI-SPEC.md §Interaction Contract "List
  // order" default) — saveLayout() appends new entries at the end of the
  // insertion-ordered savedLayouts map, so reversing gives recent-first.
  const rows = Object.values(savedLayouts).reverse();

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (saving) nameInputRef.current?.focus();
  }, [saving]);

  // WR-06: move focus INTO the panel when it opens (and back after the name
  // input closes) — without this the panel's onKeyDown never fires (focus
  // stays on the sibling trigger button) and the whole ArrowUp/ArrowDown/
  // Enter/Delete keyboard contract is unreachable. role="menu" without focus
  // management is also an a11y anti-pattern.
  useEffect(() => {
    if (open && !saving) panelRef.current?.focus();
  }, [open, saving]);

  function toggleOpen() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        setFocusedIndex(-1);
        setSaving(false);
      }
      return next;
    });
  }

  function handleApply(id: string) {
    applyLayout(id);
    setActiveId(id);
    setOpen(false);
  }

  function handleDelete(id: string) {
    deleteLayout(id);
    if (activeId === id) setActiveId(null);
  }

  function handleReset() {
    resetToDefault();
    setActiveId(null);
    setOpen(false);
  }

  function handleSaveConfirm() {
    const name = nameDraft.trim();
    if (!name) return;
    saveLayout(name);
    setSaving(false);
    setNameDraft("");
  }

  function handlePanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (saving) return; // the name input owns its own keydown handling
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((idx) => Math.min(idx + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < rows.length) {
        handleApply(rows[focusedIndex].id);
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (focusedIndex >= 0 && focusedIndex < rows.length) {
        handleDelete(rows[focusedIndex].id);
      }
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        aria-label="Layouts menu"
        className={open ? `${styles.trigger} ${styles.open}` : styles.trigger}
        onClick={toggleOpen}
      >
        LAYOUTS ▾
      </button>
      {open && (
        <div
          className={styles.panel}
          role="menu"
          tabIndex={-1}
          ref={panelRef}
          onKeyDown={handlePanelKeyDown}
        >
          <div className={styles.list}>
            {rows.length === 0 ? (
              <div className={styles.empty}>No saved layouts yet</div>
            ) : (
              rows.map((layout, i) => (
                <div
                  key={layout.id}
                  role="menuitem"
                  tabIndex={-1}
                  className={[
                    styles.row,
                    layout.id === activeId ? styles.active : "",
                    i === focusedIndex ? styles.focused : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleApply(layout.id)}
                >
                  <span className={styles.label}>{layout.name}</span>
                  <button
                    type="button"
                    className={styles.delete}
                    aria-label={`Delete layout ${layout.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(layout.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div className={styles.footer}>
            {saving ? (
              <input
                ref={nameInputRef}
                type="text"
                className={styles.nameInput}
                placeholder="Layout name…"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveConfirm();
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    setSaving(false);
                    setNameDraft("");
                  }
                }}
              />
            ) : (
              <button type="button" className={styles.footerRow} onClick={() => setSaving(true)}>
                Save current…
              </button>
            )}
            <button type="button" className={styles.footerRow} onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
