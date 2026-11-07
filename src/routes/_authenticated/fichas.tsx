import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "@/lib/rpg";

export const Route = createFileRoute("/_authenticated/fichas")({
  head: () => ({
    meta: [
      { title: "Minhas fichas — Grimório" },
      { name: "description", content: "Todas as suas fichas de personagem." },
      { property: "og:title", content: "Minhas fichas — Grimório" },
      { property: "og:description", content: "Todas as suas fichas de personagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MinhasFichas,
});

function MinhasFichas() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-characters"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("characters")
        .select("*, campaign:campaigns(name)")
        .eq("owner_id", uid!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold">Minhas fichas</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <p className="text-muted-foreground">Nenhuma ficha ainda. Crie uma dentro de uma campanha.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link
              key={c.id}
              to="/campanha/$id/fichas"
              params={{ id: c.campaign_id }}
              className="rounded-lg border border-border bg-card p-5 hover:border-primary"
            >
              <h3 className="text-2xl font-semibold">{c.name}</h3>
              <p className="text-sm text-muted-foreground">{c.campaign?.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
