import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { campaignQuery, membersQuery, errMsg } from "@/lib/rpg";

export const Route = createFileRoute("/_authenticated/campanha/$id/mestra")({
  head: () => ({ meta: [
    { title: "Painel da mestra — Grimório" },
    { name: "description", content: "Configurações, convites e participantes da campanha no Grimório." },
    { property: "og:title", content: "Painel da mestra — Grimório" },
    { property: "og:description", content: "Configurações, convites e participantes da campanha no Grimório." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PainelMestra,
});

function PainelMestra() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const camp = useQuery(campaignQuery(id));
  const members = useQuery(membersQuery(id));
  const c = camp.data?.campaign;
  const [name, setName] = useState("");
  const [limit, setLimit] = useState(1);
  useEffect(() => {
    if (c) { setName(c.name); setLimit(c.max_characters_per_player); }
  }, [c]);

  if (camp.data?.me?.role !== "mestra") return <p className="text-muted-foreground">Área exclusiva da mestra.</p>;
  if (!c) return null;
  const link = `${window.location.origin}/convite/${c.invite_code}`;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["campaign", id] });
    qc.invalidateQueries({ queryKey: ["members", id] });
    qc.invalidateQueries({ queryKey: ["my-campaigns"] });
  };

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("campaigns").update({ name: name.trim(), max_characters_per_player: limit }).eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Configurações salvas");
    refresh();
  }
  async function regen() {
    const { error } = await supabase.rpc("regenerate_invite", { _campaign: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Novo código gerado; o anterior deixou de funcionar");
    refresh();
  }
  async function updateMember(mid: string, patch: { can_create_characters?: boolean; max_characters?: number | null }) {
    const { error } = await supabase.from("campaign_members").update(patch).eq("id", mid);
    if (error) { toast.error(errMsg(error)); return; }
    refresh();
  }
  async function removeMember(mid: string, n: string) {
    if (!confirm(`Remover ${n} da campanha?`)) return;
    const { error } = await supabase.from("campaign_members").delete().eq("id", mid);
    if (error) { toast.error(errMsg(error)); return; }
    refresh();
  }
  async function deleteCampaign() {
    if (!confirm("Excluir a campanha e todos os dados dela? Isso não pode ser desfeito.")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["my-campaigns"] });
    navigate({ to: "/painel" });
  }
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl font-semibold">Convite</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-lg tracking-widest">{c.invite_code}</span>
          <Button variant="secondary" size="sm" onClick={() => copy(c.invite_code)}><Copy className="h-4 w-4" /> Código</Button>
          <Button variant="secondary" size="sm" onClick={() => copy(link)}><Copy className="h-4 w-4" /> Link</Button>
          <Button variant="ghost" size="sm" onClick={regen}><RefreshCw className="h-4 w-4" /> Gerar novo</Button>
        </div>
        <p className="break-all text-xs text-muted-foreground">{link}</p>
      </section>

      <form onSubmit={saveSettings} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl font-semibold">Configurações da campanha</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="n">Nome</Label>
            <Input id="n" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="l">Fichas por jogador (padrão)</Label>
            <Input id="l" type="number" min={0} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></div>
        </div>
        <Button type="submit">Salvar</Button>
      </form>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-2xl font-semibold">Jogadores</h2>
        <ul className="divide-y divide-border">
          {members.data?.filter((m) => m.role === "jogador").map((m) => (
            <li key={m.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <span className="font-medium sm:w-48">{m.name}</span>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={m.can_create_characters} onCheckedChange={(v) => updateMember(m.id, { can_create_characters: v })} />
                Pode criar fichas
              </label>
              <label className="flex items-center gap-2 text-sm">
                Limite próprio
                <Input
                  type="number" min={0} max={50} className="w-20"
                  defaultValue={m.max_characters ?? ""} placeholder={String(c.max_characters_per_player)}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== m.max_characters) updateMember(m.id, { max_characters: v });
                  }}
                />
              </label>
              <Button variant="ghost" size="sm" className="sm:ml-auto" onClick={() => removeMember(m.id, m.name)}>
                <UserMinus className="h-4 w-4" /> Remover
              </Button>
            </li>
          ))}
          {!members.data?.some((m) => m.role === "jogador") && (
            <li className="py-2 text-sm text-muted-foreground">Nenhum jogador ainda. Compartilhe o convite.</li>
          )}
        </ul>
      </section>

      {camp.data.userId === c.owner_id && (
        <section className="rounded-lg border border-destructive/50 bg-card p-5">
          <h2 className="text-2xl font-semibold text-destructive">Zona de perigo</h2>
          <Button variant="destructive" className="mt-3" onClick={deleteCampaign}>Excluir campanha</Button>
        </section>
      )}
    </div>
  );
}
