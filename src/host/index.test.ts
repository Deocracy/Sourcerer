import { describe, it, expect } from "vitest";

// MISSING — implemented in Task 3. RED scaffold (Nyquist rule): this file
// exists and fails before src/host/index.ts is written.
describe("host/index makeHost", () => {
  it.todo("returns exactly the five keys: storage, ai, open, instanceId, theme");
  it.todo("instanceId passes through as the value given");

  it("RED placeholder fails until Task 3 implements src/host/index.ts", () => {
    expect(() => {
      throw new Error("MISSING — src/host/index.ts not implemented yet (Task 3)");
    }).toThrow();
  });
});
