import { appletDefs } from "../../shell/appletDefs";
import { TemplatedStub } from "../_stub/TemplatedStub";
import { demoRows, genericDemoRow } from "../_stub/demoRows";
import type { AppletManifest, AppletModule } from "../../host/types";

/**
 * src/applets/Wiki/index.tsx — the Wiki OVERRIDE module (D-11, 04-02-PLAN.md
 * Task 2). Registered in registry.ts as an override entry (after the
 * templatedModules spread) so a future rich Wiki port (Plan 03/04) only ever
 * edits THIS file's `App` — registry.ts and templated.ts never change.
 *
 * For now this renders the same TemplatedStub body every other stub gets
 * (still carries the DEMO chip, per D-12 — every stub, including future rich
 * ports, must show DEMO until a real applet lands).
 */
const def = appletDefs.Wiki;

export const manifest: AppletManifest = {
  key: "Wiki",
  glyph: def.glyph,
  code: def.code,
  title: def.title,
  desc: def.line,
};

const rows = demoRows.Wiki ?? genericDemoRow;

export const App: AppletModule["App"] = ({ host }) => (
  <TemplatedStub manifest={manifest} host={host} rows={rows} />
);
