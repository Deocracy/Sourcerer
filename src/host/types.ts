/**
 * host/types.ts — LEAF type contracts for the applet framework's `host` seam
 * (FWK-04). This module imports NOTHING from src/shell/registry.ts or any
 * applet code, so applets and the registry can both import it without ever
 * creating an import cycle.
 *
 * `Host` is FIXED and exhaustive: exactly five members — storage, ai, open,
 * instanceId, theme. Do not add a sixth member here. Per-instance state
 * read/write (D-14) is a reserved additive seam finalized by its first real
 * consumer (Phase 5 Notes) — Phase 4 wires only the workspaceStore slot + GC
 * (see src/host/instanceState.ts), it is NOT exposed as a host member.
 */

/** Applet metadata — glyph/title/desc mirror src/shell/appletDefs.ts so the
 *  registry, rail, dock, and catalog never drift (04-PATTERNS.md). */
export interface AppletManifest {
  key: string;
  glyph: string;
  code: string;
  title: string;
  desc: string;
}

/** Theme token set host.theme exposes — mirrors src/styles/tokens.css
 *  key-for-key (color tokens + the three font-family strings). */
export interface ThemeTokens {
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  line2: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentHover: string;
  fontMono: string;
  fontSerif: string;
  fontSans: string;
}

/** host.storage — namespaced, best-effort, never-throws Promise API (D-15/D-16). */
export interface AppletStorage {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The `host` seam — the ONLY surface applets touch. Applets never bypass
 *  this (CLAUDE.md). Exactly five members, no more, no fewer. */
export interface Host {
  storage: AppletStorage;
  ai(prompt: string, opts?: { onDelta?: (text: string) => void }): Promise<string>;
  open(appletKey: string): void;
  instanceId: string;
  theme: ThemeTokens;
}

/** The shape every applet module exports — manifest + App(props). Registered
 *  into src/shell/registry.ts (Phase 4 later plan) as ordinary .tsx modules,
 *  never React-via-props indirection (CLAUDE.md "What NOT to Use"). */
export interface AppletModule {
  manifest: AppletManifest;
  App: (props: { host: Host }) => JSX.Element;
}
