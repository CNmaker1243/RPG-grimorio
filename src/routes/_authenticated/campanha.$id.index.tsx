import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { membersQuery, rollsQuery, errMsg } from "@/lib/rpg";

export const Route = createFileRoute("/_authenticated/campanha/$id/")({
  component: Sala,
});

const DICE = [4, 6, 8, 10, 12, 20, 100];

function Sala() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const members = useQuery(membersQuery(id));
  const rolls = useQuery(rollsQuery(id));
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [mod, setMod] = useState(0);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel(`rolls-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dice_rolls", filter: `campaign_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["rolls", id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_members", filter: `campaign_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["members", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  async function roll(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("roll_dice", {
      _campaign: id, _count: count, _sides: sides, _modifier: mod, _label: label,
    });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["rolls", id] });
  }

  const nameOf = (uid: string) => members.data?.find((m) => m.user_id === uid)?.name ?? "Alguém";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <form onSubmit={roll} className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><Dices className="h-5 w-5 text-primary" /> Rolador de dados</h2>
          <div className="flex flex-wrap gap-2">
            {DICE.map((d) => (
              <Button key={d} type="button" size="sm" variant={sides === d ? "default" : "secondary"} onClick={() => setSides(d)}>
                d{d}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1"><Label htmlFor="qt">Quantidade</Label>
              <Input id="qt" type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="fc">Faces</Label>
              <Input id="fc" type="number" min={2} max={1000} value={sides} onChange={(e) => setSides(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="md">Modificador</Label>
              <Input id="md" type="number" value={mod} onChange={(e) => setMod(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="lb">Descrição</Label>
              <Input id="lb" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="opcional" /></div>
          </div>
          <Button type="submit" disabled={busy} className="shadow-glow">
            Rolar {count}d{sides}{mod > 0 ? `+${mod}` : mod < 0 ? mod : ""}
          </Button>
        </form>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-2xl font-semibold">Histórico de rolagens</h2>
          {!rolls.data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma rolagem ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rolls.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <strong>{nameOf(r.user_id)}</strong> rolou <span className="font-mono">{r.expression}</span>
                      {r.label && <span className="text-muted-foreground"> — {r.label}</span>}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      [{r.results.join(", ")}]{r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} ·{" "}
                      {new Date(r.created_at).toLocaleTimeString("pt-BR")}
                    </p>
                  </div>
                  <span className="font-display text-3xl font-bold text-primary">{r.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-2xl font-semibold">Participantes</h2>
        <ul className="space-y-2">
          {members.data?.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              {m.role === "mestra" && <Crown className="h-4 w-4 text-primary" />}
              <span>{m.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{m.role === "mestra" ? "Mestra" : "Jogador"}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
