import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Crown, Plus, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { myCampaignsQuery, errMsg, currentUserId } from "@/lib/rpg";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Grimório" },
      { name: "description", content: "Suas campanhas de RPG." },
      { property: "og:title", content: "Painel — Grimório" },
      { property: "og:description", content: "Suas campanhas de RPG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data, isLoading } = useQuery(myCampaignsQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const uid = await currentUserId();
    const { data: c, error } = await supabase
      .from("campaigns")
      .insert({ name: name.trim(), owner_id: uid! })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setName("");
    qc.invalidateQueries({ queryKey: ["my-campaigns"] });
    navigate({ to: "/campanha/$id", params: { id: c.id } });
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: id, error } = await supabase.rpc("join_campaign", { _code: code });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setCode("");
    qc.invalidateQueries({ queryKey: ["my-campaigns"] });
    navigate({ to: "/campanha/$id", params: { id: id as string } });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Painel</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={create} className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><Plus className="h-5 w-5 text-primary" /> Nova campanha</h2>
          <Label htmlFor="cname">Nome da campanha</Label>
          <Input id="cname" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={busy || !name.trim()}>Criar como mestra</Button>
        </form>
        <form onSubmit={join} className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><LogIn className="h-5 w-5 text-primary" /> Entrar com convite</h2>
          <Label htmlFor="code">Código de convite</Label>
          <Input id="code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono tracking-widest" />
          <Button type="submit" variant="secondary" disabled={busy || !code.trim()}>Entrar como jogador</Button>
        </form>
      </div>

      <section>
        <h2 className="mb-3 text-3xl font-semibold">Minhas campanhas</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !data?.length ? (
          <p className="text-muted-foreground">Você ainda não participa de nenhuma campanha.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map(({ role, campaign }) => (
              <Link
                key={campaign.id}
                to="/campanha/$id"
                params={{ id: campaign.id }}
                className="rounded-lg border border-border bg-card p-5 transition hover:border-primary hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-2xl font-semibold">{campaign.name}</h3>
                  <Badge variant={role === "mestra" ? "default" : "secondary"} className="shrink-0">
                    {role === "mestra" ? <Crown className="mr-1 h-3 w-3" /> : <User className="mr-1 h-3 w-3" />}
                    {role === "mestra" ? "Mestra" : "Jogador"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
