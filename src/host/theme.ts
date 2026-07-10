import type { ThemeTokens } from "./types";

/**
 * host/theme.ts — host.theme, a static token object mirroring
 * src/styles/tokens.css key-for-key (D-13-adjacent discretion). A static
 * literal (not getComputedStyle) is deterministic under jsdom/vitest and
 * matches the handoff's inline `T` object consumer shape (wiki.js line 11:
 * T.bg, T.accent, T.mono, etc).
 *
 * DISCRETION (04-CONTEXT.md / 04-PATTERNS.md "No Analog Found"): this is the
 * one host module with no prior code analog — only the tokens.css data
 * source. Keep this literal in sync with src/styles/tokens.css by hand;
 * there is no runtime read-back today.
 */
export const theme: ThemeTokens = {
  bg: "#0a0a0b",
  panel: "#131418",
  panel2: "#0F1013",
  line: "#1e1f22",
  line2: "#26272B",
  text: "#e6e4de",
  muted: "#A5A29A",
  faint: "#6E6C66",
  accent: "#86A38C",
  accentHover: "#A3BCA8",
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  fontSerif: '"IBM Plex Serif", Georgia, serif',
  fontSans: '"IBM Plex Sans", system-ui, sans-serif',
};
