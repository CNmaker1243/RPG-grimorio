import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/rpg";
import { Button } from "@/components/ui/button";

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
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    let active = true;
    setError(null);
    setSignedOut(false);
    (async () => {
      try {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        setSignedOut(true);
        return;
      }
      const { data: id, error } = await supabase.rpc("join_campaign", { _code: code });
      if (!active) return;
      if (error) { setError(errMsg(error)); return; }
      if (!id) { setError("Não foi possível entrar na campanha."); return; }
      navigate({ to: "/campanha/$id", params: { id }, replace: true });
      } catch (e) { if (active) setError(errMsg(e)); }
    })();
    return () => { active = false; };
  }, [code, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div className="space-y-4">
        {signedOut ? <Button asChild><Link to="/auth" search={{redirect:`/convite/${encodeURIComponent(code)}`}}>Entrar para aceitar convite</Link></Button> : error ? <p role="alert" className="text-destructive">{error}</p> : <p className="text-muted-foreground">Entrando na campanha...</p>}
        {error && <Button asChild variant="secondary"><Link to="/painel">Voltar ao painel</Link></Button>}
      </div>
    </div>
  );
}
