import type { AppletManifest, Host } from "../../host/types";
import type { DemoRow } from "./demoRows";
import styles from "./TemplatedStub.module.css";

export interface TemplatedStubProps {
  manifest: AppletManifest;
  host: Host;
  rows: DemoRow[];
}

/**
 * TemplatedStub — the one shared templated-stub component (D-10/D-13),
 * lifted verbatim from PanelBody.tsx's visual pattern (glyph tile, serif
 * title, description) with per-applet demo rows and a subtle "DEMO" chip
 * (D-12: mono, --color-faint, never accent, never a full banner).
 *
 * Called BY the ~11 thin per-key applet modules generated in
 * src/applets/templated.ts — it is not itself registered under a key.
 * `host` is accepted (per the AppletModule App({host}) contract each caller
 * satisfies) but unused by the demo body itself — no live host.ai()/storage
 * calls in a stub (that would blur the "part demo" boundary CLAUDE.md
 * protects).
 */
export function TemplatedStub({ manifest, rows }: TemplatedStubProps) {
  return (
    <div className={styles.host}>
      <div className={styles.wrap}>
        <div className={styles.eyebrowRow}>
          <div className={styles.eyebrow}>
            APPLET · {manifest.title.toUpperCase()} · {manifest.code}
          </div>
          <div className={styles.demoChip}>DEMO</div>
        </div>
        <div className={styles.header}>
          <div className={styles.glyphTile}>{manifest.glyph}</div>
          <div className={styles.title}>{manifest.title}</div>
        </div>
        <div className={styles.desc}>{manifest.desc}</div>
        <div className={styles.rowsBox}>
          {rows.map((row, i) => (
            <div className={styles.row} key={i}>
              <div className={styles.rowPrimary}>{row.primary}</div>
              {row.secondary ? <div className={styles.rowSecondary}>{row.secondary}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
