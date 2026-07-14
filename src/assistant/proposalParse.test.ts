import { describe, it, expect } from "vitest";
import { parseProposal } from "./proposalParse";
import { sessionSeeds } from "./sessionSeeds";

// Boundary coverage for the ASST-02 proposal marker parser (D-02).
describe("parseProposal(text)", () => {
  it("parses the authored seed-careggi proposal text (guaranteed-parseable demo fixture)", () => {
    const seedText = sessionSeeds
      .find((s) => s.id === "seed-careggi")!
      .turns.at(-1)!.text;

    const result = parseProposal(seedText);

    expect(result).not.toBeNull();
    expect(result!.target).toBe("§ Poliziano · role at Careggi");
    expect(result!.body).toBe(
      '"Attended irregularly 1477–1494 — free from teaching."'
    );
  });

  it("parses a synthetic 'Proposal — …§…' marker + blockquote pair", () => {
    const text = "Proposal — updates § Poliziano\n> change role to X";

    expect(parseProposal(text)).toEqual({
      target: "§ Poliziano",
      body: "change role to X",
      raw: text,
    });
  });

  it("returns null for plain prose with no marker", () => {
    expect(parseProposal("plain prose with no marker")).toBeNull();
  });

  it("is case-tolerant on the prefix and ignores leading whitespace / colon variant", () => {
    const text = "   proposal:  updates § Foo\n> bar baz";

    const result = parseProposal(text);

    expect(result).not.toBeNull();
    expect(result!.target).toBe("§ Foo");
    expect(result!.body).toBe("bar baz");
  });

  it("returns null when a marker line has no following blockquote", () => {
    expect(parseProposal("Proposal — updates § Poliziano\nno blockquote here")).toBeNull();
  });
});
