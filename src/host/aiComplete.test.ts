import { describe, it, expect } from "vitest";

// MISSING — implemented in Task 3. RED scaffold (Nyquist rule): this file
// exists and fails before src/host/aiComplete.ts is written.
describe("host/aiComplete", () => {
  it.todo("resolves with the accumulated text once a done event arrives");
  it.todo("rejects with an Error carrying the message when an error event arrives");
  it.todo("forwards each cumulative text to onDelta on every text_delta");
  it.todo("generates a sessionId of form oneshot-<nanoid> whose first and last char are alphanumeric");

  it("RED placeholder fails until Task 3 implements src/host/aiComplete.ts", () => {
    expect(() => {
      throw new Error("MISSING — src/host/aiComplete.ts not implemented yet (Task 3)");
    }).toThrow();
  });
});
