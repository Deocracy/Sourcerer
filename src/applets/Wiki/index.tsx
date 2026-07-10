import React, { useState } from "react";
import type { AppletManifest, AppletModule } from "../../host/types";
import { appletDefs } from "../../shell/appletDefs";
import { ARTICLES, FALLBACK, REVIEW } from "./wikiContent";
import type { WikiArticle, WikiClaim, WikiReviewItem, WikiUnresolved } from "./wikiContent";
import styles from "./Wiki.module.css";

/**
 * src/applets/Wiki/index.tsx — the rich Wiki demo (FWK-03 tier-1, "the
 * moat"). Ported from
 * `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/wiki.js`
 * as ordinary JSX (04-03-PLAN.md Task 1), replacing the Plan-02 templated
 * shell. Faithful port: article view, provenance inspector, the first-class
 * Unresolved block, the edit → dry-run preview → apply → undo flow, review
 * queue and history tabs — all preserved. Per CLAUDE.md's bundler
 * adaptation: `import React from "react"` normally (no CDN-hosted React
 * import, no `h(...)`-style element-creation calls), and the source's
 * bottom-of-file mount function is dropped entirely — dockview + PanelBody
 * own mounting, this module exports `manifest` + `App`.
 *
 * The handoff reads `store.getState().selection.Wiki` for the open entity;
 * this repo's shellStore has no `selection` slice (04-03-PLAN.md discretion:
 * "a dedicated shell selection store is not required this phase"), so the
 * selected entity is component-local state, defaulted to "ficino" and
 * switchable via a small inline entity picker (Rule 2 addition — without it
 * the Alberti Unresolved block, a must_haves truth, would be unreachable in
 * this phase since no rail wiring drives Wiki's selection yet).
 *
 * Local color literals (T): amber/amberBg/warm/red have no counterpart in
 * src/styles/tokens.css and are NOT promoted there (04-CONTEXT.md Pitfall 4 /
 * 04-UI-SPEC.md "ported verbatim — do not re-theme"). The remaining T
 * entries mirror existing tokens.css values 1:1 (kept local, matching the
 * handoff's own inline `T` object shape) rather than reading host.theme,
 * since this module renders standalone without relying on the host seam for
 * decoration (host.ai is unused by this demo, per 04-CONTEXT.md D-05 scope).
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

type EditFlowStage = "edit" | "preview" | "applied";

// ---- trust flag chip (consistent visual identity across applets) ----
function TrustChip({ t }: { t: "curated" | "library" }) {
  const curated = t === "curated";
  return (
    <span
      title={curated ? "Human-verified" : "Machine-ingested"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.1em",
        color: curated ? T.accent : T.faint,
        border: "1px solid " + (curated ? T.accent : T.line2),
        padding: "2px 7px",
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

function DocRow({ d, dim }: { d: [string, string, string]; dim?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 8,
        padding: "8px 0",
        borderBottom: "1px solid " + T.line,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: dim ? T.muted : T.text, overflow: "hidden", textOverflow: "ellipsis" }}>
          {d[0]}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: T.faint, marginTop: 2 }}>
          {d[1]} · {d[2]}
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: T.accent, alignSelf: "center", cursor: "pointer" }}>
        open →
      </span>
    </div>
  );
}

// ---- provenance inspector (right panel) ----
function Provenance({ claim, onClose }: { claim: WikiClaim | null; onClose: () => void }) {
  if (!claim) {
    return (
      <div style={{ padding: "18px 16px", color: T.faint, fontSize: 12.5, lineHeight: 1.6 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: T.muted, marginBottom: 10 }}>
          PROVENANCE
        </div>
        Select any claim to see its receipts — which document, which passage, and why its value won.
      </div>
    );
  }
  const p = claim.prov;
  const whyLabel =
    ({
      trust: "TRUST > provenance > recency",
      provenance: "PROVENANCE > recency",
      recency: "RECENCY (most recent source)",
    } as Record<string, string>)[p.won] || p.won.toUpperCase();
  return (
    <div style={{ padding: "18px 16px", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <span style={{ flex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: T.muted }}>
          PROVENANCE
        </span>
        <span onClick={onClose} style={{ cursor: "pointer", color: T.faint, fontFamily: MONO }}>
          ×
        </span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint }}>{claim.attr.toUpperCase()}</div>
      <div style={{ fontFamily: SERIF, fontSize: 17, color: T.text, lineHeight: 1.25, margin: "3px 0 12px" }}>
        {claim.val}
      </div>
      <div style={{ marginBottom: 14 }}>
        <TrustChip t={claim.trust} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: T.faint }}>WHY THIS VALUE WON</div>
      <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55, margin: "4px 0 6px" }}>{p.why}</div>
      <div
        style={{
          display: "inline-block",
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: "0.08em",
          color: T.accent,
          border: "1px solid " + T.line2,
          padding: "3px 8px",
          marginBottom: 16,
        }}
      >
        RULE · {whyLabel}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: T.faint, marginBottom: 2 }}>
        SOURCES ({p.docs.length})
      </div>
      {p.docs.map((d, i) => (
        <DocRow key={i} d={d} />
      ))}
      <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 10, color: T.faint, lineHeight: 1.5 }}>
        Propagates to {claim.copies} derived cop{claim.copies === 1 ? "y" : "ies"} across the corpus.
      </div>
    </div>
  );
}

// ---- claim row (with inline edit) ----
function Claim({
  c,
  selected,
  onSelect,
  onEdit,
}: {
  c: WikiClaim;
  selected: boolean;
  onSelect: (c: WikiClaim) => void;
  onEdit: (c: WikiClaim) => void;
}) {
  return (
    <div
      onClick={() => onSelect(c)}
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr auto",
        gap: 16,
        alignItems: "baseline",
        padding: "11px 14px",
        cursor: "pointer",
        background: selected ? T.panel : "transparent",
        borderLeft: "2px solid " + (selected ? T.accent : "transparent"),
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: T.faint }}>{c.attr}</div>
      <div style={{ fontSize: 14, color: T.text, lineHeight: 1.4 }}>{c.val}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          title={c.trust === "curated" ? "Curated" : "Library"}
          style={{
            width: 7,
            height: 7,
            background: c.trust === "curated" ? T.accent : "transparent",
            border: c.trust === "curated" ? "none" : "1.5px solid " + T.faint,
            transform: "rotate(45deg)",
          }}
        />
        <span
          onClick={(e) => {
            e.stopPropagation();
            onEdit(c);
          }}
          title="Edit → dry-run preview → apply"
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.08em",
            color: T.faint,
            cursor: "pointer",
            border: "1px solid " + T.line2,
            padding: "2px 7px",
          }}
        >
          EDIT
        </span>
      </div>
    </div>
  );
}

// ---- Unresolved block (HARD REQUIREMENT — first-class, never a fake answer) ----
function Unresolved({ u }: { u: WikiUnresolved }) {
  return (
    <div style={{ margin: "18px 0 8px", border: "1px solid " + T.warm, background: T.amberBg }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderBottom: "1px solid " + T.warm,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 11, color: T.warm }}>⚠</span>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.amber }}>
          UNRESOLVED · {u.attr.toUpperCase()}
        </span>
        <span style={{ flex: 1, textAlign: "right", fontFamily: MONO, fontSize: 9, color: T.warm }}>
          SOURCES DISAGREE
        </span>
      </div>
      <div style={{ padding: "8px 14px 4px", fontSize: 12, color: T.amber, fontStyle: "italic" }}>{u.note}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: T.warm,
          margin: "8px 14px 14px",
        }}
      >
        {u.candidates.map((cand, i) => (
          <div key={i} style={{ background: T.bg, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: SERIF, fontSize: 20, color: T.text }}>{cand.val}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: T.faint }}>conf {cand.conf.toFixed(2)}</span>
            </div>
            <div style={{ margin: "6px 0 8px" }}>
              <TrustChip t={cand.trust} />
            </div>
            {cand.docs.map((d, j) => (
              <div key={j} style={{ fontFamily: MONO, fontSize: 10, color: T.muted, padding: "2px 0" }}>
                · {d[0]} · {d[1]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- edit → dry-run → apply → undo modal ----
function EditFlow({ claim, onDone }: { claim: WikiClaim; onDone: (v: string | null) => void }) {
  const [stage, setStage] = useState<EditFlowStage>("edit");
  const [val, setVal] = useState(claim.val);
  const changed = val.trim() !== claim.val;

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
      <div style={{ width: 520, maxWidth: "90%", background: T.panel, border: "1px solid " + T.line2, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        {kids}
      </div>
    </div>
  );
  const head = (label: string) => (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid " + T.line, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted }}>
      {label}
    </div>
  );
  const btn = (label: string, onc: () => void, primary?: boolean, danger?: boolean) => (
    <button
      key={label}
      onClick={onc}
      disabled={primary && !changed}
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.08em",
        color: primary ? (changed ? "#0A0A0B" : T.faint) : danger ? T.amber : T.muted,
        background: primary ? (changed ? T.accent : T.line2) : "transparent",
        border: primary ? "none" : "1px solid " + T.line2,
        padding: "7px 14px",
        cursor: primary && !changed ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );

  if (stage === "edit") {
    return wrap(
      <>
        {head("EDIT CLAIM · " + claim.attr.toUpperCase())}
        <div style={{ padding: 16 }}>
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            rows={2}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: T.panel2,
              border: "1px solid " + T.line2,
              color: T.text,
              fontFamily: SERIF,
              fontSize: 15,
              padding: "10px 12px",
              resize: "vertical",
            }}
          />
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 8 }}>
            Your edit carries human authority — it will be applied as curated.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderTop: "1px solid " + T.line }}>
          {btn("CANCEL", () => onDone(null))}
          {btn("PREVIEW CHANGES →", () => setStage("preview"), true)}
        </div>
      </>
    );
  }

  if (stage === "preview") {
    return wrap(
      <>
        {head("DRY-RUN PREVIEW")}
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: T.text, marginBottom: 12 }}>
            This will update <b style={{ color: T.accent }}>{claim.copies} derived cop{claim.copies === 1 ? "y" : "ies"}</b> across
            the corpus.
          </div>
          <div style={{ border: "1px solid " + T.line2, fontFamily: SERIF, fontSize: 14 }}>
            <div style={{ padding: "8px 12px", background: "#1E1618", color: "#C99", borderBottom: "1px solid " + T.line }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: T.red, marginRight: 10 }}>−</span>
              {claim.val}
            </div>
            <div style={{ padding: "8px 12px", background: "#16201A", color: "#9C9" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: T.accent, marginRight: 10 }}>+</span>
              {val}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderTop: "1px solid " + T.line }}>
          {btn("← BACK", () => setStage("edit"))}
          {btn("APPLY", () => setStage("applied"), true)}
        </div>
      </>
    );
  }

  return wrap(
    <>
      {head("APPLIED ✓")}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: T.text }}>
          Claim updated and propagated to {claim.copies} cop{claim.copies === 1 ? "y" : "ies"}.
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 15, color: T.accent, marginTop: 8 }}>{val}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid " + T.line }}>
        <span onClick={() => onDone(null)} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: T.amber, cursor: "pointer" }}>
          ↩ UNDO / REVERT
        </span>
        {btn("DONE", () => onDone(val), true)}
      </div>
    </>
  );
}

function Tab({ label, on, onClick, badge }: { label: string; on: boolean; onClick: () => void; badge?: number | null }) {
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
        <span style={{ fontFamily: MONO, fontSize: 9, color: T.amber, background: T.amberBg, padding: "1px 6px" }}>{badge}</span>
      ) : null}
    </div>
  );
}

function btnS(primary: boolean): React.CSSProperties {
  return {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: "0.06em",
    color: primary ? "#0A0A0B" : T.muted,
    background: primary ? T.accent : "transparent",
    border: primary ? "none" : "1px solid " + T.line2,
    padding: "6px 11px",
    cursor: "pointer",
  };
}

type ReviewResolution = "winner" | "both" | "dismiss";

function Wiki() {
  const [view, setView] = useState<"article" | "review" | "history">("article");
  const [entity, setEntity] = useState<string>("ficino");
  const [selClaim, setSelClaim] = useState<WikiClaim | null>(null);
  const [edit, setEdit] = useState<WikiClaim | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [review, setReview] = useState<WikiReviewItem[]>(REVIEW);
  const [toast, setToast] = useState<string | null>(null);

  const art: WikiArticle = ARTICLES[entity] ?? FALLBACK(entity);
  const valOf = (c: WikiClaim) => edited[c.id] ?? c.val;

  const resolve = (id: string, how: ReviewResolution) => {
    setReview((r) => r.filter((x) => x.id !== id));
    setToast(
      how === "both"
        ? "Kept both — genuine dispute recorded."
        : how === "dismiss"
        ? "Dismissed."
        : "Winner chosen — article recomposed."
    );
    setTimeout(() => setToast(null), 2600);
  };

  const selectEntity = (key: string) => {
    setEntity(key);
    setView("article");
    setSelClaim(null);
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid " + T.line, background: T.panel2, flexShrink: 0 }}>
      <Tab label="ARTICLE" on={view === "article"} onClick={() => setView("article")} />
      <Tab label="REVIEW QUEUE" on={view === "review"} onClick={() => setView("review")} badge={review.length || null} />
      <Tab label="HISTORY" on={view === "history"} onClick={() => setView("history")} />
      <div style={{ flex: 1 }} />
      <div className={styles.demoChip}>DEMO</div>
    </div>
  );

  // Entity picker — component-local since this repo's shellStore has no
  // `selection` slice yet (04-03-PLAN.md discretion); keeps the Alberti
  // Unresolved block reachable without a rail-driven selection this phase.
  const entityPicker = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        height: 30,
        borderBottom: "1px solid " + T.line,
        background: T.panel2,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: T.faint }}>ENTITY</span>
      {Object.keys(ARTICLES).map((key) => (
        <span
          key={key}
          onClick={() => selectEntity(key)}
          style={{
            cursor: "pointer",
            padding: "2px 8px",
            border: "1px solid " + (entity === key ? T.accent : T.line2),
            color: entity === key ? T.text : T.faint,
            fontFamily: MONO,
            fontSize: 10,
          }}
        >
          {ARTICLES[key].title}
        </span>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (view === "article") {
    body = (
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: selClaim ? "1fr 300px" : "1fr", minHeight: 0 }}>
        <div style={{ overflowY: "auto", padding: "28px 32px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: T.faint }}>{art.kind}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0 4px" }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1.1 }}>
              {art.title}
            </h1>
            <TrustChip t={art.trust} />
          </div>
          <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.6, maxWidth: 620, marginBottom: 10 }}>{art.lede}</div>
          {art.unresolved ? <Unresolved u={art.unresolved} /> : null}
          {art.sections.map((sec, i) => (
            <div key={i} style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted }}>
                  {sec.g.toUpperCase()}
                </span>
                <span style={{ flex: 1, height: 1, background: "linear-gradient(to right," + T.line2 + "," + T.line + ")" }} />
              </div>
              {sec.claims.map((c) => (
                <Claim
                  key={c.id}
                  c={{ ...c, val: valOf(c) }}
                  selected={!!selClaim && selClaim.id === c.id}
                  onSelect={setSelClaim}
                  onEdit={setEdit}
                />
              ))}
            </div>
          ))}
          {art.sections.length === 0 && !art.unresolved ? (
            <div style={{ marginTop: 20, fontFamily: MONO, fontSize: 11, color: T.faint }}>No claims composed yet.</div>
          ) : null}
        </div>
        {selClaim ? (
          <div style={{ borderLeft: "1px solid " + T.line, background: T.panel2, minHeight: 0 }}>
            <Provenance claim={{ ...selClaim, val: valOf(selClaim) }} onClose={() => setSelClaim(null)} />
          </div>
        ) : null}
      </div>
    );
  } else if (view === "review") {
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {review.length === 0 ? (
          <div style={{ maxWidth: 460, margin: "40px auto 0", textAlign: "center", color: T.muted, lineHeight: 1.6 }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: T.text }}>No open contradictions</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Your corpus currently agrees with itself.</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 10, lineHeight: 1.6 }}>
              Surfaced ≠ guaranteed-none. <a href="#" style={{ color: T.accent }}>Trust &amp; limitations</a>
            </div>
          </div>
        ) : (
          review.map((rq) => (
            <div key={rq.id} style={{ border: "1px solid " + T.line2, marginBottom: 12, background: T.panel }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + T.line }}>
                <span style={{ fontFamily: SERIF, fontSize: 15, color: T.text }}>{rq.entity}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: T.faint }}>
                  · {rq.attr.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.line }}>
                {[rq.a, rq.b].map((s, i) => (
                  <div key={i} style={{ background: T.bg, padding: "11px 14px" }}>
                    <div style={{ fontFamily: SERIF, fontSize: 18, color: T.text }}>{s[0]}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: T.faint, marginTop: 3 }}>{s[1]}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid " + T.line }}>
                <button onClick={() => resolve(rq.id, "winner")} style={btnS(true)}>
                  CHOOSE {rq.a[0].toUpperCase()}
                </button>
                <button onClick={() => resolve(rq.id, "winner")} style={btnS(true)}>
                  CHOOSE {rq.b[0].toUpperCase()}
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={() => resolve(rq.id, "both")} style={btnS(false)}>
                  KEEP BOTH
                </button>
                <button onClick={() => resolve(rq.id, "dismiss")} style={btnS(false)}>
                  DISMISS
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: T.muted, marginBottom: 14 }}>
          VERSION HISTORY · {art.title.toUpperCase()}
        </div>
        {[
          ["just now", "You", "Curated edit — Plato translation date"],
          ["2h ago", "Ingest", "+3 claims from Prato ledger"],
          ["yesterday", "You", 'Merged "Marsilio F." into this entity'],
          ["3d ago", "Ingest", "Entity created from 4 sources"],
        ].map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 60px 1fr auto",
              gap: 12,
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid " + T.line,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10, color: T.faint }}>{r[0]}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: r[1] === "You" ? T.accent : T.muted }}>{r[1]}</span>
            <span style={{ fontSize: 13, color: T.text }}>{r[2]}</span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: T.faint,
                cursor: "pointer",
                border: "1px solid " + T.line2,
                padding: "2px 8px",
              }}
            >
              REVERT
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={styles.host}
      style={{ display: "flex", flexDirection: "column", background: T.bg, color: T.text, fontFamily: SANS, position: "relative" }}
    >
      {header}
      {entityPicker}
      {body}
      {edit ? (
        <EditFlow
          claim={{ ...edit, val: valOf(edit) }}
          onDone={(v) => {
            if (v != null) {
              setEdited((e) => ({ ...e, [edit.id]: v }));
              setToast("Claim applied · undo available");
              setTimeout(() => setToast(null), 2600);
            }
            setEdit(null);
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
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

const def = appletDefs.Wiki;

export const manifest: AppletManifest = {
  key: "Wiki",
  glyph: def.glyph,
  code: def.code,
  title: def.title,
  desc: def.line,
};

export const App: AppletModule["App"] = () => <Wiki />;
