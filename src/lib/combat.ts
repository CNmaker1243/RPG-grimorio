import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { DICE_SIDES, type DiceSelection } from "@/lib/dice";

export type Item = Tables<"items">;
export type CharacterItem = Tables<"character_items">;
export type Combat = Tables<"combats">;
export type Bonus = { description: string; value: string };
export type Entry = { name: string; value: string };

/** Safe dice-expression parser (no eval). Mirrors the server's parse_damage_formula. */
export function parseDamageFormula(formula: string): { dice: DiceSelection[]; modifier: number } | string {
  const f = formula.replace(/\s/g, "").toLowerCase();
  if (!f || f.length > 60 || !/^(\d{1,3}d\d{1,3}|\d{1,5})([+-](\d{1,3}d\d{1,3}|\d{1,5}))*$/.test(f)) return "Fórmula inválida. Use, por exemplo, 1d6 + 2.";
  const counts = new Map<number, number>();
  let modifier = 0, total = 0;
  for (const m of f.matchAll(/([+-]?)(\d+d\d+|\d+)/g)) {
    const sign = m[1] ?? "", term = m[2] ?? "";
    if (term.includes("d")) {
      if (sign === "-") return "Não é possível subtrair dados.";
      const n = Number(term.split("d")[0]), s = Number(term.split("d")[1]);
      if (!DICE_SIDES.some(d => d === s)) return `Dado d${s} não disponível.`;
      if (n < 1) return "Quantidade de dados inválida.";
      counts.set(s, (counts.get(s) ?? 0) + n); total += n;
    } else modifier += sign === "-" ? -Number(term) : Number(term);
  }
  if (total < 1) return "A fórmula precisa de pelo menos um dado.";
  if (total > 100) return "Máximo de 100 dados por fórmula.";
  if (Math.abs(modifier) > 10000) return "Modificador muito alto.";
  return { dice: DICE_SIDES.flatMap(s => counts.has(s) ? [{ sides: s, count: counts.get(s)! }] : []), modifier };
}

export type DuelOutcome = "attacker_won" | "defender_won" | "awaiting_reroll";
/** Highest die wins; ties go to the higher attribute; full ties require a new roll. */
export function decideDuel(attack: number[], defense: number[], attackValue: number, defenseValue: number): DuelOutcome {
  const a = Math.max(...attack), d = Math.max(...defense);
  if (a !== d) return a > d ? "attacker_won" : "defender_won";
  if (attackValue !== defenseValue) return attackValue > defenseValue ? "attacker_won" : "defender_won";
  return "awaiting_reroll";
}

export function readBonuses(v: Json): Bonus[] {
  return Array.isArray(v) ? v.flatMap(b => b && typeof b === "object" && !Array.isArray(b) && typeof b["description"] === "string" && typeof b["value"] === "string" ? [{ description: b["description"], value: b["value"] }] : []) : [];
}
export function readEntries(v: Json): Entry[] {
  return Array.isArray(v) ? v.flatMap(b => b && typeof b === "object" && !Array.isArray(b) && typeof b["name"] === "string" && typeof b["value"] === "string" ? [{ name: b["name"], value: b["value"] }] : []) : [];
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_defense_attribute: "Aguardando a mestra escolher a defesa",
  awaiting_defense: "Aguardando rolagem de defesa",
  awaiting_reroll: "Empate total — atacante rola novamente",
  attacker_won: "Atacante venceu",
  defender_won: "Defensor venceu",
  damage_rolled: "Dano aplicado",
  cancelled: "Encerrado pela mestra",
};

export const itemsQuery = (campaignId: string) => queryOptions({
  queryKey: ["items", campaignId],
  queryFn: async () => {
    const [items, links] = await Promise.all([
      supabase.from("items").select("*").eq("campaign_id", campaignId).order("category").order("name"),
      supabase.from("character_items").select("*").eq("campaign_id", campaignId),
    ]);
    if (items.error) throw items.error; if (links.error) throw links.error;
    return { items: items.data ?? [], links: links.data ?? [] };
  },
});
export const rosterQuery = (campaignId: string) => queryOptions({
  queryKey: ["roster", campaignId],
  queryFn: async () => { const { data, error } = await supabase.rpc("combat_roster", { _campaign: campaignId }); if (error) throw error; return data ?? []; },
});
export const combatsQuery = (campaignId: string) => queryOptions({
  queryKey: ["combats", campaignId],
  queryFn: async () => { const { data, error } = await supabase.from("combats").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(20); if (error) throw error; return data ?? []; },
});
