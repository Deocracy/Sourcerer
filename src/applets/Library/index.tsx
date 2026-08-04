import React, { useEffect, useRef, useState } from "react";
import type { AppletManifest, AppletModule, Host } from "../../host/types";
import { appletDefs } from "../../shell/appletDefs";
import {
  CORPORA,
  CORPUS_STATS,
  DOCS,
  RECENT,
  INGEST_QUEUE,
  CHUNK_PREVIEW,
} from "./libraryContent";
import type { LibraryDoc, LibraryCorpusStats } from "./libraryContent";
import styles from "./Library.module.css";

/**
 * src/applets/Library/index.tsx — the rich Library demo (FWK-03 tier-1).
 * Ported from
 * `design-sync-setup-guide/design_handoff_bespoke_rails_shell/library.js`
 * as ordinary JSX (04-04-PLAN.md Task 1), replacing the Plan-02 templated
 * shell. Faithful port: corpus Dashboard, Ingest view, Document detail, and
 * the promote/delete ConfirmFlow (Preview → Confirm → Undo) — all preserved,
 * non-destructive. Per CLAUDE.md's bundler adaptation: `import React from
 * "react"` normally (no CDN-hosted React import, no `h(...)`-style
 * element-creation calls), and the source's bottom-of-file mount-into-element
 * helper is dropped entirely — this module exports `manifest` + `App`.
 *
 * The handoff's `onReview` calls `ctx.open && ctx.open('Wiki')` — this is
 * the plan's live proof of the FWK-04 `host.open` seam, wired here as
 * `host.open('Wiki')`.
 *
 * The handoff reads `store.getState().activeCorpus` and
 * `store.getState().selection.Library` for the active corpus and selected
 * document. Applets touch the shell ONLY through the `host` seam (CLAUDE.md
 * / FWK-04 — no shellStore import here, CR-01): both the active corpus and
 * the selected document are component-local `useState`, matching 04-03's
 * Wiki entity-picker precedent, defaulted to the fullest demo corpus
 * (ficino). If a shell-driven corpus is ever genuinely needed, it threads
 * through the seam (e.g. a prop passed the way `host` is), never a direct
 * store subscription.
 *
 * Local color literals (T): amber/amberBg/warm/red have no counterpart in
 * src/styles/tokens.css and are NOT promoted there (04-CONTEXT.md Pitfall 4 /
 * 04-UI-SPEC.md "ported verbatim — do not re-theme"). The remaining T
 * entries mirror existing tokens.css values 1:1 (kept local, matching the
 * handoff's own inline `T` object shape), consistent with Wiki's port.
 */

const T = {
  bg: "#0A0A0B",
  panel: "#131418",
  panel2: "#0F1013",
  line: "#1E1F22",
  line2: "#26272B",
  text: "#E6E4DE",
  muted: "#A5A29A",
  faint: "#6E6C66",
  accent: "#86A38C",
  amber: "#D8C69C",
  amberBg: "#1E1C17",
  warm: "#B8A06E",
  red: "#B05A4E",
};
const MONO = "var(--font-mono)";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";

type LibraryView = "dashboard" | "ingest" | "document";
type ConfirmKind = "promote" | "delete";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// ---- shared bits ----
function TrustChip({ t, big }: { t: "curated" | "library"; big?: boolean }) {
  const curated = t === "curated";
  return (
    <span
      title={curated ? "Human-verified" : "Machine-ingested"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: MONO,
        fontSize: big ? 10 : 9,
        letterSpacing: "0.1em",
        color: curated ? T.accent : T.faint,
        border: "1px solid " + (curated ? T.accent : T.line2),
        padding: big ? "3px 9px" : "2px 7px",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          background: curated ? T.accent : "transparent",
          border: curated ? "none" : "1.5px solid " + T.faint,
          transform: "rotate(45deg)",
        }}
      />
      {curated ? "CURATED" : "LIBRARY"}
    </span>
  );
}

function StatusChip({ st }: { st: "ok" | "proc" | "fail" }) {
  const map: Record<string, [string, string]> = {
    ok: [T.accent, "PROCESSED"],
    proc: [T.amber, "PROCESSING"],
    fail: [T.red, "FAILED"],
  };
  const [c, label] = map[st] || [T.faint, "UNKNOWN"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.1em",
        color: c,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: st === "fail" ? "transparent" : c,
          border: st === "fail" ? "1.5px solid " + c : "none",
          animation: st === "proc" ? "cv-pulse 1.6s ease-in-out infinite" : "none",
        }}
      />
      {label}
    </span>
  );
}

function Wire({ f }: { f: "WIRED" | "NOT WIRED" | "FUTURE" }) {
  const map: Record<string, [string, string]> = {
    WIRED: [T.accent, T.line2],
    "NOT WIRED": [T.warm, T.warm],
    FUTURE: [T.faint, T.line2],
  };
  const entry = map[f];
  const c = entry ? entry[0] : T.faint;
  return (
    <span
      title={
        f === "WIRED" ? "Backend exists — live" : f === "NOT WIRED" ? "Backend planned — UI designed ahead" : "Later milestone"
      }
      style={{
        fontFamily: MONO,
        fontSize: 8.5,
        letterSpacing: "0.12em",
        color: c,
        border: "1px solid " + (entry ? entry[1] : T.line2),
        padding: "1px 6px",
      }}
    >
      {f}
    </span>
  );
}

function btnS(primary: boolean, danger?: boolean): React.CSSProperties {
  return {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: "0.06em",
    color: primary ? "#0A0A0B" : danger ? T.red : T.muted,
    background: primary ? T.accent : "transparent",
    border: primary ? "none" : "1px solid " + (danger ? T.red : T.line2),
    padding: "7px 13px",
    cursor: "pointer",
  };
}

function Tab({
  label,
  on,
  onClick,
  badge,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  badge?: number | null;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "0 16px",
        height: 38,
        cursor: "pointer",
        color: on ? T.text : T.faint,
        borderBottom: "2px solid " + (on ? T.accent : "transparent"),
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.08em",
      }}
    >
      {label}
      {badge != null ? (
        <span style={{ fontFamily: MONO, fontSize: 9, color: T.amber, background: T.amberBg, padding: "1px 6px" }}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function Stat({ n, label, accent }: { n: string; label: string; accent?: string }) {
  return (
    <div style={{ padding: "16px 18px", background: T.panel, border: "1px solid " + T.line2 }}>
      <div style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, color: accent || T.text }}>{n}</div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: T.faint, marginTop: 7 }}>
        {label}
      </div>
    </div>
  );
}

// ---- Dashboard view ----
function Dashboard({
  corpusName,
  corpusTier,
  stats,
  onReview,
  onIngest,
}: {
  corpusName: string;
  corpusTier: string;
  stats: LibraryCorpusStats;
  onReview: () => void;
  onIngest: () => void;
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: T.faint }}>CORPUS DASHBOARD</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0 4px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1.1 }}>
          {corpusName}
        </h1>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: "0.12em",
            color: T.faint,
            border: "1px solid " + T.line2,
            padding: "2px 8px",
          }}
        >
          {corpusTier.toUpperCase()} TIER
        </span>
        <Wire f="WIRED" />
      </div>
      <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6, maxWidth: 620, marginBottom: 20 }}>
        Everything ingested into this corpus, with counts, pipeline activity, and what needs your attention.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: T.line,
          border: "1px solid " + T.line2,
          marginBottom: 20,
        }}
      >
        <Stat n={fmt(stats.docs)} label="DOCUMENTS" />
        <Stat n={fmt(stats.entities)} label="ENTITIES" />
        <Stat n={fmt(stats.claims)} label="CLAIMS" />
        <Stat n={fmt(stats.curated)} label="CURATED" accent={T.accent} />
      </div>

      {stats.contradictions > 0 ? (
        <div
          onClick={onReview}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            background: T.amberBg,
            boxShadow: "inset 3px 0 0 " + T.amber,
            cursor: "pointer",
            marginBottom: 22,
          }}
        >
          <span style={{ fontFamily: SERIF, fontSize: 30, color: T.amber, lineHeight: 1 }}>{stats.contradictions}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: T.text }}>
              {"contradiction" + (stats.contradictions === 1 ? "" : "s") + " need review"}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: T.amber, marginTop: 2 }}>
              SOURCES DISAGREE — OPEN THE REVIEW QUEUE →
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "14px 18px", border: "1px solid " + T.line2, marginBottom: 22, fontSize: 13, color: T.muted }}>
          <span style={{ color: T.accent, marginRight: 8 }}>✓</span>
          No open contradictions — this corpus currently agrees with itself.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted, marginBottom: 6 }}>
            RECENT ACTIVITY
          </div>
          {RECENT.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 54px 1fr",
                gap: 12,
                alignItems: "center",
                padding: "9px 0",
                borderBottom: "1px solid " + T.line,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10, color: T.faint }}>{r[0]}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: r[1] === "You" ? T.accent : T.muted }}>{r[1]}</span>
              <span style={{ fontSize: 12.5, color: r[3] === "fail" ? T.red : T.text }}>{r[2]}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted, marginBottom: 6 }}>
            PIPELINE
          </div>
          <div style={{ border: "1px solid " + T.line2, padding: "14px" }}>
            <div style={{ marginBottom: 10 }}>
              <StatusChip st="proc" />
            </div>
            <div style={{ fontSize: 12.5, color: T.text }}>Prato account book 1462</div>
            <div style={{ height: 4, background: T.line, marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: "41%", height: "100%", background: T.amber }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 6 }}>OCR · 41% · ~3 min left</div>
            <button onClick={onIngest} style={{ ...btnS(false), marginTop: 12, width: "100%" }}>
              OPEN INGEST →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Ingest view ----
function Ingest({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const [over, setOver] = useState(false);
  const dz = (label: string, sub: string) => (
    <div key={label} style={{ flex: 1, border: "1px solid " + T.line2, padding: "14px", cursor: "pointer", background: T.panel }}>
      <div style={{ fontSize: 13, color: T.text }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 4 }}>{sub}</div>
    </div>
  );
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: T.faint }}>INGEST</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 16px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: T.text, margin: 0 }}>Add documents</h1>
        <Wire f="WIRED" />
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
        }}
        style={{
          border: "1.5px dashed " + (over ? T.accent : T.line2),
          background: over ? "rgba(134,163,140,0.06)" : T.panel2,
          padding: "34px",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 22, color: over ? T.accent : T.faint }}>⬇</div>
        <div style={{ fontSize: 14, color: T.text, marginTop: 8 }}>Drop PDFs, text, or a folder here</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 4 }}>
          drag-drop anywhere in the window · re-read like new docs — conflicts resurface for review
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {dz("⤒  Upload files", "choose from disk")}
        {dz("¶  Paste text", "a note or transcript")}
        {dz("▤  Scan folder", "watch a directory")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted }}>PIPELINE QUEUE</span>
        <span style={{ flex: 1 }} />
        <button style={btnS(false)} title="Cancel the running pipeline">
          CANCEL PIPELINE
        </button>
      </div>
      {INGEST_QUEUE.map((q) => (
        <div
          key={q.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 14,
            alignItems: "center",
            padding: "11px 14px",
            border: "1px solid " + T.line,
            marginBottom: 8,
            background: T.panel,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                onClick={() => q.id.startsWith("doc") && onOpenDoc(q.id)}
                style={{ fontSize: 13, color: T.text, cursor: q.id.startsWith("doc") ? "pointer" : "default" }}
              >
                {q.label}
              </span>
              <StatusChip st={q.st === "queue" ? "proc" : q.st} />
            </div>
            {q.st === "proc" ? (
              <div style={{ height: 3, background: T.line, marginTop: 8, maxWidth: 320 }}>
                <div style={{ width: q.pct + "%", height: "100%", background: T.amber }} />
              </div>
            ) : null}
            <div style={{ fontFamily: MONO, fontSize: 10, color: q.st === "fail" ? T.red : T.faint, marginTop: 6 }}>
              {q.note}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {q.st === "fail" ? <button style={btnS(true)}>RETRY</button> : null}
            <button style={btnS(false, true)} title="Delete (guarded)">
              DELETE
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Document detail view ----
function DocDetail({
  doc,
  onPromote,
  onDelete,
}: {
  doc: LibraryDoc | null;
  onPromote: () => void;
  onDelete: () => void;
}) {
  if (!doc) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.faint, fontSize: 13 }}>
        Select a document in the rail to see its detail.
      </div>
    );
  }
  const meta: [string, string | number][] = [
    ["Author", doc.author],
    ["Type", doc.kind],
    ["Added", doc.added],
    ["Size", doc.size],
    ["Pages", doc.pages || "—"],
    ["Chunks", doc.chunks || "—"],
    ["Entities", doc.entities || "—"],
    ["Claims", doc.claims || "—"],
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: T.faint }}>DOCUMENT</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0 4px", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1.15 }}>
          {doc.title}
        </h1>
        <TrustChip t={doc.trust} big />
        <StatusChip st={doc.status} />
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: doc.status === "fail" ? T.red : T.muted,
          lineHeight: 1.6,
          maxWidth: 640,
          margin: "8px 0 20px",
        }}
      >
        {doc.note}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: T.line,
          border: "1px solid " + T.line2,
          marginBottom: 22,
        }}
      >
        {meta.map((m, i) => (
          <div key={i} style={{ padding: "11px 14px", background: T.panel }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: T.faint }}>
              {m[0].toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: T.text, marginTop: 4 }}>{String(m[1])}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid " + T.line2, padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted }}>TRUST FLAG</span>
          <Wire f="NOT WIRED" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>
            {doc.trust === "curated"
              ? "Human-verified. Claims from this document carry human authority and win over machine-ingested values."
              : "Machine-ingested (default). Promote to curated once you have verified this source by hand."}
          </div>
          {doc.trust === "curated" ? (
            <TrustChip t="curated" big />
          ) : (
            <button
              onClick={onPromote}
              disabled={doc.status !== "ok"}
              style={{
                ...btnS(true),
                opacity: doc.status === "ok" ? 1 : 0.4,
                cursor: doc.status === "ok" ? "pointer" : "default",
              }}
            >
              ↑ PROMOTE TO CURATED
            </button>
          )}
        </div>
      </div>

      {doc.chunks ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted, marginBottom: 6 }}>
            CHUNKS · {doc.chunks} total
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "54px 1fr",
                gap: 12,
                padding: "9px 0",
                borderBottom: "1px solid " + T.line,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10, color: T.faint }}>{"#" + String(i + 1).padStart(3, "0")}</span>
              <span
                style={{
                  fontSize: 12.5,
                  color: T.muted,
                  lineHeight: 1.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {CHUNK_PREVIEW[i]}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          border: "1px solid " + T.line,
          marginTop: 4,
        }}
      >
        <div style={{ flex: 1, fontFamily: MONO, fontSize: 10.5, color: T.faint, lineHeight: 1.5 }}>
          Delete removes this document and its extracted claims. Guarded — you’ll confirm the consequences.
        </div>
        <button onClick={onDelete} style={btnS(false, true)}>
          DELETE DOCUMENT
        </button>
      </div>
    </div>
  );
}

// ---- write-safety modal (promote / delete: Preview → Confirm → Undo) ----
function ConfirmFlow({
  kind,
  doc,
  onDone,
}: {
  kind: ConfirmKind;
  doc: LibraryDoc;
  onDone: (committed: boolean) => void;
}) {
  const [applied, setApplied] = useState(false);
  const wrap = (kids: React.ReactNode) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div style={{ width: 500, maxWidth: "90%", background: T.panel, border: "1px solid " + T.line2, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        {kids}
      </div>
    </div>
  );
  const head = (label: string) => (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid " + T.line, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted }}>
      {label}
    </div>
  );
  const promote = kind === "promote";

  if (applied) {
    return wrap(
      <>
        {head((promote ? "PROMOTED" : "DELETED") + " ✓")}
        <div style={{ padding: 16, fontSize: 13, color: T.text, lineHeight: 1.55 }}>
          {promote ? (
            <>
              "{doc.title}" is now <b style={{ color: T.accent }}>curated</b>. Its claims carry human authority.
            </>
          ) : (
            <>
              "{doc.title}" and its {doc.claims || 0} claims were removed from the corpus.
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid " + T.line }}>
          <span
            onClick={() => onDone(false)}
            style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: T.amber, cursor: "pointer" }}
          >
            ↩ UNDO / REVERT
          </span>
          <button onClick={() => onDone(true)} style={btnS(true)}>
            DONE
          </button>
        </div>
      </>
    );
  }

  return wrap(
    <>
      {head(promote ? "PROMOTE TO CURATED" : "DELETE DOCUMENT")}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>
          {promote ? (
            <>
              Mark <b>"{doc.title}"</b> as human-verified. Its{" "}
              <b style={{ color: T.accent }}>{(doc.claims || 0) + " claims"}</b> will win over machine-ingested values
              in every article.
            </>
          ) : (
            <>
              This permanently removes <b>"{doc.title}"</b> and its{" "}
              <b style={{ color: T.red }}>{(doc.claims || 0) + " extracted claims"}</b>. Articles that cited it will
              recompose. This can be undone right after.
            </>
          )}
        </div>
        {promote ? (
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 10 }}>
            Your action carries human authority.
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderTop: "1px solid " + T.line }}>
        <button onClick={() => onDone(false)} style={btnS(false)}>
          CANCEL
        </button>
        <button onClick={() => setApplied(true)} style={btnS(true, false)}>
          {promote ? "PROMOTE" : "DELETE"}
        </button>
      </div>
    </>
  );
}

function Library({ host }: { host: Host }) {
  const [view, setView] = useState<LibraryView>("dashboard");
  const [sel, setSel] = useState<string | null>("doc-ficino-vita");
  const [flow, setFlow] = useState<{ kind: ConfirmKind; doc: LibraryDoc } | null>(null);
  const [promoted, setPromoted] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // CR-01: component-local corpus selection (04-03 Wiki entity-picker
  // precedent) — applets never subscribe to the shell store; the `host` seam
  // is the only shell surface. Defaults to the fullest demo corpus (ficino,
  // matching store.js's own `activeCorpus || 'ficino'` default).
  const [corpusId] = useState(CORPORA[0].id);

  // WR-05: single tracked toast timer — a new toast clears the previous
  // timer (two rapid toasts no longer cut the second one short), and unmount
  // clears the pending timer (no leaked callback into a disposed root).
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => {
    if (toastTimer.current != null) clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  useEffect(
    () => () => {
      if (toastTimer.current != null) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Defensive fallback (same discipline the original library.js Dashboard
  // used: `corpora.find(...) || {...}`) — guards a corpusId that doesn't
  // match a demo corpus id so the dashboard never renders undefined stats.
  const corpus = CORPORA.find((c) => c.id === corpusId) || CORPORA[0];
  const stats = CORPUS_STATS[corpusId] || CORPUS_STATS[CORPORA[0].id];
  const baseDoc = sel ? DOCS[sel] : null;
  const doc: LibraryDoc | null = baseDoc ? { ...baseDoc, trust: promoted[sel as string] ? "curated" : baseDoc.trust } : null;

  const header = (
    <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid " + T.line, background: T.panel2, flexShrink: 0 }}>
      <Tab label="DASHBOARD" on={view === "dashboard"} onClick={() => setView("dashboard")} />
      <Tab label="INGEST" on={view === "ingest"} onClick={() => setView("ingest")} badge={1} />
      <Tab label="DOCUMENT" on={view === "document"} onClick={() => setView("document")} />
      <div style={{ flex: 1 }} />
      <div
        title="Portable interchange — export/import corpus"
        style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 14 }}
      >
        <span
          onClick={() => flash("Exported corpus to folder (OKF).")}
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: "0.08em",
            color: T.muted,
            cursor: "pointer",
            border: "1px solid " + T.line2,
            padding: "4px 9px",
          }}
        >
          OKF EXPORT
        </span>
        <span
          onClick={() => flash("Imports are re-read like new documents — conflicts will resurface for review.")}
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: "0.08em",
            color: T.muted,
            cursor: "pointer",
            border: "1px solid " + T.line2,
            padding: "4px 9px",
          }}
        >
          IMPORT
        </span>
      </div>
      <div className={styles.demoChip}>DEMO</div>
    </div>
  );

  let body: React.ReactNode;
  if (view === "dashboard") {
    body = (
      <Dashboard
        corpusName={corpus.name}
        corpusTier={corpus.tier}
        stats={stats}
        onReview={() => host.open("Wiki")}
        onIngest={() => setView("ingest")}
      />
    );
  } else if (view === "ingest") {
    body = (
      <Ingest
        onOpenDoc={(id) => {
          setSel(id);
          setView("document");
        }}
      />
    );
  } else {
    body = (
      <DocDetail
        doc={doc}
        onPromote={() => doc && setFlow({ kind: "promote", doc })}
        onDelete={() => doc && setFlow({ kind: "delete", doc })}
      />
    );
  }

  return (
    <div
      className={styles.host}
      style={{ display: "flex", flexDirection: "column", background: T.bg, color: T.text, fontFamily: SANS, position: "relative" }}
    >
      {header}
      {body}
      {flow ? (
        <ConfirmFlow
          kind={flow.kind}
          doc={flow.doc}
          onDone={(committed) => {
            if (committed && flow.kind === "promote" && sel) {
              setPromoted((p) => ({ ...p, [sel]: true }));
              flash("Promoted to curated · undo available");
            } else if (committed && flow.kind === "delete") {
              flash("Document deleted · undo available");
            }
            setFlow(null);
          }}
        />
      ) : null}
      {toast ? (
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            background: T.panel,
            border: "1px solid " + T.line2,
            boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
            padding: "10px 16px",
            fontSize: 12.5,
            color: T.text,
            zIndex: 60,
            maxWidth: 460,
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

const def = appletDefs.Library;

export const manifest: AppletManifest = {
  key: "Library",
  glyph: def.glyph,
  code: def.code,
  title: def.title,
  desc: def.line,
};

export const App: AppletModule["App"] = ({ host }) => <Library host={host} />;
