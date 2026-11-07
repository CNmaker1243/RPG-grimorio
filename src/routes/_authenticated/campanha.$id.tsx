import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { campaignQuery } from "@/lib/rpg";

export const Route = createFileRoute("/_authenticated/campanha/$id")({
  head: () => ({
    meta: [
      { title: "Sala da campanha — Grimório" },
      { name: "description", content: "Sala da campanha de RPG." },
      { property: "og:title", content: "Sala da campanha — Grimório" },
      { property: "og:description", content: "Sala da campanha de RPG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampaignLayout,
});

export function useCampaign() {
  const { id } = Route.useParams();
  return useQuery(campaignQuery(id));
}

function CampaignLayout() {
  const { id } = Route.useParams();
  const { data, isLoading } = useCampaign();
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!data || !data.me)
    return <p className="text-muted-foreground">Campanha não encontrada ou você não participa dela.</p>;
  const isMestra = data.me.role === "mestra";
  const tab = "rounded-md px-3 py-2 text-sm hover:bg-secondary";
  const active = { className: "bg-secondary text-primary" };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{isMestra ? "Você é a mestra" : "Você é jogador"}</p>
        <h1 className="text-4xl font-bold">{data.campaign.name}</h1>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
        <Link to="/campanha/$id" params={{ id }} activeOptions={{ exact: true }} className={tab} activeProps={active}>
          Sala & dados
        </Link>
        <Link to="/campanha/$id/fichas" params={{ id }} className={tab} activeProps={active}>
          {isMestra ? "Fichas" : "Minhas fichas"}
        </Link>
        {isMestra && (
          <Link to="/campanha/$id/mestra" params={{ id }} className={`${tab} flex items-center gap-1`} activeProps={active}>
            <Crown className="h-4 w-4" /> Painel da mestra
          </Link>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
