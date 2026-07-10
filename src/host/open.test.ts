import { describe, it, expect } from "vitest";

// MISSING — implemented in Task 3. RED scaffold (Nyquist rule): this file
// exists and fails before src/host/open.ts is written.
describe("host/open", () => {
  it.todo("focuses an existing panel whose id splits to appletKey via setActivePanel");
  it.todo("opens a new instance via addAppletToDock when no matching panel exists");

  it("RED placeholder fails until Task 3 implements src/host/open.ts", () => {
    expect(() => {
      throw new Error("MISSING — src/host/open.ts not implemented yet (Task 3)");
    }).toThrow();
  });
});
