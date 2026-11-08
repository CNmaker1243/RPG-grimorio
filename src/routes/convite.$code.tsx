import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/rpg";

export const Route = createFileRoute("/convite/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite para campanha — Grimório" },
      { name: "description", content: "Você foi convidado para uma campanha de RPG no Grimório." },
      { property: "og:title", content: "Convite para campanha — Grimório" },
      { property: "og:description", content: "Entre na campanha de RPG com este link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", search: { redirect: `/convite/${code}` }, replace: true });
        return;
      }
      const { data: id, error } = await supabase.rpc("join_campaign", { _code: code });
      if (error) { setError(errMsg(error)); return; }
      navigate({ to: "/campanha/$id", params: { id: id as string }, replace: true });
    })();
  }, [code, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      {error ? <p className="text-destructive">{error}</p> : <p className="text-muted-foreground">Entrando na campanha...</p>}
    </div>
  );
}
