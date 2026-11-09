import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { campaignQuery, charactersQuery, membersQuery, errMsg, type Character } from "@/lib/rpg";

export const Route = createFileRoute("/_authenticated/campanha/$id/fichas")({
  head: () => ({ meta: [
    { title: "Fichas da campanha — Grimório" },
    { name: "description", content: "Personagens e anotações da sua campanha de RPG." },
    { property: "og:title", content: "Fichas da campanha — Grimório" },
    { property: "og:description", content: "Personagens e anotações da sua campanha de RPG." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Fichas,
});

function Fichas() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const camp = useQuery(campaignQuery(id));
  const chars = useQuery(charactersQuery(id));
  const members = useQuery(membersQuery(id));
  const [name, setName] = useState("");
  const isMestra = camp.data?.me?.role === "mestra";
  const me = camp.data?.me;
  const limit = me?.max_characters ?? camp.data?.campaign.max_characters_per_player ?? 0;
  const mine = chars.data?.filter((c) => c.owner_id === camp.data?.userId) ?? [];
  const canCreate = isMestra || (me?.can_create_characters && mine.length < limit);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("characters")
      .insert({ campaign_id: id, owner_id: camp.data!.userId, name: name.trim() });
    if (error) { toast.error(errMsg(error)); return; }
    setName("");
    qc.invalidateQueries({ queryKey: ["characters", id] });
  }

  const ownerName = (uid: string) => members.data?.find((m) => m.user_id === uid)?.name ?? "";

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="cn">Nova ficha</Label>
          <Input id="cn" required maxLength={120} placeholder="Nome do personagem" value={name} onChange={(e) => setName(e.target.value)} disabled={!canCreate} />
          {!isMestra && (
            <p className="text-xs text-muted-foreground">
              {me?.can_create_characters ? `Você usou ${mine.length} de ${limit} fichas permitidas.` : "A mestra desativou a criação de fichas para você."}
            </p>
          )}
        </div>
        <Button type="submit" disabled={!canCreate || !name.trim()}><Plus className="h-4 w-4" /> Criar</Button>
      </form>

      {!chars.data?.length ? (
        <p className="text-muted-foreground">Nenhuma ficha.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {chars.data.map((c) => (
            <CharacterCard key={c.id} c={c} owner={isMestra ? ownerName(c.owner_id) : ""} />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterCard({ c, owner }: { c: Character; owner: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(c.name);
  const [notes, setNotes] = useState(c.notes);
  const dirty = name !== c.name || notes !== c.notes;

  async function save() {
    const { error } = await supabase.from("characters").update({ name: name.trim(), notes }).eq("id", c.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Ficha salva");
    qc.invalidateQueries({ queryKey: ["characters", c.campaign_id] });
  }
  async function remove() {
    if (!confirm(`Excluir a ficha "${c.name}"?`)) return;
    const { error } = await supabase.from("characters").delete().eq("id", c.id);
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["characters", c.campaign_id] });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      {owner && <p className="text-xs text-muted-foreground">Jogador: {owner}</p>}
      <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="font-display text-xl" />
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações da ficha" rows={4} />
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={remove}><Trash2 className="h-4 w-4" /> Excluir</Button>
        <Button size="sm" onClick={save} disabled={!dirty || !name.trim()}>Salvar</Button>
      </div>
    </div>
  );
}
