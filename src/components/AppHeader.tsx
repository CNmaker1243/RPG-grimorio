import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold text-primary">
          <Dices className="h-6 w-6" /> Grimório
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link to="/painel" className="rounded-md px-3 py-2 hover:bg-secondary" activeProps={{ className: "text-primary" }}>
            Painel
          </Link>
          <Link to="/fichas" className="rounded-md px-3 py-2 hover:bg-secondary" activeProps={{ className: "text-primary" }}>
            Minhas fichas
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
