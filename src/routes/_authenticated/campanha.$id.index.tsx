import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Dices, Loader2, Minus, Plus, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiceResults } from "@/components/DiceResults";
import { supabase } from "@/integrations/supabase/client";
import { campaignQuery, charactersQuery, membersQuery, rollsQuery, errMsg, type DiceRoll } from "@/lib/rpg";
import { DICE_SIDES, diceExpression, validateDice, type RollMode } from "@/lib/dice";

export const Route = createFileRoute("/_authenticated/campanha/$id/")({
  head: () => ({ meta: [
    { title: "Dados e rolagens — Grimório" },
    { name: "description", content: "Rolagens individuais e combinadas com resultados e histórico ao vivo da campanha." },
    { property: "og:title", content: "Dados e rolagens — Grimório" },
    { property: "og:description", content: "Rolagens individuais e combinadas com resultados e histórico ao vivo da campanha." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Sala,
});

function Sala() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const members = useQuery(membersQuery(id));
  const camp = useQuery(campaignQuery(id));
  const chars = useQuery(charactersQuery(id));
  const [mode, setMode] = useState<RollMode>("individual");
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [quantities, setQuantities] = useState<Record<number, number>>({6: 2, 8: 1});
  const [mod, setMod] = useState(0);
  const [label, setLabel] = useState("");
  const [character, setCharacter] = useState("none");
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<DiceRoll | null>(null);
  const [live, setLive] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(50);
  const history = useQuery(rollsQuery(id, historyLimit));
  const dice = mode === "individual" ? [{sides, count}] : DICE_SIDES.flatMap(d => (quantities[d] ?? 0) > 0 ? [{sides:d, count:quantities[d] ?? 0}] : []);
  const validation = validateDice(dice, mode);
  const expression = diceExpression(dice, mod);
  const characterOptions = chars.data?.filter(c => c.owner_id === camp.data?.userId || camp.data?.me?.role === "mestra") ?? [];

  useEffect(() => {
    setLatest(null);
    const ch = supabase.channel(`rolls-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dice_rolls", filter: `campaign_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["rolls", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_members", filter: `campaign_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["members", id] }))
      .subscribe(status => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  async function roll(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (validation) { toast.error(validation); return; }
    if (!Number.isInteger(mod) || Math.abs(mod) > 10000) { toast.error("Modificador inválido."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("roll_dice_combined", {
        _campaign: id, _dice: dice, _mode: mode, _modifier: mod, _label: label,
        ...character !== "none" ? {_character: character} : {},
      });
      if (error) throw error;
      if (data) setLatest(data);
      await qc.invalidateQueries({ queryKey: ["rolls", id] });
    } catch (error) { toast.error(errMsg(error)); }
    finally { setBusy(false); }
  }

  const nameOf = (r: DiceRoll) => r.roller_name || members.data?.find(m => m.user_id === r.user_id)?.name || "Alguém";
  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0 space-y-8">
        <form onSubmit={roll} className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Dices className="h-6 w-6 text-primary" /> Rolador de dados</h2>
            <Tabs value={mode} onValueChange={v => setMode(v === "combined" ? "combined" : "individual")}>
              <TabsList aria-label="Modalidade de rolagem"><TabsTrigger value="individual">Individual</TabsTrigger><TabsTrigger value="combined">Combinada</TabsTrigger></TabsList>
            </Tabs>
          </div>
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            {mode === "individual" ? <>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DICE_SIDES.map(d => <Button key={d} type="button" aria-pressed={sides === d} variant={sides === d ? "default" : "secondary"} className="h-14 font-mono text-lg" onClick={() => setSides(d)}>d{d}</Button>)}
              </div>
              <div className="max-w-48 space-y-2"><Label htmlFor="qt">Quantidade</Label><Input id="qt" required type="number" min={1} max={100} step={1} value={Number.isNaN(count) ? "" : count} onChange={e => setCount(e.target.valueAsNumber)} /></div>
            </> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DICE_SIDES.map(d => <div key={d} className={`space-y-3 rounded-md border p-3 ${(quantities[d] ?? 0) > 0 ? "border-primary bg-secondary" : "border-border"}`}>
                <Label htmlFor={`dice-${d}`} className="block font-mono text-xl">d{d}</Label>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={`Diminuir d${d}`} aria-label={`Diminuir d${d}`} disabled={!quantities[d]} onClick={() => setQuantities(q => ({...q,[d]:Math.max(0,(q[d] || 0)-1)}))}><Minus className="h-4 w-4" /></Button>
                  <Input id={`dice-${d}`} aria-label={`Quantidade de d${d}`} type="number" min={0} max={100} step={1} className="min-w-0 px-1 text-center" value={quantities[d] || 0} onChange={e => setQuantities(q => ({...q,[d]: e.target.valueAsNumber}))} />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={`Adicionar d${d}`} aria-label={`Adicionar d${d}`} disabled={(quantities[d] || 0) >= 100} onClick={() => setQuantities(q => ({...q,[d]:(q[d] || 0)+1}))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>)}
            </div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2"><Label htmlFor="character">Personagem</Label><Select value={character} onValueChange={setCharacter}><SelectTrigger id="character"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem personagem</SelectItem>{characterOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="md">Modificador</Label><Input id="md" required type="number" min={-10000} max={10000} step={1} value={Number.isNaN(mod) ? "" : mod} onChange={e => setMod(e.target.valueAsNumber)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="lb">Descrição</Label><Input id="lb" maxLength={120} value={label} onChange={e => setLabel(e.target.value)} placeholder="Ataque, percepção…" /></div>
            </div>
          </fieldset>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-words font-mono text-sm text-muted-foreground">{dice.length ? expression : "Nenhum dado selecionado"}</p>
            <Button type="submit" disabled={busy || !!validation} className="shrink-0 shadow-glow">{busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Dices className="h-4 w-4" />}{busy ? "Rolando…" : "Rolar dados"}</Button>
          </div>
          {validation && <p role="status" className="text-sm text-destructive">{validation}</p>}
        </form>
        {latest && <section aria-label="Último resultado" aria-live="polite" className="space-y-4 border-y border-primary py-5">
          <div className="flex items-center justify-between gap-4"><div className="min-w-0"><h2 className="text-2xl font-semibold">Seu resultado</h2><p className="break-words font-mono text-sm text-muted-foreground">{latest.expression}</p></div><div className="shrink-0 text-right"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="font-display text-5xl font-bold text-primary" data-testid="latest-total">{latest.total}</p></div></div>
          <DiceResults roll={latest} />
        </section>}
        <section className="min-w-0" aria-label="Histórico de rolagens">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-semibold">Histórico de rolagens</h2><span className="flex items-center gap-1 text-xs text-muted-foreground"><Radio className={`h-3 w-3 ${live ? "text-primary" : "text-muted-foreground"}`} />{live ? "Ao vivo" : "Reconectando…"}</span></div>
          {history.isPending ? <p className="text-sm text-muted-foreground">Carregando rolagens…</p> : history.isError ? <div className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar o histórico.</p><Button variant="secondary" onClick={() => history.refetch()}>Tentar novamente</Button></div> : !history.data?.length ? <p className="py-5 text-sm text-muted-foreground">Nenhuma rolagem ainda.</p> : <ol className="divide-y divide-border">
            {history.data.map(r => <li key={r.id} className="space-y-3 py-5" data-roll-id={r.id}>
              <div className="flex items-start justify-between gap-4"><div className="min-w-0 space-y-1"><p className="break-words text-sm"><strong>{nameOf(r)}</strong>{r.character_name && <span className="text-muted-foreground"> · {r.character_name}</span>}</p><p className="break-words font-mono text-sm">{r.expression}</p><p className="text-xs text-muted-foreground">{r.roll_mode === "combined" ? "Combinada" : "Individual"} · <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString("pt-BR")}</time></p>{r.label && <p className="break-words text-sm text-muted-foreground">{r.label}</p>}</div><div className="shrink-0 text-right"><p className="text-xs text-muted-foreground">Total</p><p className="font-display text-3xl font-bold text-primary">{r.total}</p></div></div>
              <DiceResults roll={r} />
            </li>)}
          </ol>}
          {history.data && history.data.length >= historyLimit && <Button variant="secondary" className="mt-4" onClick={() => setHistoryLimit(n => n + 50)}>Carregar mais</Button>}
        </section>
      </div>
      <aside className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><h2 className="mb-4 text-2xl font-semibold">Participantes</h2>{members.isError ? <p className="text-sm text-destructive">Participantes indisponíveis.</p> : <ul className="space-y-3">{members.data?.map(m => <li key={m.id} className="flex items-center gap-2 text-sm">{m.role === "mestra" && <Crown className="h-4 w-4 shrink-0 text-primary" />}<span className="min-w-0 break-words">{m.name}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{m.role === "mestra" ? "Mestra" : "Jogador"}</span></li>)}</ul>}</aside>
    </div>
  );
}
