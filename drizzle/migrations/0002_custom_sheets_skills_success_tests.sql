CREATE TABLE public.sheet_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, name text NOT NULL, fields jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sheet_templates TO authenticated; GRANT ALL ON public.sheet_templates TO service_role;
ALTER TABLE public.sheet_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_read ON public.sheet_templates FOR SELECT TO authenticated USING(public.is_member(campaign_id,auth.uid()));
CREATE POLICY templates_manage ON public.sheet_templates FOR ALL TO authenticated USING(public.is_mestra(campaign_id,auth.uid())) WITH CHECK(public.is_mestra(campaign_id,auth.uid()));
CREATE TABLE public.sheet_skills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES public.sheet_templates(id) ON DELETE CASCADE, name text NOT NULL, description text NOT NULL DEFAULT '', attribute_id text NOT NULL, max_level integer NOT NULL DEFAULT 5);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sheet_skills TO authenticated; GRANT ALL ON public.sheet_skills TO service_role;
ALTER TABLE public.sheet_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY skills_read ON public.sheet_skills FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.sheet_templates t WHERE t.id=template_id AND public.is_member(t.campaign_id,auth.uid())));
CREATE POLICY skills_manage ON public.sheet_skills FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.sheet_templates t WHERE t.id=template_id AND public.is_mestra(t.campaign_id,auth.uid()))) WITH CHECK(EXISTS(SELECT 1 FROM public.sheet_templates t WHERE t.id=template_id AND public.is_mestra(t.campaign_id,auth.uid())));
CREATE TABLE public.member_template_limits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.campaign_members(id) ON DELETE CASCADE, template_id uuid NOT NULL REFERENCES public.sheet_templates(id) ON DELETE CASCADE, max_characters integer NOT NULL DEFAULT 1, UNIQUE(member_id,template_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.member_template_limits TO authenticated; GRANT ALL ON public.member_template_limits TO service_role;
ALTER TABLE public.member_template_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY limits_read ON public.member_template_limits FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.campaign_members m WHERE m.id=member_id AND public.is_member(m.campaign_id,auth.uid())));
CREATE POLICY limits_manage ON public.member_template_limits FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.campaign_members m WHERE m.id=member_id AND public.is_mestra(m.campaign_id,auth.uid()))) WITH CHECK(EXISTS(SELECT 1 FROM public.campaign_members m JOIN public.sheet_templates t ON t.id=template_id AND t.campaign_id=m.campaign_id WHERE m.id=member_id AND public.is_mestra(m.campaign_id,auth.uid())));
ALTER TABLE public.characters ADD COLUMN template_id uuid REFERENCES public.sheet_templates(id) ON DELETE RESTRICT;
CREATE TABLE public.success_tests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, skill_id uuid NOT NULL REFERENCES public.sheet_skills(id) ON DELETE CASCADE, name text NOT NULL, difficulty integer NOT NULL DEFAULT 2);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.success_tests TO authenticated; GRANT ALL ON public.success_tests TO service_role;
ALTER TABLE public.success_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tests_read ON public.success_tests FOR SELECT TO authenticated USING(public.is_member(campaign_id,auth.uid()));
CREATE POLICY tests_manage ON public.success_tests FOR ALL TO authenticated USING(public.is_mestra(campaign_id,auth.uid())) WITH CHECK(public.is_mestra(campaign_id,auth.uid()));
ALTER TABLE public.dice_rolls ADD COLUMN success_data jsonb;
CREATE OR REPLACE FUNCTION public.validate_sheet_values(_template uuid,_data jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE f jsonb; s public.sheet_skills; v jsonb; k text; fs jsonb;
BEGIN
 IF jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'Valores da ficha inválidos'; END IF;
 SELECT fields INTO fs FROM public.sheet_templates WHERE id=_template;
 IF _data ? 'values' AND jsonb_typeof(_data->'values') <> 'object' THEN RAISE EXCEPTION 'Campos inválidos'; END IF;
 IF _data ? 'skills' AND jsonb_typeof(_data->'skills') <> 'object' THEN RAISE EXCEPTION 'Perícias inválidas'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(fs) LOOP
  v:=_data->'values'->(f->>'id');
  IF v IS NULL THEN CONTINUE; END IF;
  IF f->>'kind' IN ('attribute','number') THEN
   IF jsonb_typeof(v)<>'number' OR v::text !~ '^[0-9]+$' OR (v::text)::numeric>100 THEN RAISE EXCEPTION 'Campo %: use um inteiro entre 0 e 100',f->>'name'; END IF;
  ELSIF jsonb_typeof(v)<>'string' OR length(v#>>'{}')>10000 THEN RAISE EXCEPTION 'Texto inválido'; END IF;
 END LOOP;
 FOR k,v IN SELECT * FROM jsonb_each(coalesce(_data->'skills','{}')) LOOP
  SELECT * INTO s FROM public.sheet_skills WHERE id::text=k AND template_id=_template;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF jsonb_typeof(v)<>'number' OR v::text !~ '^[0-9]+$' OR (v::text)::numeric>s.max_level THEN RAISE EXCEPTION 'Perícia %: nível máximo %',s.name,s.max_level; END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.sheet_structure_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f jsonb; seen text[]:='{}'; ch public.characters;
BEGIN
 IF TG_TABLE_NAME='sheet_templates' THEN
  IF TG_OP='UPDATE' AND NEW.campaign_id<>OLD.campaign_id THEN RAISE EXCEPTION 'Não é permitido mover modelos'; END IF;
  IF length(trim(NEW.name)) NOT BETWEEN 1 AND 120 OR jsonb_typeof(NEW.fields)<>'array' OR jsonb_array_length(NEW.fields)>100 THEN RAISE EXCEPTION 'Modelo inválido'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(NEW.fields) LOOP
   IF coalesce(f->>'id','')='' OR f->>'id'=ANY(seen) OR coalesce(trim(f->>'name'),'')='' OR coalesce(f->>'kind','') NOT IN ('attribute','number','text','textarea') THEN RAISE EXCEPTION 'Campo inválido ou repetido'; END IF;
   seen:=array_append(seen,f->>'id');
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.sheet_skills s WHERE s.template_id=NEW.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.fields) x WHERE x->>'id'=s.attribute_id AND x->>'kind'='attribute')) THEN RAISE EXCEPTION 'Remova ou reassocie as perícias antes de excluir este atributo'; END IF;
 ELSIF TG_TABLE_NAME='sheet_skills' THEN
  IF TG_OP='UPDATE' AND NEW.template_id<>OLD.template_id THEN RAISE EXCEPTION 'Não é permitido mover perícias'; END IF;
  IF length(trim(NEW.name)) NOT BETWEEN 1 AND 120 OR NEW.max_level NOT BETWEEN 0 AND 100 OR NOT EXISTS(SELECT 1 FROM public.sheet_templates t,jsonb_array_elements(t.fields) f WHERE t.id=NEW.template_id AND f->>'id'=NEW.attribute_id AND f->>'kind'='attribute') THEN RAISE EXCEPTION 'Perícia ou atributo inválido'; END IF;
  IF EXISTS(SELECT 1 FROM public.characters c WHERE c.template_id=NEW.template_id AND coalesce((c.data->'skills'->>NEW.id::text)::integer,0)>NEW.max_level) THEN RAISE EXCEPTION 'Há fichas com níveis acima deste máximo; ajuste-as primeiro'; END IF;
 ELSIF TG_TABLE_NAME='success_tests' THEN
  IF length(trim(NEW.name)) NOT BETWEEN 1 AND 120 OR NEW.difficulty NOT BETWEEN 1 AND 100 OR NOT EXISTS(SELECT 1 FROM public.sheet_skills s JOIN public.sheet_templates t ON t.id=s.template_id WHERE s.id=NEW.skill_id AND t.campaign_id=NEW.campaign_id) THEN RAISE EXCEPTION 'Teste inválido'; END IF;
 ELSIF TG_TABLE_NAME='member_template_limits' THEN
  IF NEW.max_characters NOT BETWEEN 0 AND 50 OR NOT EXISTS(SELECT 1 FROM public.campaign_members m JOIN public.sheet_templates t ON t.campaign_id=m.campaign_id WHERE m.id=NEW.member_id AND t.id=NEW.template_id) THEN RAISE EXCEPTION 'Permissão de modelo inválida'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER template_guard BEFORE INSERT OR UPDATE ON public.sheet_templates FOR EACH ROW EXECUTE FUNCTION public.sheet_structure_guard();
CREATE TRIGGER skill_guard BEFORE INSERT OR UPDATE ON public.sheet_skills FOR EACH ROW EXECUTE FUNCTION public.sheet_structure_guard();
CREATE TRIGGER test_guard BEFORE INSERT OR UPDATE ON public.success_tests FOR EACH ROW EXECUTE FUNCTION public.sheet_structure_guard();
CREATE TRIGGER type_limit_guard BEFORE INSERT OR UPDATE ON public.member_template_limits FOR EACH ROW EXECUTE FUNCTION public.sheet_structure_guard();
CREATE OR REPLACE FUNCTION public.characters_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.campaign_members; lim integer; cnt integer; master boolean; fs jsonb; k text;
BEGIN
 master:=public.is_mestra(NEW.campaign_id,auth.uid());
 IF TG_OP='UPDATE' THEN
  IF NEW.campaign_id<>OLD.campaign_id OR NEW.owner_id<>OLD.owner_id THEN RAISE EXCEPTION 'Não é permitido mover a ficha'; END IF;
  IF NEW.template_id IS DISTINCT FROM OLD.template_id AND NOT master THEN RAISE EXCEPTION 'Só a mestra pode alterar o modelo'; END IF;
  NEW.updated_at:=now();
 END IF;
 IF NEW.template_id IS NOT NULL THEN
  SELECT fields INTO fs FROM public.sheet_templates WHERE id=NEW.template_id AND campaign_id=NEW.campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Modelo indisponível nesta campanha'; END IF;
  PERFORM public.validate_sheet_values(NEW.template_id,NEW.data);
  IF NOT master THEN
   FOR k IN SELECT jsonb_object_keys(NEW.data) LOOP IF k NOT IN ('values','skills') THEN RAISE EXCEPTION 'Só a mestra define a estrutura'; END IF; END LOOP;
   FOR k IN SELECT jsonb_object_keys(coalesce(NEW.data->'values','{}')) LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fs) f WHERE f->>'id'=k) AND (TG_OP='INSERT' OR (NEW.data->'values'->k) IS DISTINCT FROM (OLD.data->'values'->k)) THEN RAISE EXCEPTION 'Atributo não definido pela mestra'; END IF;
   END LOOP;
   FOR k IN SELECT jsonb_object_keys(coalesce(NEW.data->'skills','{}')) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.sheet_skills s WHERE s.template_id=NEW.template_id AND s.id::text=k) AND (TG_OP='INSERT' OR (NEW.data->'skills'->k) IS DISTINCT FROM (OLD.data->'skills'->k)) THEN RAISE EXCEPTION 'Perícia não definida pela mestra'; END IF;
   END LOOP;
  END IF;
 ELSIF NOT master THEN
  IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.sheet_templates WHERE campaign_id=NEW.campaign_id) THEN RAISE EXCEPTION 'Escolha um modelo autorizado'; END IF;
  IF TG_OP='UPDATE' AND NEW.data IS DISTINCT FROM OLD.data THEN RAISE EXCEPTION 'Só a mestra define a estrutura'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND NEW.template_id IS NOT DISTINCT FROM OLD.template_id THEN RETURN NEW; END IF;
 IF NOT public.is_member(NEW.campaign_id,NEW.owner_id) THEN RAISE EXCEPTION 'Dona da ficha não participa da campanha'; END IF;
 IF master THEN RETURN NEW; END IF;
 SELECT * INTO m FROM public.campaign_members WHERE campaign_id=NEW.campaign_id AND user_id=NEW.owner_id FOR UPDATE;
 IF NOT m.can_create_characters THEN RAISE EXCEPTION 'A mestra desativou a criação de fichas'; END IF;
 SELECT coalesce(m.max_characters,c.max_characters_per_player) INTO lim FROM public.campaigns c WHERE id=NEW.campaign_id;
 SELECT count(*) INTO cnt FROM public.characters WHERE campaign_id=NEW.campaign_id AND owner_id=NEW.owner_id;
 IF cnt>=lim THEN RAISE EXCEPTION 'Limite total de fichas atingido'; END IF;
 IF NEW.template_id IS NOT NULL THEN
  SELECT max_characters INTO lim FROM public.member_template_limits WHERE member_id=m.id AND template_id=NEW.template_id;
  IF lim IS NULL OR lim=0 THEN RAISE EXCEPTION 'Modelo não autorizado pela mestra'; END IF;
  SELECT count(*) INTO cnt FROM public.characters WHERE owner_id=NEW.owner_id AND campaign_id=NEW.campaign_id AND template_id=NEW.template_id;
  IF cnt>=lim THEN RAISE EXCEPTION 'Limite deste tipo de ficha atingido'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.roll_success_test(_test uuid,_character uuid) RETURNS public.dice_rolls LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.success_tests; s public.sheet_skills; c public.characters; f jsonb; av integer; sv integer; pool integer; successes integer; r public.dice_rolls; uname text;
BEGIN
 SELECT * INTO t FROM public.success_tests WHERE id=_test FOR SHARE;
 IF NOT FOUND OR NOT public.is_member(t.campaign_id,auth.uid()) THEN RAISE EXCEPTION 'Teste indisponível'; END IF;
 SELECT * INTO c FROM public.characters WHERE id=_character AND campaign_id=t.campaign_id AND (owner_id=auth.uid() OR public.is_mestra(t.campaign_id,auth.uid())) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Personagem indisponível'; END IF;
 SELECT * INTO s FROM public.sheet_skills WHERE id=t.skill_id AND template_id=c.template_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Este teste não corresponde ao modelo da ficha'; END IF;
 PERFORM public.validate_sheet_values(c.template_id,c.data);
 SELECT value INTO f FROM public.sheet_templates st,jsonb_array_elements(st.fields) WHERE st.id=c.template_id AND value->>'id'=s.attribute_id AND value->>'kind'='attribute';
 av:=coalesce((c.data->'values'->>s.attribute_id)::integer,0); sv:=coalesce((c.data->'skills'->>s.id::text)::integer,0); pool:=av+sv;
 IF pool>100 THEN RAISE EXCEPTION 'O teste excede o limite de 100 dados'; END IF;
 IF pool>0 THEN r:=public.roll_dice_combined(t.campaign_id,jsonb_build_array(jsonb_build_object('sides',10,'count',pool)),'individual',0,t.name,c.id);
 ELSE
  SELECT display_name INTO uname FROM public.profiles WHERE id=auth.uid();
  INSERT INTO public.dice_rolls(campaign_id,user_id,expression,results,total,character_id,character_name,roller_name,label) VALUES(t.campaign_id,auth.uid(),'0d10','{}',0,c.id,c.name,coalesce(uname,'Sem nome'),t.name) RETURNING * INTO r;
 END IF;
 SELECT count(*) INTO successes FROM unnest(r.results) v WHERE v>=6;
 UPDATE public.dice_rolls SET success_data=jsonb_build_object('test_name',t.name,'attribute_name',f->>'name','attribute_value',av,'skill_name',s.name,'skill_level',sv,'dice_count',pool,'successes',successes,'difficulty',t.difficulty,'passed',successes>=t.difficulty),roll_mode='success' WHERE id=r.id RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.roll_success_test(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.roll_success_test(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.validate_sheet_values(uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.validate_sheet_values(uuid,jsonb) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sheet_templates,public.sheet_skills,public.member_template_limits,public.success_tests,public.characters;