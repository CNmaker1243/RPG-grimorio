CREATE OR REPLACE FUNCTION public.sheet_structure_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE field_item jsonb; seen text[]:='{}';
BEGIN
 IF TG_TABLE_NAME='sheet_templates' THEN
  IF TG_OP='UPDATE' AND NEW.campaign_id<>OLD.campaign_id THEN RAISE EXCEPTION 'Não é permitido mover modelos'; END IF;
  IF length(trim(NEW.name)) NOT BETWEEN 1 AND 120 OR jsonb_typeof(NEW.fields)<>'array' OR jsonb_array_length(NEW.fields)>100 THEN RAISE EXCEPTION 'Modelo inválido'; END IF;
  FOR field_item IN SELECT value FROM jsonb_array_elements(NEW.fields) LOOP
   IF coalesce(field_item->>'id','')='' OR field_item->>'id'=ANY(seen) OR coalesce(trim(field_item->>'name'),'')='' OR coalesce(field_item->>'kind','') NOT IN ('attribute','number','text','textarea') THEN RAISE EXCEPTION 'Campo inválido ou repetido'; END IF;
   seen:=array_append(seen,field_item->>'id');
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.sheet_skills s WHERE s.template_id=NEW.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.fields) x WHERE x->>'id'=s.attribute_id AND x->>'kind'='attribute')) THEN RAISE EXCEPTION 'Remova ou reassocie as perícias antes de excluir este atributo'; END IF;
 ELSIF TG_TABLE_NAME='sheet_skills' THEN
  IF TG_OP='UPDATE' AND NEW.template_id<>OLD.template_id THEN RAISE EXCEPTION 'Não é permitido mover perícias'; END IF;
  IF length(trim(NEW.name)) NOT BETWEEN 1 AND 120 OR NEW.max_level NOT BETWEEN 0 AND 100 OR NOT EXISTS(SELECT 1 FROM public.sheet_templates t,jsonb_array_elements(t.fields) x WHERE t.id=NEW.template_id AND x->>'id'=NEW.attribute_id AND x->>'kind'='attribute') THEN RAISE EXCEPTION 'Perícia ou atributo inválido'; END IF;
  IF EXISTS(SELECT 1 FROM public.characters c WHERE c.template_id=NEW.template_id AND coalesce((c.data->'skills'->>NEW.id::text)::integer,0)>NEW.max_level) THEN RAISE EXCEPTION 'Há fichas com níveis acima deste máximo; ajuste-as primeiro'; END IF;
 ELSIF TG_TABLE_NAME='success_tests' THEN
  IF length(trim(NEW.name)) NOT BETWEEN 1 AND 120 OR NEW.difficulty NOT BETWEEN 1 AND 100 OR NOT EXISTS(SELECT 1 FROM public.sheet_skills s JOIN public.sheet_templates t ON t.id=s.template_id WHERE s.id=NEW.skill_id AND t.campaign_id=NEW.campaign_id) THEN RAISE EXCEPTION 'Teste inválido'; END IF;
 ELSIF TG_TABLE_NAME='member_template_limits' THEN
  IF NEW.max_characters NOT BETWEEN 0 AND 50 OR NOT EXISTS(SELECT 1 FROM public.campaign_members m JOIN public.sheet_templates t ON t.campaign_id=m.campaign_id WHERE m.id=NEW.member_id AND t.id=NEW.template_id) THEN RAISE EXCEPTION 'Permissão de modelo inválida'; END IF;
 END IF;
 RETURN NEW;
END $$;