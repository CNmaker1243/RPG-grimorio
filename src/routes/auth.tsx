import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { safeRedirect, errMsg } from "@/lib/rpg";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar — Grimório" },
      { name: "description", content: "Entre ou crie sua conta no Grimório." },
      { property: "og:title", content: "Entrar — Grimório" },
      { property: "og:description", content: "Acesse suas campanhas de RPG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const STORE = "grimorio_redirect";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const target = safeRedirect(redirect);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (redirect) sessionStorage.setItem(STORE, target);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const t = safeRedirect(sessionStorage.getItem(STORE) ?? target);
        sessionStorage.removeItem(STORE);
        navigate({ to: t, replace: true });
      }
    });
    const { data } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === "SIGNED_IN" && session) {
        const t = safeRedirect(sessionStorage.getItem(STORE) ?? target);
        sessionStorage.removeItem(STORE);
        navigate({ to: t, replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
            data: { display_name: name.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    sessionStorage.setItem(STORE, target);
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
      if (r.error) toast.error(errMsg(r.error));
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-glow sm:p-8">
        <Link to="/" className="flex items-center justify-center gap-2 font-display text-3xl font-bold text-primary">
          <Dices className="h-7 w-7" /> Grimório
        </Link>
        {sent ? (
          <p className="mt-6 text-center text-muted-foreground">
            Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>. Confirme seu e-mail para entrar.
          </p>
        ) : (
          <>
            <h1 className="mt-4 text-center text-2xl font-semibold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "up" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome de exibição</Label>
                  <Input id="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Aguarde..." : mode === "in" ? "Entrar" : "Cadastrar"}
              </Button>
            </form>
            <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
            <button
              type="button"
              onClick={google}
              className="flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-foreground px-3 py-2 text-sm font-medium text-background"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
              Continuar com Google
            </button>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "in" ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                {mode === "in" ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
