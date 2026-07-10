import { describe, it, expect } from "vitest";
import { registry } from "./registry";
import { appletDefs } from "./appletDefs";

/**
 * registry.test.ts — FWK-01/FWK-02 shape assertions (04-02-PLAN.md Task 1).
 * registry.ts has no runtime dependency on host/dockApi (applet modules only
 * receive `host` as a prop, never call makeHost themselves), so no
 * @tauri-apps/plugin-store or dockApi mocking is needed here.
 */
describe("registry", () => {
  it("has an entry for every appletDefs key", () => {
    const defKeys = Object.keys(appletDefs);
    const regKeys = Object.keys(registry);
    for (const key of defKeys) {
      expect(regKeys).toContain(key);
    }
  });

  it("each module's manifest.key equals its registry key", () => {
    for (const [key, mod] of Object.entries(registry)) {
      expect(mod.manifest.key).toBe(key);
    }
  });

  it("every manifest carries non-empty glyph/title/code/desc", () => {
    for (const mod of Object.values(registry)) {
      expect(mod.manifest.glyph.length).toBeGreaterThan(0);
      expect(mod.manifest.title.length).toBeGreaterThan(0);
      expect(mod.manifest.code.length).toBeGreaterThan(0);
      expect(mod.manifest.desc.length).toBeGreaterThan(0);
    }
  });

  it("Wiki and Library entries exist as override modules", () => {
    expect(registry.Wiki).toBeTruthy();
    expect(registry.Library).toBeTruthy();
  });
});
