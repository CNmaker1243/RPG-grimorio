import { readDiceGroups } from "@/lib/dice";
import type { DiceRoll } from "@/lib/rpg";

export function DiceResults({ roll }: { roll: DiceRoll }) {
  const groups = readDiceGroups(roll.dice_groups);
  return (
    <div className="space-y-3">
      {groups.length ? groups.map(group => (
        <div key={group.sides} className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-sm text-muted-foreground">{group.count}d{group.sides}</span>
          {group.results.map((result, i) => <span key={i} aria-label={`d${group.sides}: ${result}`} className="flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-secondary px-2 font-mono font-semibold">{result}</span>)}
        </div>
      )) : <p className="break-words font-mono text-sm text-muted-foreground">[{roll.results.join(", ")}]</p>}
      {roll.modifier !== 0 && <p className="text-sm text-muted-foreground">Modificador: {roll.modifier > 0 ? "+" : ""}{roll.modifier}</p>}
    </div>
  );
}