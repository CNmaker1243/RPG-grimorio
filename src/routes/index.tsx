import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dices, ScrollText, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grimório — Gerencie suas campanhas de RPG" },
      { name: "description", content: "Crie campanhas, convide jogadores, gerencie fichas e role dados em tempo real." },
      { property: "og:title", content: "Grimório — Campanhas de RPG de mesa" },
      { property: "og:description", content: "Campanhas, fichas e rolagens para qualquer sistema de RPG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  const features = [
    { icon: Users, t: "Campanhas e convites", d: "Crie mesas e chame jogadores com um código ou link." },
    { icon: Shield, t: "Papéis por campanha", d: "Mestra em uma, jogadora em outra. Permissões garantidas no servidor." },
    { icon: ScrollText, t: "Fichas privadas", d: "Cada jogador vê apenas as próprias fichas; a mestra vê todas." },
    { icon: Dices, t: "Rolagens ao vivo", d: "Histórico público de rolagens atualizado em tempo real." },
  ];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center px-4 py-5">
        <span className="flex items-center gap-2 font-display text-2xl font-bold text-primary">
          <Dices className="h-6 w-6" /> Grimório
        </span>
        <div className="ml-auto">
          {signedIn ? (
            <Button asChild><Link to="/painel">Ir para o painel</Link></Button>
          ) : (
            <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
          )}
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-20 text-center">
        <h1 className="text-5xl font-bold leading-tight text-foreground sm:text-7xl">
          Sua mesa de RPG, <span className="text-primary">organizada</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Um grimório para qualquer sistema: a mestra define as regras, os jogadores cuidam das próprias fichas.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="shadow-glow">
            <Link to={signedIn ? "/painel" : "/auth"}>{signedIn ? "Abrir painel" : "Começar agora"}</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.t} className="rounded-lg border border-border bg-card p-5">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 text-xl font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
