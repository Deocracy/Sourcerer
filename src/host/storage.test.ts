import { describe, it, expect } from "vitest";

// MISSING — implemented in Task 2. RED scaffold (Nyquist rule): this file
// exists and fails before src/host/storage.ts is written.
describe("host/storage", () => {
  it.todo("storage.set then storage.get returns the stored value under the namespaced key");
  it.todo("storage.get returns the fallback when the underlying get throws (corrupt read)");
  it.todo("storage.get returns the fallback when the stored value is null/undefined");
  it.todo("storage.remove deletes the namespaced key and saves");
  it.todo("two different appletKeys never collide (namespace isolation)");

  it("RED placeholder fails until Task 2 implements src/host/storage.ts", () => {
    expect(() => {
      throw new Error("MISSING — src/host/storage.ts not implemented yet (Task 2)");
    }).toThrow();
  });
});
