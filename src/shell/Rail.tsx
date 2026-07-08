import { shellStore, useShellStore } from "../store/shellStore";
import { useRailDrag, getVisualRailOrder } from "./useRailDrag";
import { appletDefs, type AppletDef } from "./appletDefs";
import styles from "./Rail.module.css";

export type { AppletDef };

/**
 * Rail applet defs — re-exported from the shared `appletDefs.ts` source of
 * truth (plan 02-05 extracted this out of Rail.tsx so the dock's PanelBody
 * dispatcher consumes the same glyph/title/line map). Kept as `railDefs`
 * here for call-site continuity within this file.
 */
export const railDefs = appletDefs;

function openCatalog() {
  // eslint-disable-next-line no-console
  console.log("openCatalog: no-op stub in Phase 2 (Applet Catalog is Phase 4 scope)");
}

function openSettings() {
  // eslint-disable-next-line no-console
  console.log("openSettings: no-op stub in Phase 2 (Settings applet not built yet)");
}

/**
 * Rail — the bespoke three-mode left rail (RAIL-01/02/03). Renders from the
 * shell store's railMode/railWidth/railOrder/leftRailPinned/railApplet/badges
 * slices. Drag-resize, keyboard/double-click cycling, within-rail reorder,
 * and the pin affordance are wired in via useRailDrag (plan 02-04 Task 2/3).
 */
export function Rail() {
  const railMode = useShellStore((s) => s.railMode);
  const railWidth = useShellStore((s) => s.railWidth);
  const railOrder = useShellStore((s) => s.railOrder);
  const leftRailPinned = useShellStore((s) => s.leftRailPinned);
  const railApplet = useShellStore((s) => s.railApplet);
  const badges = useShellStore((s) => s.badges);

  const {
    navRef,
    liveSnap,
    onResizePointerDown,
    onResizeDoubleClick,
    rowDrag,
    onRowPointerDown,
    togglePin,
  } = useRailDrag();

  const mode = liveSnap ? liveSnap.mode : railMode;
  const width = liveSnap
    ? liveSnap.mode === "expanded"
      ? liveSnap.width
      : liveSnap.mode === "compact"
        ? 56
        : 6
    : railMode === "hidden"
      ? 6
      : railMode === "compact"
        ? 56
        : Math.max(132, Math.min(520, railWidth));

  if (mode === "hidden") {
    return (
      <nav ref={navRef} className={styles.rail} style={{ width }}>
        <div
          className={styles.hiddenStrip}
          title="Reopen rail (Cmd/Ctrl-\\)"
          onClick={() => shellStore.getState().cycleRailMode()}
        />
        <div
          className={styles.handle}
          onPointerDown={onResizePointerDown}
          onDoubleClick={onResizeDoubleClick}
          title="Drag to resize · double-click to cycle"
        />
      </nav>
    );
  }

  const orderedKeys = getVisualRailOrder(railOrder, leftRailPinned);
  const compact = mode === "compact";

  return (
    <nav ref={navRef} className={styles.rail} style={{ width }}>
      <div className={compact ? styles.listCompact : styles.listExpanded}>
        {orderedKeys.map((key, idx) => {
          const def = railDefs[key];
          if (!def) return null;
          const isActive = key === railApplet;
          const isPinned = leftRailPinned.includes(key);
          const badgeCount = badges[key];
          const showBadge = Boolean(badgeCount);
          const dropBefore = rowDrag != null && rowDrag.targetIndex === idx && rowDrag.key !== key;
          const dropAfter =
            rowDrag != null &&
            idx === orderedKeys.length - 1 &&
            rowDrag.targetIndex === orderedKeys.length &&
            rowDrag.key !== key;

          if (compact) {
            const rowClass = isActive
              ? `${styles.rowCompact} ${styles.rowActive}`
              : styles.rowCompact;
            return (
              <div
                key={key}
                data-rail-row={idx}
                className={rowClass}
                title={`${def.title} — drag to reorder, or out to dock`}
                onPointerDown={(e) => onRowPointerDown(key, e)}
              >
                {dropBefore && (
                  <div className={`${styles.dropLine} ${styles.dropLineCompactBefore}`} />
                )}
                {dropAfter && (
                  <div className={`${styles.dropLine} ${styles.dropLineCompactAfter}`} />
                )}
                <span className={styles.glyphCompact}>{def.glyph}</span>
                {showBadge && <div className={styles.badgeOverlay}>{badgeCount}</div>}
              </div>
            );
          }

          const rowClass = isActive ? `${styles.row} ${styles.rowActive}` : styles.row;
          return (
            <div
              key={key}
              data-rail-row={idx}
              className={rowClass}
              title="Drag to reorder, or out to dock"
              onPointerDown={(e) => onRowPointerDown(key, e)}
            >
              {dropBefore && (
                <div className={`${styles.dropLine} ${styles.dropLineExpandedBefore}`} />
              )}
              {dropAfter && (
                <div className={`${styles.dropLine} ${styles.dropLineExpandedAfter}`} />
              )}
              <div className={styles.glyph}>{def.glyph}</div>
              <div className={styles.label}>{def.title}</div>
              {showBadge && <div className={styles.badgeInline}>{badgeCount}</div>}
              <button
                type="button"
                className={
                  isPinned ? `${styles.pinButton} ${styles.pinButtonActive}` : styles.pinButton
                }
                title={isPinned ? "Unpin from bottom group" : "Pin to bottom group"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(key);
                }}
              >
                {isPinned ? "●" : "○"}
              </button>
            </div>
          );
        })}
        <div className={styles.spacer} />
        {compact ? (
          <div className={styles.footerCompact}>
            <div className={styles.catalogIcon} title="Applet Catalog" onClick={openCatalog}>
              ◍
            </div>
            <div className={styles.settingsIcon} title="Settings" onClick={openSettings}>
              ⚙
            </div>
            <div className={styles.avatarCompact} title="Casey · HUMAN">
              C
            </div>
          </div>
        ) : (
          <div className={styles.footer}>
            <div className={styles.catalogRow} onClick={openCatalog}>
              <div className={styles.glyph}>◍</div>
              <div className={styles.label}>Applet Catalog</div>
            </div>
            <div className={styles.userBlock}>
              <div className={styles.avatar}>C</div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>Casey</div>
                <div className={styles.userRole}>HUMAN</div>
              </div>
              <button
                type="button"
                className={styles.settingsBtn}
                title="Settings"
                onClick={openSettings}
              >
                ⚙
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        className={styles.handle}
        onPointerDown={onResizePointerDown}
        onDoubleClick={onResizeDoubleClick}
        title="Drag to resize · double-click to cycle"
      />
    </nav>
  );
}
