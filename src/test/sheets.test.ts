import { describe,it,expect } from "vitest";
import { successCount,testPool,testPassed,canCreateType } from "@/lib/sheets";
describe("custom sheet rules",()=>{
 it("adds Intelligence 3 and Investigation 2 for five dice",()=>expect(testPool(3,2)).toBe(5));
 it("counts each face at least 6 as one success",()=>expect(successCount([8,6,4,9,2])).toBe(3));
 it("does not give tens special critical successes",()=>expect(successCount([10,10,5])).toBe(2));
 it("passes three successes against difficulty two",()=>expect(testPassed([8,6,4,9,2],2)).toBe(true));
 it("fails below the required number of successes",()=>expect(testPassed([6,4,2],2)).toBe(false));
 it("enforces the player total of two sheets",()=>expect(canCreateType(2,2,0,1)).toBe(false));
 it("enforces one sheet of each authorized type",()=>expect(canCreateType(1,2,1,1)).toBe(false));
 it("rejects unassigned template types",()=>expect(canCreateType(0,2,0,undefined)).toBe(false));
});