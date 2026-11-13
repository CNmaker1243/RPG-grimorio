import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { integerInRange } from "@/lib/validation";

export type Template = Tables<"sheet_templates">;
export type Skill = Tables<"sheet_skills">;
export type SuccessTest = Tables<"success_tests">;
export type SheetField = { id: string; name: string; kind: "attribute" | "number" | "text" | "textarea" };
export type SheetData = { values: Record<string, string | number>; skills: Record<string, number> };
export function validSheetDraft(data: SheetData, fields: SheetField[], skills: Skill[]) {
  return fields.every(f => {
    const value = data.values[f.id];
    return value === undefined || (f.kind === "attribute" || f.kind === "number"
      ? integerInRange(value, 0, 100)
      : typeof value === "string" && value.length <= 10000);
  }) && skills.every(s => data.skills[s.id] === undefined || integerInRange(data.skills[s.id], 0, s.max_level));
}
export function readFields(value: Json): SheetField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(f => f && typeof f === "object" && !Array.isArray(f) && typeof f['id'] === "string" && typeof f['name'] === "string" && (f['kind'] === "attribute" || f['kind'] === "number" || f['kind'] === "text" || f['kind'] === "textarea") ? [{id:f['id'],name:f['name'],kind:f['kind']}] : []);
}
export function readSheet(value: Json): SheetData {
  const data: SheetData = {values:{},skills:{}};
  if (!value || typeof value !== "object" || Array.isArray(value)) return data;
  for (const [key,v] of Object.entries(value['values'] && typeof value['values'] === "object" && !Array.isArray(value['values']) ? value['values'] : {})) if (typeof v === "string" || typeof v === "number") data.values[key]=v;
  for (const [key,v] of Object.entries(value['skills'] && typeof value['skills'] === "object" && !Array.isArray(value['skills']) ? value['skills'] : {})) if (typeof v === "number") data.skills[key]=v;
  return data;
}
export function successCount(results: number[]) { return results.filter(n => n >= 6).length; }
export function testPool(attribute: number, skill: number) { return attribute + skill; }
export function testPassed(results: number[], difficulty: number) { return successCount(results) >= difficulty; }
export function canCreateType(total: number, totalLimit: number, typeCount: number, typeLimit: number | undefined) { return total < totalLimit && typeLimit !== undefined && typeCount < typeLimit; }
export const sheetsQuery = (campaignId: string) => queryOptions({
  queryKey:["sheets",campaignId],
  queryFn:async () => {
    const {data:templates,error} = await supabase.from("sheet_templates").select("*").eq("campaign_id",campaignId).order("created_at");
    if(error) throw error;
    const ids = (templates ?? []).map(t=>t.id);
    const [skills,limits,tests] = await Promise.all([
      ids.length ? supabase.from("sheet_skills").select("*").in("template_id",ids).order("name") : Promise.resolve({data:[],error:null}),
      ids.length ? supabase.from("member_template_limits").select("*").in("template_id",ids) : Promise.resolve({data:[],error:null}),
      supabase.from("success_tests").select("*").eq("campaign_id",campaignId).order("name"),
    ]);
    if(skills.error) throw skills.error; if(limits.error) throw limits.error; if(tests.error) throw tests.error;
    return {templates:templates ?? [],skills:skills.data ?? [],limits:limits.data ?? [],tests:tests.data ?? []};
  },
});