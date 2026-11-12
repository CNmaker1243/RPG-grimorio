import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { campaignQuery, charactersQuery, errMsg, type Character } from "@/lib/rpg";
import { sheetsQuery, readFields, readSheet, type Template } from "@/lib/sheets";
import { combatsQuery, itemsQuery, rosterQuery, STATUS_LABEL, type Combat } from "@/lib/combat";

function attributesOf(c: Character | undefined, templates: Template[]) {
  const t = templates.find(t => t.id === c?.template_id);
  const values = c ? readSheet(c.data).values : {};
  return t ? readFields(t.fields).filter(f => f.kind === "attribute").map(f => ({ id: f.id, name: f.name, value: Number(values[f.id] ?? 0) })) : [];
}

function Dice({ results, highest }: { results: number[]; highest: number | null }) {
  let marked = false;
  return <span className="flex flex-wrap gap-1">{results.map((r, i) => { const top = !marked && r === highest; if (top) marked = true; return <span key={i} aria-label={`d20: ${r}`} className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-1 font-mono text-sm font-semibold ${top ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"}`}>{r}</span>; })}</span>;
}

export function CombatPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const camp = useQuery(campaignQuery(id));
  const chars = useQuery(charactersQuery(id));
  const sheets = useQuery(sheetsQuery(id));
  const items = useQuery(itemsQuery(id));
  const roster = useQuery(rosterQuery(id));
  const combats = useQuery(combatsQuery(id));
  const [attacker, setAttacker] = useState("");
  const [attr, setAttr] = useState("");
  const [item, setItem] = useState("none");
  const [defender, setDefender] = useState("");
  const [busy, setBusy] = useState(false);
  const master = camp.data?.me?.role === "mestra";
  const uid = camp.data?.userId;
  const templates = sheets.data?.templates ?? [];
  const mine = chars.data?.filter(c => c.template_id && (c.owner_id === uid || master)) ?? [];
  const a = mine.find(c => c.id === attacker);
  const attrs = attributesOf(a, templates);
  const chosen = attrs.find(x => x.id === attr);
  const weapons = (items.data?.links ?? []).filter(l => l.character_id === attacker).flatMap(l => (items.data?.items ?? []).filter(i => i.id === l.item_id && i.damage_formula));
  const controls = (charId: string | null) => master || roster.data?.some(r => r.id === charId && r.owner_id === uid);

  async function call(fn: () => PromiseLike<{ error: unknown }>, ok?: string) {
    if (busy) return; setBusy(true);
    try { const { error } = await fn(); if (error) throw error; if (ok) toast.success(ok); await Promise.all([qc.invalidateQueries({ queryKey: ["combats", id] }), qc.invalidateQueries({ queryKey: ["rolls", id] })]); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  function attack(e: React.FormEvent) {
    e.preventDefault(); if (!a || !chosen || !defender) return;
    void call(() => supabase.rpc("combat_attack", { _attacker: a.id, _attribute: chosen.id, _defender: defender, ...(item !== "none" ? { _item: item } : {}) }));
  }

  return <section className="space-y-5 border-y border-border py-6" aria-label="Combate">
    <h2 className="flex items-center gap-2 text-3xl"><Swords className="h-6 w-6 text-primary" />Combate</h2>
    <form onSubmit={attack} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Atacante</Label><Select value={attacker} onValueChange={v => { setAttacker(v); setAttr(""); setItem("none"); }}><SelectTrigger aria-label="Atacante"><SelectValue placeholder="Seu personagem" /></SelectTrigger><SelectContent>{mine.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Atributo de ataque</Label><Select value={attr} onValueChange={setAttr} disabled={!a}><SelectTrigger aria-label="Atributo de ataque"><SelectValue placeholder="Selecionar atributo" /></SelectTrigger><SelectContent>{attrs.map(x => <SelectItem key={x.id} value={x.id}>{x.name} ({x.value})</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Item</Label><Select value={item} onValueChange={setItem} disabled={!a}><SelectTrigger aria-label="Item do ataque"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem item</SelectItem>{weapons.map(i => <SelectItem key={i.id} value={i.id}>{i.name} · {i.damage_formula}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Defensor</Label><Select value={defender} onValueChange={setDefender}><SelectTrigger aria-label="Defensor"><SelectValue placeholder="Alvo do ataque" /></SelectTrigger><SelectContent>{roster.data?.filter(r => r.id !== attacker).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {chosen && <p className="font-mono text-sm text-muted-foreground">{chosen.name} {chosen.value} → {chosen.value}d20</p>}
      <Button disabled={busy || !a || !chosen || !defender || chosen.value < 1 || chosen.value > 100}><Swords className="h-4 w-4" />Atacar</Button>
      {chosen && chosen.value < 1 && <p className="text-sm text-destructive">O atributo precisa ser pelo menos 1.</p>}
      {!mine.length && <p className="text-sm text-muted-foreground">Você precisa de uma ficha com modelo para combater.</p>}
    </form>
    {!!combats.data?.length && <ul className="space-y-3">{combats.data.map(cb => <CombatCard key={cb.id} cb={cb} master={master} controlsAttacker={!!controls(cb.attacker_character_id)} controlsDefender={!!controls(cb.defender_character_id)} defenderAttrs={attributesOf(chars.data?.find(c => c.id === cb.defender_character_id), templates)} busy={busy} call={call} />)}</ul>}
  </section>;
}

function CombatCard({ cb, master, controlsAttacker, controlsDefender, defenderAttrs, busy, call }: { cb: Combat; master: boolean; controlsAttacker: boolean; controlsDefender: boolean; defenderAttrs: { id: string; name: string; value: number }[]; busy: boolean; call: (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => Promise<void> }) {
  const [def, setDef] = useState("");
  const open = ["awaiting_defense_attribute", "awaiting_defense", "awaiting_reroll"].includes(cb.status);
  const tone = cb.status === "attacker_won" || cb.status === "damage_rolled" ? "text-primary" : cb.status === "defender_won" ? "text-destructive" : "text-muted-foreground";
  return <li className={`space-y-3 rounded-lg border p-4 ${open || (cb.status === "attacker_won" && cb.damage_formula) ? "border-primary bg-card" : "border-border"}`} data-combat-id={cb.id}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="break-words"><strong>{cb.attacker_name}</strong> ataca <strong>{cb.defender_name}</strong>{cb.item_name && <span className="text-muted-foreground"> com {cb.item_name}</span>}</p><span className={`text-sm font-semibold ${tone}`}>{STATUS_LABEL[cb.status]}{cb.round > 1 && ` · rodada ${cb.round}`}</span></div>
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <div className="space-y-1"><p className="text-muted-foreground"><Swords className="mr-1 inline h-3 w-3" />{cb.attacker_attribute_name} {cb.attacker_value} · {cb.attack_results.length}d20 · maior {cb.attack_highest ?? "—"}</p><Dice results={cb.attack_results} highest={cb.attack_highest} /></div>
      <div className="space-y-1"><p className="text-muted-foreground"><Shield className="mr-1 inline h-3 w-3" />{cb.defender_attribute_name ? `${cb.defender_attribute_name} ${cb.defender_value} · ${cb.defender_value}d20` : "Defesa a definir"}{cb.defense_highest != null && ` · maior ${cb.defense_highest}`}</p><Dice results={cb.defense_results} highest={cb.defense_highest} /></div>
    </div>
    {cb.tiebreak && <p className="text-sm">Desempate: {cb.tiebreak}</p>}
    {cb.damage_total != null && <p className="text-lg">Dano final: <strong className="font-display text-3xl text-primary">{cb.damage_total}</strong> <span className="font-mono text-sm text-muted-foreground">({cb.damage_formula})</span></p>}
    <div className="flex flex-wrap items-center gap-2">
      {cb.status === "awaiting_defense_attribute" && master && <><Select value={def} onValueChange={setDef}><SelectTrigger className="w-56" aria-label={`Atributo de defesa de ${cb.defender_name}`}><SelectValue placeholder="Atributo de defesa" /></SelectTrigger><SelectContent>{defenderAttrs.map(x => <SelectItem key={x.id} value={x.id}>{x.name} ({x.value})</SelectItem>)}</SelectContent></Select><Button disabled={busy || !def} onClick={() => call(() => supabase.rpc("combat_set_defense", { _combat: cb.id, _attribute: def }))}>Definir defesa</Button></>}
      {cb.status === "awaiting_defense_attribute" && !master && <p className="text-sm text-muted-foreground">A mestra escolherá o atributo de defesa.</p>}
      {cb.status === "awaiting_defense" && controlsDefender && <Button disabled={busy} onClick={() => call(() => supabase.rpc("combat_defend", { _combat: cb.id }))}><Shield className="h-4 w-4" />Rolar defesa</Button>}
      {cb.status === "awaiting_reroll" && controlsAttacker && <Button disabled={busy} onClick={() => call(() => supabase.rpc("combat_reroll_attack", { _combat: cb.id }))}><Swords className="h-4 w-4" />Rolar ataque novamente</Button>}
      {cb.status === "attacker_won" && cb.damage_formula && controlsAttacker && <Button disabled={busy} onClick={() => call(() => supabase.rpc("combat_damage", { _combat: cb.id }))}>Rolar dano ({cb.damage_formula})</Button>}
      {open && master && <Button variant="ghost" size="sm" disabled={busy} onClick={() => confirm("Encerrar este combate?") && call(() => supabase.rpc("combat_cancel", { _combat: cb.id }))}>Encerrar</Button>}
    </div>
  </li>;
}
