import { describe, expect, it } from "vitest";
import { DICE_SIDES, diceExpression, readDiceGroups, validateDice } from "@/lib/dice";

describe("Campaign dice rules", () => {
  it("allows exactly d4, d6, d8, d10, d12, d20 and d100", () => {
    expect([...DICE_SIDES]).toEqual([4,6,8,10,12,20,100]);
    expect(validateDice([{sides: 3, count: 1}], "individual")).not.toBeNull();
  });
  it("individual mode uses a single type", () => {
    expect(validateDice([{sides: 6, count: 2}], "individual")).toBeNull();
    expect(validateDice([{sides: 6, count: 2}, {sides: 8, count: 1}], "individual")).not.toBeNull();
  });
  it("combines quantities in the requested examples", () => {
    for (const dice of [[{sides:4,count:1},{sides:6,count:1}], [{sides:6,count:2},{sides:8,count:3}], [{sides:6,count:3},{sides:20,count:2},{sides:100,count:1}], [{sides:4,count:4},{sides:8,count:2},{sides:12,count:3}]]) expect(validateDice(dice,"combined")).toBeNull();
    expect(diceExpression([{sides:6,count:2},{sides:8,count:1}])).toBe("2d6 + 1d8");
  });
  it("retains every individual result with the sum 16", () => {
    const groups = readDiceGroups([{sides:6,count:2,results:[4,5]},{sides:8,count:1,results:[7]}]);
    expect(groups.flatMap(g => g.results)).toEqual([4,5,7]);
    expect(groups.flatMap(g => g.results).reduce((s,v)=>s+v,0)).toBe(16);
  });
  it("preserves the existing maximum of 100 dice and rejects invalid quantities", () => {
    expect(validateDice([{sides:6,count:100}],"individual")).toBeNull();
    for (const count of [0,-1,1.5,101,NaN]) expect(validateDice([{sides:6,count}],"individual")).not.toBeNull();
    expect(validateDice([{sides:6,count:60},{sides:8,count:41}],"combined")).not.toBeNull();
  });
});