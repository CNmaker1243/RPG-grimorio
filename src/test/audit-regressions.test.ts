import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/rpg";
import { parseDamageFormula } from "@/lib/combat";

describe("Audit regressions", () => {
  it("keeps invitation redirects on the application origin", () => {
    expect(safeRedirect("/convite/ABC12345")).toBe("/convite/ABC12345");
    for (const path of ["//example.com", "/\\example.com", "/\n/example.com", "https://example.com"]) {
      expect(safeRedirect(path)).toBe("/painel");
    }
  });
  it("combines repeated damage dice without losing quantities", () => {
    expect(parseDamageFormula("1d6 + 2d6 + 1d8 - 2")).toEqual({dice:[{sides:6,count:3},{sides:8,count:1}],modifier:-2});
  });
  it("rejects damage pools above 100 dice", () => {
    expect(typeof parseDamageFormula("100d6 + 1d8")).toBe("string");
    expect(parseDamageFormula("100d6")).toEqual({dice:[{sides:6,count:100}],modifier:0});
  });
});