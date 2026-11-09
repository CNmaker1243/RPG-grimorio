import { describe, expect, it } from "vitest";
import { decideDuel, parseDamageFormula } from "@/lib/combat";

describe("Damage formulas", () => {
  it("parses 1d6 + 2 into dice and modifier", () => {
    expect(parseDamageFormula("1d6 + 2")).toEqual({ dice: [{ sides: 6, count: 1 }], modifier: 2 });
  });
  it("rejects d2 and arbitrary code", () => {
    expect(typeof parseDamageFormula("1d2")).toBe("string");
    expect(typeof parseDamageFormula("alert(1)")).toBe("string");
    expect(typeof parseDamageFormula("2")).toBe("string");
  });
});

describe("Attack vs defense", () => {
  it("highest die wins: 18 beats 15", () => {
    expect(decideDuel([11, 18, 7], [15, 12], 3, 2)).toBe("attacker_won");
  });
  it("tie on dice goes to the higher attribute", () => {
    expect(decideDuel([18], [18], 3, 2)).toBe("attacker_won");
    expect(decideDuel([18], [18], 1, 2)).toBe("defender_won");
  });
  it("full tie requires a new roll", () => {
    expect(decideDuel([18], [18], 2, 2)).toBe("awaiting_reroll");
  });
});
