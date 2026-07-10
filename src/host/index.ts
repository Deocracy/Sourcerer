import { aiComplete } from "./aiComplete";
import { makeAppletStorage } from "./storage";
import { hostOpen } from "./open";
import { theme } from "./theme";
import type { Host } from "./types";

/**
 * host/index.ts — makeHost(instanceId, appletKey), the per-instance factory
 * assembling the `host` seam (FWK-04). Mirrors src/host/ai.ts's flat-object
 * "module assembles its own public functions" idiom (`export const host = {
 * ai, setModes, loadSession }`), adapted to a factory since storage and
 * instanceId are per-instance/per-appletKey, not module-singleton.
 *
 * Exactly five members: storage, ai, open, instanceId, theme. This is the
 * FINAL shape — do not add a sixth member (see src/host/types.ts).
 */
export function makeHost(instanceId: string, appletKey: string): Host {
  return {
    storage: makeAppletStorage(appletKey),
    ai: aiComplete,
    open: hostOpen,
    instanceId,
    theme,
  };
}
