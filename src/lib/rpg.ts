import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type Member = Database["public"]["Tables"]["campaign_members"]["Row"];
export type Character = Database["public"]["Tables"]["characters"]["Row"];
export type DiceRoll = Database["public"]["Tables"]["dice_rolls"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function safeRedirect(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(path)) return "/painel";
  return path;
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Algo deu errado";
}

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createCampaign(name: string) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Entre para criar uma campanha.");
  const id = crypto.randomUUID();
  const { error } = await supabase.from("campaigns").insert({ id, name: name.trim(), owner_id: uid });
  if (error) throw error;
  return id;
}

export const myCampaignsQuery = () =>
  queryOptions({
    queryKey: ["my-campaigns"],
    queryFn: async () => {
      const uid = await currentUserId();
      if (!uid) throw new Error("Entre para acessar suas campanhas.");
      const { data, error } = await supabase
        .from("campaign_members")
        .select("role, campaign:campaigns(*)")
        .eq("user_id", uid)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r) => r.campaign) as { role: Member["role"]; campaign: Campaign }[];
    },
  });

export const campaignQuery = (id: string) =>
  queryOptions({
    queryKey: ["campaign", id],
    refetchInterval: 30000,
    queryFn: async () => {
      const uid = await currentUserId();
      if (!uid) throw new Error("Entre para acessar a campanha.");
      const { data: campaign, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!campaign) return null;
      const { data: me } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", id)
        .eq("user_id", uid)
        .maybeSingle();
      return { campaign, me, userId: uid };
    },
  });

export const membersQuery = (id: string) =>
  queryOptions({
    queryKey: ["members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", id)
        .order("joined_at");
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("*").in("id", ids)
        : { data: [] as Profile[] };
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((m) => ({ ...m, name: byId.get(m.user_id)?.display_name || "Sem nome" }));
    },
  });

export const charactersQuery = (campaignId: string) =>
  queryOptions({
    queryKey: ["characters", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

export const rollsQuery = (campaignId: string, limit = 50) =>
  queryOptions({
    queryKey: ["rolls", campaignId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dice_rolls")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
