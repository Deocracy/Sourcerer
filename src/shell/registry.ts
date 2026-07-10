import { templatedModules } from "../applets/templated";
import * as WikiModule from "../applets/Wiki";
import * as LibraryModule from "../applets/Library";
import type { AppletManifest, AppletModule } from "../host/types";

export type { AppletManifest, AppletModule };

/**
 * registry.ts — the static key→AppletModule map (FWK-01/FWK-02). This is the
 * SOLE registration point: to make a real applet, add its override module
 * here (replacing its templated entry), exactly as Wiki/Library already do
 * below. A new key added to src/shell/appletDefs.ts auto-gets a templated
 * stub via templatedModules and appends to the rail (D-19) without ever
 * touching this file.
 *
 * Spread templatedModules first, then override with real/rich modules — the
 * later keys win, so Wiki/Library replace their generated templated entries
 * here while every other key stays on the generated stub.
 */
export const registry: Record<string, AppletModule> = {
  ...templatedModules,
  Wiki: WikiModule,
  Library: LibraryModule,
};
