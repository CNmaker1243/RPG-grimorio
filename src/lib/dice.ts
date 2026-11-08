export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type RollMode = "individual" | "combined";
export type DiceSelection = { sides: number; count: number };
export type DiceGroup = DiceSelection & { results: number[] };

export function validateDice(dice: DiceSelection[], mode: RollMode): string | null {
  if (!dice.length) return "Selecione pelo menos um dado.";
  if (mode === "individual" && dice.length !== 1) return "Selecione um único tipo de dado.";
  if (dice.some(d => !DICE_SIDES.some(s => s === d.sides))) return "Tipo de dado inválido.";
  if (new Set(dice.map(d => d.sides)).size !== dice.length) return "Tipo de dado repetido.";
  if (dice.some(d => !Number.isInteger(d.count) || d.count < 1 || d.count > 100)) return "Quantidade de dados entre 1 e 100.";
  if (dice.reduce((sum, d) => sum + d.count, 0) > 100) return "Máximo de 100 dados por rolagem.";
  return null;
}

export function diceExpression(dice: DiceSelection[], modifier = 0) {
  return dice.map(d => `${d.count}d${d.sides}`).join(" + ") + (modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : "");
}

export function readDiceGroups(value: unknown): DiceGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(group => {
    if (!group || typeof group !== "object" || typeof group.sides !== "number" || typeof group.count !== "number" || !Array.isArray(group.results) || !group.results.every((r: unknown) => typeof r === "number")) return [];
    return [{ sides: group.sides, count: group.count, results: group.results }];
  });
}