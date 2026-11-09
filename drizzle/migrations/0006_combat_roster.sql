CREATE OR REPLACE FUNCTION public.combat_roster(_campaign uuid) RETURNS TABLE(id uuid,name text,owner_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.name,c.owner_id FROM public.characters c WHERE c.campaign_id=_campaign AND c.template_id IS NOT NULL AND public.is_member(_campaign,auth.uid()) ORDER BY c.name
$$;
REVOKE ALL ON FUNCTION public.combat_roster(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_roster(uuid) TO authenticated;