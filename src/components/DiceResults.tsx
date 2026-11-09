import { readDiceGroups } from "@/lib/dice";
import type { DiceRoll } from "@/lib/rpg";

export function DiceResults({ roll }: { roll: DiceRoll }) {
  const groups = readDiceGroups(roll.dice_groups);
  const success = roll.success_data && typeof roll.success_data === "object" && !Array.isArray(roll.success_data) ? roll.success_data : null;
  return (
    <div className="space-y-3">
      {success && <><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>{String(success['attribute_name'])}: <strong>{String(success['attribute_value'])}</strong></span><span>{String(success['skill_name'])}: <strong>{String(success['skill_level'])}</strong></span><span className="font-mono">{String(success['dice_count'])}d10</span></div><div className="flex flex-wrap items-center gap-4"><strong className={success['passed'] ? 'text-primary' : 'text-destructive'}>{success['passed'] ? 'Sucesso' : 'Falha'}</strong><span>{String(success['successes'])} sucessos · dificuldade {String(success['difficulty'])}</span></div></>}
      {groups.length ? groups.map(group => (
        <div key={group.sides} className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-sm text-muted-foreground">{group.count}d{group.sides}</span>
          {group.results.map((result, i) => <span key={i} aria-label={`d${group.sides}: ${result}`} className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-2 font-mono font-semibold ${success && result >= 6 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary'}`}>{result}</span>)}
        </div>
      )) : <p className="break-words font-mono text-sm text-muted-foreground">[{roll.results.join(", ")}]</p>}
      {roll.modifier !== 0 && <p className="text-sm text-muted-foreground">Modificador: {roll.modifier > 0 ? "+" : ""}{roll.modifier}</p>}
    </div>
  );
}