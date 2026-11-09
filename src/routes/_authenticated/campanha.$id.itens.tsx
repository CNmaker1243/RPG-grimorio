import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { campaignQuery, charactersQuery } from "@/lib/rpg";
import { ItemsManager, CharacterItems } from "@/components/Items";
import { useSheetUpdates } from "@/hooks/use-sheet-updates";

export const Route = createFileRoute("/_authenticated/campanha/$id/itens")({
  head: () => ({ meta: [
    { title: "Itens da campanha — Grimório" },
    { name: "description", content: "Itens, bônus, propriedades e fórmulas de dano definidos pela mestra." },
    { property: "og:title", content: "Itens da campanha — Grimório" },
    { property: "og:description", content: "Itens, bônus, propriedades e fórmulas de dano definidos pela mestra." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Itens,
});

function Itens() {
  const { id } = Route.useParams();
  useSheetUpdates(id);
  const camp = useQuery(campaignQuery(id));
  const chars = useQuery(charactersQuery(id));
  if (camp.data?.me?.role === "mestra") return <ItemsManager id={id} />;
  const mine = chars.data?.filter(c => c.owner_id === camp.data?.userId) ?? [];
  return <div className="space-y-6">{!mine.length ? <p className="text-muted-foreground">Você ainda não tem fichas nesta campanha.</p> : mine.map(c => <section key={c.id} className="rounded-lg border border-border bg-card p-5"><h2 className="text-2xl font-semibold">{c.name}</h2><CharacterItems campaignId={id} characterId={c.id} /></section>)}</div>;
}
