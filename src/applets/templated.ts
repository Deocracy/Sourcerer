import { createElement } from "react";
import { appletDefs } from "../shell/appletDefs";
import { TemplatedStub } from "./_stub/TemplatedStub";
import { demoRows, genericDemoRow } from "./_stub/demoRows";
import type { AppletManifest, AppletModule } from "../host/types";

/**
 * templated.ts — one generated AppletModule per appletDefs key (D-11: stubs
 * are registered applet modules, generated from the single appletDefs source
 * of truth rather than ~11 hand-duplicated files). `.ts` (not `.tsx`) per
 * 04-02-PLAN.md's file list — uses `createElement` rather than JSX syntax
 * since this extension has no JSX parsing enabled.
 *
 * registry.ts spreads `templatedModules` first, then overrides Wiki/Library
 * with their own richer modules (Plans 03/04 fill those in without ever
 * touching this file or registry.ts).
 */
export const templatedModules: Record<string, AppletModule> = Object.fromEntries(
  Object.entries(appletDefs).map(([key, def]) => {
    const manifest: AppletManifest = {
      key,
      glyph: def.glyph,
      code: def.code,
      title: def.title,
      desc: def.line,
    };
    const rows = demoRows[key] ?? genericDemoRow;
    const App: AppletModule["App"] = ({ host }) =>
      createElement(TemplatedStub, { manifest, host, rows });
    const mod: AppletModule = { manifest, App };
    return [key, mod];
  }),
);
