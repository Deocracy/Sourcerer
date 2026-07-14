import { useState, type CSSProperties, type ReactNode, type Ref } from "react";
import type { CardDef, CardMark, SectionKey } from "./cardDefs";
import { cardDefs } from "./cardDefs";

/*
 * HomeCard.tsx — ported near-verbatim from the design handoff's
 * `home-cards.js` (`markEl`, `shim`, `CardBody`, `CardFrame`), converting
 * every `h(tag, props, kids)` call to JSX. Every ~18 `t.variant` branch is
 * preserved, including the interactive local-state ones (stack cycle,
 * action resolve/dismiss, audit checkboxes). Literal hex/px values kept
 * verbatim per the pixel-perfect fidelity constraint.
 *
 * This plan (06-05) renders a STATIC, non-draggable card: `HomeCard`
 * replaces the reference's `SortableCard` minus its sortable-drag hook
 * wiring — drag lands in Plan 06-06.
 */

const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'IBM Plex Serif', serif";

function markEl(m: CardMark | undefined): ReactNode {
  if (m === "curated") {
    return <span style={{ width: 7, height: 7, background: "#86A38C", transform: "rotate(45deg)", flexShrink: 0 }} />;
  }
  if (m === "doc") {
    return <span style={{ width: 7, height: 7, border: "1.5px solid #6E6C66", borderRadius: "50%", flexShrink: 0 }} />;
  }
  if (m === "live") {
    return (
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#86A38C",
          animation: "cv-pulse 1.6s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
    );
  }
  if (m === "inferred") {
    return <span style={{ width: 7, height: 7, border: "1.5px solid #B8A06E", transform: "rotate(45deg)", flexShrink: 0 }} />;
  }
  return null;
}

function shim(w: number | string, h: number): CSSProperties {
  return {
    width: w,
    height: h,
    background: "linear-gradient(90deg,#1E1F22 25%,#2A2B2F 50%,#1E1F22 75%)",
    backgroundSize: "200px 100%",
    animation: "cv-shimmer 1.4s linear infinite",
  };
}

export interface CardBodyResult {
  kids: ReactNode[];
  barColor: string | null;
  bgOverride: string | null;
  onClickExtra: (() => void) | null;
}

// eslint-disable-next-line react-hooks/rules-of-hooks -- CardBody is a
// hook-using render helper called from HomeCard's render body, mirroring the
// reference's own CardBody({t}) shape (home-cards.js line 77).
export function CardBody({ t }: { t: CardDef | undefined }): CardBodyResult {
  const [stackIndex, setStackIndex] = useState(0);
  const [actionState, setActionState] = useState<"open" | "resolved" | "dismissed">("open");
  const [checks, setChecks] = useState<Record<string, boolean>>({ villa: true, vasari: false });

  // WR-05: callers (SortableCard/OverlayCard/HomeCard) must call CardBody
  // BEFORE their own `if (!t) return null` guard so the useState hooks above
  // run unconditionally (hook-ordering). That means an unknown id reaches
  // this line with t === undefined — degrade to an empty body instead of
  // throwing on `t.dim` and making the callers' null guards dead code.
  if (!t) {
    return { kids: [], barColor: null, bgOverride: null, onClickExtra: null };
  }

  const inkMain = t.dim ? "#4A4B4F" : "#E6E4DE";
  const inkSub = t.dim ? "#4A4B4F" : t.bar ? "#D8C69C" : "#A5A29A";

  const kindRow = (
    <div key="k" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span
        key="l"
        style={{
          fontFamily: MONO,
          fontSize: 8,
          letterSpacing: "0.14em",
          color: inkSub,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {t.kind}
      </span>
      {markEl(t.mark)}
    </div>
  );

  const footEl = (c?: string | null) => (
    <div
      key="f"
      style={{
        fontFamily: MONO,
        fontSize: 10,
        color: c || inkSub,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {t.foot}
    </div>
  );

  const titleEl = (extra?: CSSProperties) => (
    <div
      key="t"
      style={{
        fontFamily: SERIF,
        fontSize: 15,
        lineHeight: 1.15,
        marginTop: 2,
        flex: 1,
        fontStyle: t.italic ? "italic" : "normal",
        color: inkMain,
        ...(extra || {}),
      }}
    >
      {t.title}
    </div>
  );

  let kids: ReactNode[];
  let barColor: string | null = t.bar ? "#B8A06E" : null;
  let bgOverride: string | null = null;
  let onClickExtra: (() => void) | null = null;

  if (t.variant === "metric") {
    kids = [
      kindRow,
      <div key="b" style={{ fontFamily: SERIF, fontSize: 26, color: inkMain, flex: 1, marginTop: 2 }}>
        {t.big}
      </div>,
      footEl(t.footColor),
    ];
  } else if (t.variant === "spark") {
    kids = [
      kindRow,
      titleEl({ flex: "none" }),
      <svg
        key="sv"
        viewBox="0 0 180 28"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 24, display: "block", flex: 1 }}
      >
        <polyline
          points="0,24 22,20 44,22 66,15 88,18 110,10 132,13 154,5 180,2"
          fill="none"
          stroke="#86A38C"
          strokeWidth={1.5}
        />
      </svg>,
      footEl(),
    ];
  } else if (t.variant === "progress") {
    kids = [
      kindRow,
      <div key="b" style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, marginTop: 2 }}>
        <span key="n" style={{ fontFamily: SERIF, fontSize: 24, color: inkMain }}>
          {t.pct}%
        </span>
        <span key="m" style={{ fontFamily: MONO, fontSize: 10, color: inkSub }}>
          {t.title}
        </span>
      </div>,
      <div key="bar" style={{ height: 3, background: "#26272B", margin: "4px 0 6px" }}>
        <div style={{ height: "100%", width: `${t.pct}%`, background: "#86A38C" }} />
      </div>,
      footEl(),
    ];
  } else if (t.variant === "excerpt") {
    kids = [
      kindRow,
      <div
        key="q"
        style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.4, color: "#C9C6BE", flex: 1, marginTop: 4 }}
      >
        {t.title}
      </div>,
      footEl(),
    ];
  } else if (t.variant === "timeline") {
    kids = [
      kindRow,
      <div key="tl" style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6, flex: 1 }}>
        {(t.events || []).map((ev, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "34px 9px 1fr", gap: 7, alignItems: "center" }}>
            <span key="y" style={{ fontFamily: MONO, fontSize: 9, color: "#6E6C66", textAlign: "right" }}>
              {ev[0]}
            </span>
            <span
              key="d"
              style={{ width: 6, height: 6, borderRadius: "50%", background: ev[2] || "#C9C6BE", justifySelf: "center" }}
            />
            <span key="t" style={{ fontSize: 11, color: "#C9C6BE" }}>
              {ev[1]}
            </span>
          </div>
        ))}
      </div>,
      footEl(),
    ];
  } else if (t.variant === "skeleton") {
    kids = [
      <div key="s1" style={shim(56, 7)} />,
      <div key="s2" style={shim(110, 13)} />,
      <div key="s3" style={shim("100%", 8)} />,
      <div key="s4" style={shim(72, 8)} />,
    ];
  } else if (t.variant === "compare") {
    const col = (side: [string, string, string] | undefined, key: string) => (
      <div key={key} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span key="n" style={{ fontFamily: SERIF, fontSize: 13, color: inkMain }}>
          {side?.[0]}
        </span>
        <span key="v" style={{ fontFamily: SERIF, fontSize: 19, color: inkMain }}>
          {side?.[1]}
        </span>
        <span key="m" style={{ fontFamily: MONO, fontSize: 9, color: inkSub }}>
          {side?.[2]}
        </span>
      </div>
    );
    kids = [
      kindRow,
      <div key="b" style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 10, flex: 1, marginTop: 4 }}>
        {col(t.left, "l")}
        <div key="d" style={{ background: "#26272B" }} />
        {col(t.right, "r")}
      </div>,
      footEl(t.footColor),
    ];
  } else if (t.variant === "graph") {
    kids = [
      kindRow,
      <svg key="sv" viewBox="0 0 180 58" style={{ width: "100%", flex: 1, display: "block", marginTop: 4, minHeight: 44 }}>
        <line x1={90} y1={29} x2={32} y2={12} stroke="#3A3B40" strokeWidth={1} />
        <line x1={90} y1={29} x2={150} y2={10} stroke="#3A3B40" strokeWidth={1} />
        <line x1={90} y1={29} x2={42} y2={48} stroke="#3A3B40" strokeWidth={1} />
        <line x1={90} y1={29} x2={146} y2={46} stroke="#3A3B40" strokeWidth={1} />
        <circle cx={90} cy={29} r={6} fill="#86A38C" />
        <circle cx={32} cy={12} r={3.5} fill="#C9C6BE" />
        <circle cx={150} cy={10} r={3.5} fill="#C9C6BE" />
        <circle cx={42} cy={48} r={3.5} fill="#B8A06E" />
        <circle cx={146} cy={46} r={3.5} fill="#6E6C66" />
      </svg>,
      footEl(),
    ];
  } else if (t.variant === "chain") {
    kids = [
      kindRow,
      <div key="ch" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, flex: 1 }}>
        {(t.steps || []).map((st, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              key="d"
              style={{
                width: 6,
                height: 6,
                flexShrink: 0,
                transform: "rotate(45deg)",
                background: st[1] === "inferred" ? "transparent" : "#86A38C",
                border: st[1] === "inferred" ? "1.5px solid #B8A06E" : "none",
              }}
            />
            <span key="t" style={{ fontSize: 11.5, lineHeight: 1.3, color: st[1] === "inferred" ? "#D8C69C" : "#C9C6BE" }}>
              {st[0]}
            </span>
          </div>
        ))}
      </div>,
      footEl(),
    ];
  } else if (t.variant === "feed") {
    kids = [
      kindRow,
      <div key="fd" style={{ display: "flex", flexDirection: "column", marginTop: 2, flex: 1 }}>
        {(t.items || []).map((it, i, arr) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr 26px",
              alignItems: "center",
              gap: 8,
              padding: "5px 0",
              borderBottom: i < arr.length - 1 ? "1px solid #222327" : "none",
            }}
          >
            <span key="m" style={{ display: "flex", alignItems: "center" }}>
              {markEl(it[0] as CardMark)}
            </span>
            <span
              key="t"
              style={{ fontSize: 11, color: "#C9C6BE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {it[1]}
            </span>
            <span key="w" style={{ fontFamily: MONO, fontSize: 9, color: "#6E6C66", textAlign: "right" }}>
              {it[2]}
            </span>
          </div>
        ))}
      </div>,
    ];
  } else if (t.variant === "annotation") {
    kids = [
      kindRow,
      titleEl({ flex: "none" }),
      <div key="n" style={{ margin: "4px 0 0 10px", background: "#211F1A", border: "1px solid #333026", padding: "7px 10px", flex: 1 }}>
        <div key="l" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.14em", color: "#B8A06E" }}>
          NOTE · YOU
        </div>
        <div key="t" style={{ fontSize: 11, color: "#C9C6BE", lineHeight: 1.4, marginTop: 3 }}>
          {t.note}
        </div>
      </div>,
    ];
  } else if (t.variant === "cluster") {
    kids = [
      kindRow,
      <div key="g" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, margin: "6px 0", flex: 1 }}>
        {(t.tiles || []).map((nm, i) => (
          <div
            key={i}
            style={{
              background: "#1A1B1E",
              border: "1px solid #26272B",
              padding: "6px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <span key="k" style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.14em", color: "#6E6C66" }}>
              ENTITY
            </span>
            <span
              key="n"
              style={{ fontFamily: SERIF, fontSize: 12, color: inkMain, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {nm}
            </span>
          </div>
        ))}
      </div>,
      footEl(),
    ];
  } else if (t.variant === "stack") {
    const claims = t.claims || [];
    const idx = stackIndex % (claims.length || 1);
    onClickExtra = () => setStackIndex((i) => (i + 1) % claims.length);
    kids = [
      <div key="k" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span key="l" style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.14em", color: inkSub }}>
          {t.kind}
        </span>
        <span key="p" style={{ fontFamily: MONO, fontSize: 10, color: "#6E6C66" }}>
          {idx + 1} / {claims.length}
        </span>
      </div>,
      <div key="c" style={{ fontFamily: SERIF, fontSize: 14, lineHeight: 1.3, color: inkMain, flex: 1, marginTop: 2, minHeight: 38 }}>
        {claims[idx]}
      </div>,
      <span key="f" style={{ fontFamily: MONO, fontSize: 10, color: "#6E6C66" }}>
        click to cycle →
      </span>,
    ];
  } else if (t.variant === "action") {
    const open = actionState === "open";
    barColor = open ? "#B8A06E" : actionState === "resolved" ? "#86A38C" : "#3A3B40";
    bgOverride = open ? "#1E1C17" : "#16171A";
    const lbl = open ? "CONTRADICTION · ACTION" : actionState === "resolved" ? "RESOLVED ✓" : "DISMISSED";
    const lblC = open ? "#D8C69C" : actionState === "resolved" ? "#86A38C" : "#6E6C66";
    const txt = open ? t.title : actionState === "resolved" ? "Genoa confirmed via baptismal record" : "Alberti birthplace — set aside";
    const btn = (label: string, onc: () => void, primary: boolean) => (
      <button
        key={label}
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onc();
        }}
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: primary ? "#1A1B1E" : "#A5A29A",
          background: primary ? "#B8A06E" : "transparent",
          border: primary ? "none" : "1px solid #3A3B40",
          padding: "5px 12px",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
    kids = [
      <span key="k" style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.14em", color: lblC }}>
        {lbl}
      </span>,
      <div key="t" style={{ fontFamily: SERIF, fontSize: 14, lineHeight: 1.2, color: inkMain, flex: 1 }}>
        {txt}
      </div>,
      open ? (
        <div key="b" style={{ display: "flex", gap: 8 }}>
          {btn("RESOLVE", () => setActionState("resolved"), true)}
          {btn("DISMISS", () => setActionState("dismissed"), false)}
        </div>
      ) : (
        <span
          key="u"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setActionState("open");
          }}
          style={{ fontFamily: MONO, fontSize: 9, color: "#6E6C66", cursor: "pointer", alignSelf: "flex-start" }}
        >
          undo →
        </span>
      ),
    ];
  } else if (t.variant === "entitywiki") {
    kids = [
      kindRow,
      <div key="t" style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.1, color: inkMain }}>
        {t.title}
      </div>,
      <div key="d" style={{ fontSize: 12, color: "#C9C6BE", lineHeight: 1.5 }}>
        {t.desc}
      </div>,
      <div key="b" style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#A5A29A" }}>
        {(t.bullets || []).map((b, i) => (
          <span key={i}>· {b}</span>
        ))}
      </div>,
      <div
        key="q"
        style={{ borderLeft: "2px solid #3A3B40", paddingLeft: 11, fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: "#C9C6BE", flex: 1 }}
      >
        {t.quote}
      </div>,
    ];
  } else if (t.variant === "entitylive") {
    kids = [
      kindRow,
      <div key="t" style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.1, color: inkMain }}>
        {t.title}
      </div>,
      <div key="n" style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, marginTop: 2 }}>
        <span key="c" style={{ fontFamily: SERIF, fontSize: 28, color: inkMain }}>
          {t.claimsN}
        </span>
        <span key="cl" style={{ fontFamily: MONO, fontSize: 10, color: "#A5A29A" }}>
          claims
        </span>
        <span key="o" style={{ fontFamily: SERIF, fontSize: 28, color: "#D8C69C" }}>
          {t.openN}
        </span>
        <span key="ol" style={{ fontFamily: MONO, fontSize: 10, color: "#D8C69C" }}>
          open
        </span>
      </div>,
      <span key="s" style={{ fontFamily: MONO, fontSize: 10, color: "#6E6C66" }}>
        synced 2m ago
      </span>,
    ];
  } else if (t.variant === "audit") {
    kids = [
      kindRow,
      <div key="tbl" style={{ display: "grid", gridTemplateColumns: "1fr 34px 26px", fontFamily: MONO, fontSize: 11, marginTop: 2 }}>
        <div key="h1" style={{ color: "#6E6C66", padding: "4px 0", borderBottom: "1px solid #26272B" }}>
          Claim
        </div>
        <div key="h2" style={{ color: "#6E6C66", padding: "4px 0", borderBottom: "1px solid #26272B", textAlign: "right" }}>
          Src
        </div>
        <div key="h3" style={{ color: "#6E6C66", padding: "4px 0", borderBottom: "1px solid #26272B", textAlign: "right" }}>
          OK
        </div>
        {(t.rows || []).flatMap((r, i) => [
          <div key={`a${i}`} style={{ color: "#C9C6BE", padding: "5px 0" }}>
            {r[0]}
          </div>,
          <div key={`b${i}`} style={{ color: "#A5A29A", padding: "5px 0", textAlign: "right" }}>
            {r[1]}
          </div>,
          <div key={`c${i}`} style={{ color: r[3], padding: "5px 0", textAlign: "right" }}>
            {r[2]}
          </div>,
        ])}
      </div>,
      <div key="tasks" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
        {(t.tasks || []).map((tk) => {
          const done = !!checks[tk.id];
          return (
            <div
              key={tk.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setChecks((c) => ({ ...c, [tk.id]: !c[tk.id] }));
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, color: done ? "#8A8880" : "#C9C6BE", cursor: "pointer" }}
            >
              <span
                key="x"
                style={{
                  width: 13,
                  height: 13,
                  flexShrink: 0,
                  border: `1px solid ${done ? "#86A38C" : "#3A3B40"}`,
                  background: done ? "#86A38C" : "transparent",
                  color: "#1A1B1E",
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span key="l" style={{ textDecoration: done ? "line-through" : "none" }}>
                {tk.label}
              </span>
            </div>
          );
        })}
      </div>,
    ];
  } else {
    kids = [kindRow, titleEl(), footEl()];
  }

  return { kids, barColor, bgOverride, onClickExtra };
}

export interface CardFrameProps {
  t: CardDef;
  sec: SectionKey;
  listView?: boolean;
  body: CardBodyResult;
  style?: CSSProperties;
  innerRef?: Ref<HTMLDivElement>;
  extra?: Record<string, unknown>;
}

export function CardFrame({ t, sec, listView, body, style, innerRef, extra }: CardFrameProps) {
  if (sec === "archive" && listView) {
    return (
      <div
        ref={innerRef}
        {...extra}
        style={{
          display: "grid",
          gridTemplateColumns: "68px 1fr 90px",
          alignItems: "center",
          gap: 12,
          padding: "8px 4px",
          borderBottom: "1px solid #1E1F22",
          cursor: "grab",
          ...style,
        }}
      >
        <span
          key="k"
          style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: "#6E6C66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {t.kind}
        </span>
        <span key="s" style={{ fontSize: 12, color: "#A5A29A" }}>
          {t.title}
        </span>
        <span key="w" style={{ fontFamily: MONO, fontSize: 10, color: "#6E6C66", textAlign: "right" }}>
          {t.foot}
        </span>
      </div>
    );
  }
  if (sec === "living") {
    return (
      <div ref={innerRef} {...extra} style={{ background: "#1A1B1E", padding: 16, marginBottom: 4, cursor: "grab", ...style }}>
        <div key="k" style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.14em", color: "#A5A29A" }}>
          {t.kind}
        </div>
        <div key="q" style={{ fontFamily: SERIF, fontStyle: t.italic ? "italic" : "normal", fontSize: 19, color: "#E6E4DE", lineHeight: 1.2, marginTop: 6 }}>
          {t.title}
        </div>
        <div key="m" style={{ fontFamily: MONO, fontSize: 10, color: "#A5A29A", marginTop: 10 }}>
          {t.foot}
        </div>
      </div>
    );
  }
  const { kids, barColor, bgOverride } = body;
  return (
    <div
      ref={innerRef}
      {...extra}
      style={{
        gridColumn: `span ${t.span === 2 ? 2 : 1}`,
        minWidth: 0,
        minHeight: 82,
        background: t.dashed ? "transparent" : bgOverride || t.bg || "#1A1B1E",
        border: t.dashed ? "1px dashed #3A3B40" : "none",
        boxShadow: t.variant === "stack" ? "3px 3px 0 #131417, 6px 6px 0 #0D0E10" : barColor ? `inset 2px 0 0 ${barColor}` : "none",
        color: t.dim ? "#4A4B4F" : "#E6E4DE",
        padding: barColor ? "10px 12px 10px 14px" : "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: t.variant === "skeleton" ? 8 : 4,
        cursor: "grab",
        ...style,
      }}
    >
      {kids}
    </div>
  );
}

export interface HomeCardProps {
  id: string;
  sec: SectionKey;
  listView?: boolean;
  onOpen: (to: string) => void;
}

/** HomeCard — static (non-draggable) card render for Plan 06-05. Mirrors the
 * reference's `SortableCard`, minus the sortable-drag hook / drag-and-drop
 * library wiring (Plan 06-06 wraps this in a drag context + sortable hook).
 * Click-to-open is guarded by `onClickExtra` (e.g. the stack-cycle variant)
 * exactly as the reference does. */
export function HomeCard({ id, sec, listView, onOpen }: HomeCardProps) {
  const t = cardDefs[id];
  const body = CardBody({ t });

  if (!t) return null;

  const extra = {
    title: "Click to open",
    onClick: () => {
      if (body.onClickExtra) {
        body.onClickExtra();
        return;
      }
      if (t.to) onOpen(t.to);
    },
  };

  return <CardFrame t={t} sec={sec} listView={listView} body={body} extra={extra} />;
}
