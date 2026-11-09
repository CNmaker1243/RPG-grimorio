import { readDiceGroups } from "@/lib/dice";
import type { DiceRoll } from "@/lib/rpg";

export function DiceResults({ roll }: { roll: DiceRoll }) {
  const groups = readDiceGroups(roll.dice_groups);
  const success = roll.success_data && typeof roll.success_data === "object" && !Array.isArray(roll.success_data) ? roll.success_data : null;
  const combat = roll.combat_data && typeof roll.combat_data === "object" && !Array.isArray(roll.combat_data) ? roll.combat_data : null;
  const phase = combat?.['phase'];
  const outcome = combat?.['outcome'];
  return (
    <div className="space-y-3">
      {combat && <div className="space-y-1 text-sm">
        <p><span className="text-muted-foreground">{phase === "attack" ? "Ataque" : phase === "defense" ? "Defesa" : "Dano"}:</span> <strong>{String(combat['attacker'])}</strong> × <strong>{String(combat['defender'])}</strong>{combat['item'] ? ` · ${String(combat['item'])}` : ""}</p>
        {phase !== "damage" && <p>{String(combat['attribute'])} {String(combat['attribute_value'])} · maior resultado <strong>{String(combat['highest'])}</strong></p>}
        {phase === "defense" && <p>Ataque ({String(combat['attack_attribute'])} {String(combat['attack_value'])}): [{Array.isArray(combat['attack_results']) ? combat['attack_results'].join(", ") : ""}] · maior <strong>{String(combat['attack_highest'])}</strong></p>}
        {combat['tiebreak'] ? <p>Desempate: {String(combat['tiebreak'])}</p> : null}
        {outcome && <p className={outcome === "attacker_won" ? "font-semibold text-primary" : outcome === "defender_won" ? "font-semibold text-destructive" : "font-semibold"}>{outcome === "attacker_won" ? "Atacante vence" : outcome === "defender_won" ? "Defensor vence" : "Empate total — nova rolagem"}</p>}
        {phase === "damage" && <p>Fórmula {String(combat['formula'])} · dano final <strong className="text-primary">{roll.total}</strong></p>}
      </div>}
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