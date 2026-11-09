ALTER TABLE public.dice_rolls ADD COLUMN combat_data jsonb;

CREATE OR REPLACE FUNCTION public.parse_damage_formula(_formula text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE f text; m text[]; sign text; term text; n integer; s integer; modv integer:=0; counts jsonb:='{}'::jsonb; total integer:=0; groups jsonb:='[]'::jsonb; k text;
BEGIN
 f:=lower(regexp_replace(coalesce(_formula,''),'\s','','g'));
 IF f='' OR length(f)>60 OR f !~ '^(\d{1,3}d\d{1,3}|\d{1,5})([+-](\d{1,3}d\d{1,3}|\d{1,5}))*$' THEN RAISE EXCEPTION 'Fórmula de dano inválida. Use, por exemplo, 1d6 + 2.'; END IF;
 FOR m IN SELECT regexp_matches(f,'([+-]?)(\d+d\d+|\d+)','g') LOOP
  sign:=m[1]; term:=m[2];
  IF position('d' in term)>0 THEN
   IF sign='-' THEN RAISE EXCEPTION 'Não é possível subtrair dados na fórmula'; END IF;
   n:=split_part(term,'d',1)::integer; s:=split_part(term,'d',2)::integer;
   IF s NOT IN (4,6,8,10,12,20,100) THEN RAISE EXCEPTION 'Dado d% não disponível',s; END IF;
   IF n<1 THEN RAISE EXCEPTION 'Quantidade de dados inválida'; END IF;
   counts:=jsonb_set(counts,ARRAY[s::text],to_jsonb(coalesce((counts->>s::text)::integer,0)+n)); total:=total+n;
  ELSE
   modv:=modv+CASE WHEN sign='-' THEN -term::integer ELSE term::integer END;
  END IF;
 END LOOP;
 IF total<1 THEN RAISE EXCEPTION 'A fórmula precisa de pelo menos um dado'; END IF;
 IF total>100 THEN RAISE EXCEPTION 'Máximo de 100 dados por fórmula'; END IF;
 IF abs(modv)>10000 THEN RAISE EXCEPTION 'Modificador muito alto'; END IF;
 FOR k IN SELECT x FROM unnest(ARRAY['4','6','8','10','12','20','100']) x LOOP
  IF counts ? k THEN groups:=groups||jsonb_build_array(jsonb_build_object('sides',k::integer,'count',(counts->>k)::integer)); END IF;
 END LOOP;
 RETURN jsonb_build_object('dice',groups,'modifier',modv);
END $$;

CREATE TABLE public.items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 name text NOT NULL,
 category text NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '',
 damage_formula text NOT NULL DEFAULT '',
 bonuses jsonb NOT NULL DEFAULT '[]'::jsonb,
 attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
 properties jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT items_name_len CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 CONSTRAINT items_category_len CHECK (length(category)<=60),
 CONSTRAINT items_desc_len CHECK (length(description)<=4000),
 CONSTRAINT items_lists CHECK (jsonb_typeof(bonuses)='array' AND jsonb_typeof(attributes)='array' AND jsonb_typeof(properties)='array' AND jsonb_array_length(bonuses)<=50 AND jsonb_array_length(attributes)<=50 AND jsonb_array_length(properties)<=50)
);
CREATE TABLE public.character_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
 quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 9999),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (character_id,item_id)
);
CREATE TABLE public.combats (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 created_by uuid NOT NULL,
 attacker_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
 attacker_name text NOT NULL,
 attacker_attribute_id text NOT NULL,
 attacker_attribute_name text NOT NULL,
 attacker_value integer NOT NULL,
 item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
 item_name text NOT NULL DEFAULT '',
 damage_formula text NOT NULL DEFAULT '',
 defender_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
 defender_name text NOT NULL,
 defender_attribute_id text,
 defender_attribute_name text,
 defender_value integer,
 status text NOT NULL DEFAULT 'awaiting_defense_attribute' CHECK (status IN ('awaiting_defense_attribute','awaiting_defense','awaiting_reroll','attacker_won','defender_won','damage_rolled','cancelled')),
 round integer NOT NULL DEFAULT 1,
 attack_results integer[] NOT NULL DEFAULT '{}',
 defense_results integer[] NOT NULL DEFAULT '{}',
 attack_highest integer,
 defense_highest integer,
 tiebreak text NOT NULL DEFAULT '',
 damage_total integer,
 damage_roll_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.items(campaign_id);
CREATE INDEX ON public.character_items(character_id);
CREATE INDEX ON public.combats(campaign_id,created_at DESC);

GRANT SELECT,INSERT,UPDATE,DELETE ON public.items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.character_items TO authenticated;
GRANT SELECT ON public.combats TO authenticated;
GRANT ALL ON public.items,public.character_items,public.combats TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combats ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_item(_item uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.items i WHERE i.id=_item AND (public.is_mestra(i.campaign_id,_user) OR EXISTS(SELECT 1 FROM public.character_items ci JOIN public.characters c ON c.id=ci.character_id WHERE ci.item_id=i.id AND c.owner_id=_user)))
$$;
REVOKE ALL ON FUNCTION public.can_see_item(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_see_item(uuid,uuid) TO authenticated;

CREATE POLICY items_read ON public.items FOR SELECT TO authenticated USING (public.can_see_item(id,auth.uid()));
CREATE POLICY items_manage ON public.items FOR ALL TO authenticated USING (public.is_mestra(campaign_id,auth.uid())) WITH CHECK (public.is_mestra(campaign_id,auth.uid()));
CREATE POLICY char_items_read ON public.character_items FOR SELECT TO authenticated USING (public.is_mestra(campaign_id,auth.uid()) OR EXISTS(SELECT 1 FROM public.characters c WHERE c.id=character_id AND c.owner_id=auth.uid()));
CREATE POLICY char_items_manage ON public.character_items FOR ALL TO authenticated USING (public.is_mestra(campaign_id,auth.uid())) WITH CHECK (public.is_mestra(campaign_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.characters c WHERE c.id=character_id AND c.campaign_id=character_items.campaign_id) AND EXISTS(SELECT 1 FROM public.items i WHERE i.id=item_id AND i.campaign_id=character_items.campaign_id));
CREATE POLICY combats_read ON public.combats FOR SELECT TO authenticated USING (public.is_member(campaign_id,auth.uid()));

CREATE OR REPLACE FUNCTION public.items_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.name:=btrim(NEW.name); NEW.category:=btrim(NEW.category); NEW.damage_formula:=btrim(NEW.damage_formula);
 IF NEW.damage_formula<>'' THEN PERFORM public.parse_damage_formula(NEW.damage_formula); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.bonuses) b WHERE jsonb_typeof(b)<>'object' OR jsonb_typeof(b->'description')<>'string' OR jsonb_typeof(b->'value')<>'string' OR length(b->>'description')>200 OR length(b->>'value')>60)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.attributes||NEW.properties) b WHERE jsonb_typeof(b)<>'object' OR jsonb_typeof(b->'name')<>'string' OR jsonb_typeof(b->'value')<>'string' OR length(b->>'name')>80 OR length(b->>'value')>200)
 THEN RAISE EXCEPTION 'Propriedades do item inválidas'; END IF;
 IF TG_OP='UPDATE' AND NEW.campaign_id<>OLD.campaign_id THEN RAISE EXCEPTION 'Não é permitido mover o item'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER items_guard BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.items_guard();

CREATE OR REPLACE FUNCTION public.character_attribute(_character public.characters,_attr text,OUT attr_name text,OUT attr_value integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 SELECT value->>'name' INTO attr_name FROM public.sheet_templates st,jsonb_array_elements(st.fields) WHERE st.id=_character.template_id AND value->>'id'=_attr AND value->>'kind'='attribute';
 IF attr_name IS NULL THEN RAISE EXCEPTION 'Atributo não existe na ficha de %',_character.name; END IF;
 attr_value:=coalesce((_character.data->'values'->>_attr)::integer,0);
END $$;
REVOKE ALL ON FUNCTION public.character_attribute(public.characters,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.combat_roll_d20(_cb public.combats,_character uuid,_count integer,_phase text,_label text) RETURNS public.dice_rolls LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.dice_rolls;
BEGIN
 IF _count<1 THEN RAISE EXCEPTION 'O atributo precisa ser pelo menos 1 para rolar'; END IF;
 IF _count>100 THEN RAISE EXCEPTION 'Máximo de 100 dados por rolagem'; END IF;
 r:=public.roll_dice_combined(_cb.campaign_id,jsonb_build_array(jsonb_build_object('sides',20,'count',_count)),'individual',0,_label,_character);
 UPDATE public.dice_rolls SET roll_mode='combat',combat_data=jsonb_build_object('combat_id',_cb.id,'phase',_phase,'round',_cb.round,'attacker',_cb.attacker_name,'defender',_cb.defender_name,'item',_cb.item_name,'highest',(SELECT max(v) FROM unnest(r.results) v)) WHERE id=r.id RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.combat_roll_d20(public.combats,uuid,integer,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.combat_attack(_attacker uuid,_attribute text,_defender uuid,_item uuid DEFAULT NULL) RETURNS public.combats LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.characters; d public.characters; it public.items; cb public.combats; an text; av integer; r public.dice_rolls;
BEGIN
 SELECT * INTO a FROM public.characters WHERE id=_attacker AND (owner_id=auth.uid() OR public.is_mestra(campaign_id,auth.uid()));
 IF NOT FOUND THEN RAISE EXCEPTION 'Personagem atacante indisponível'; END IF;
 SELECT * INTO d FROM public.characters WHERE id=_defender AND campaign_id=a.campaign_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Defensor indisponível'; END IF;
 IF d.id=a.id THEN RAISE EXCEPTION 'Escolha outro personagem como defensor'; END IF;
 IF _item IS NOT NULL THEN
  SELECT i.* INTO it FROM public.items i JOIN public.character_items ci ON ci.item_id=i.id AND ci.character_id=a.id WHERE i.id=_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este item não está na ficha do atacante'; END IF;
  IF it.damage_formula='' THEN RAISE EXCEPTION 'Este item não possui dano configurado'; END IF;
 END IF;
 SELECT * INTO an,av FROM public.character_attribute(a,_attribute);
 INSERT INTO public.combats(campaign_id,created_by,attacker_character_id,attacker_name,attacker_attribute_id,attacker_attribute_name,attacker_value,item_id,item_name,damage_formula,defender_character_id,defender_name)
 VALUES(a.campaign_id,auth.uid(),a.id,a.name,_attribute,an,av,it.id,coalesce(it.name,''),coalesce(it.damage_formula,''),d.id,d.name) RETURNING * INTO cb;
 r:=public.combat_roll_d20(cb,a.id,av,'attack',left('Ataque de '||a.name||' contra '||d.name||' ('||an||')',120));
 UPDATE public.combats SET attack_results=r.results,attack_highest=(SELECT max(v) FROM unnest(r.results) v) WHERE id=cb.id RETURNING * INTO cb;
 UPDATE public.dice_rolls SET combat_data=combat_data||jsonb_build_object('attribute',an,'attribute_value',av) WHERE id=r.id;
 RETURN cb;
END $$;

CREATE OR REPLACE FUNCTION public.combat_set_defense(_combat uuid,_attribute text) RETURNS public.combats LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cb public.combats; d public.characters; dn text; dv integer;
BEGIN
 SELECT * INTO cb FROM public.combats WHERE id=_combat FOR UPDATE;
 IF NOT FOUND OR NOT public.is_mestra(cb.campaign_id,auth.uid()) THEN RAISE EXCEPTION 'Só a mestra define o atributo de defesa'; END IF;
 IF cb.status<>'awaiting_defense_attribute' THEN RAISE EXCEPTION 'A defesa já foi definida'; END IF;
 SELECT * INTO d FROM public.characters WHERE id=cb.defender_character_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Defensor não existe mais'; END IF;
 SELECT * INTO dn,dv FROM public.character_attribute(d,_attribute);
 UPDATE public.combats SET defender_attribute_id=_attribute,defender_attribute_name=dn,defender_value=dv,status='awaiting_defense',updated_at=now() WHERE id=cb.id RETURNING * INTO cb;
 RETURN cb;
END $$;

CREATE OR REPLACE FUNCTION public.combat_defend(_combat uuid) RETURNS public.combats LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cb public.combats; d public.characters; r public.dice_rolls; dh integer; dv integer; dn text; outcome text; tb text:='';
BEGIN
 SELECT * INTO cb FROM public.combats WHERE id=_combat FOR UPDATE;
 IF NOT FOUND OR NOT public.is_member(cb.campaign_id,auth.uid()) THEN RAISE EXCEPTION 'Combate indisponível'; END IF;
 IF cb.status<>'awaiting_defense' THEN RAISE EXCEPTION 'Não é o momento da defesa'; END IF;
 SELECT * INTO d FROM public.characters WHERE id=cb.defender_character_id AND (owner_id=auth.uid() OR public.is_mestra(campaign_id,auth.uid()));
 IF NOT FOUND THEN RAISE EXCEPTION 'Só quem controla o defensor pode rolar a defesa'; END IF;
 SELECT * INTO dn,dv FROM public.character_attribute(d,cb.defender_attribute_id);
 r:=public.combat_roll_d20(cb,d.id,dv,'defense',left('Defesa de '||d.name||' contra '||cb.attacker_name||' ('||dn||')',120));
 dh:=(SELECT max(v) FROM unnest(r.results) v);
 IF cb.attack_highest>dh THEN outcome:='attacker_won';
 ELSIF dh>cb.attack_highest THEN outcome:='defender_won';
 ELSIF cb.attacker_value>dv THEN outcome:='attacker_won'; tb:='Empate nos dados ('||dh||'); '||cb.attacker_attribute_name||' '||cb.attacker_value||' supera '||dn||' '||dv;
 ELSIF dv>cb.attacker_value THEN outcome:='defender_won'; tb:='Empate nos dados ('||dh||'); '||dn||' '||dv||' supera '||cb.attacker_attribute_name||' '||cb.attacker_value;
 ELSE outcome:='awaiting_reroll'; tb:='Empate nos dados ('||dh||') e nos atributos ('||dv||'); nova rolagem necessária';
 END IF;
 UPDATE public.combats SET defense_results=r.results,defense_highest=dh,defender_value=dv,defender_attribute_name=dn,status=outcome,tiebreak=tb,updated_at=now() WHERE id=cb.id RETURNING * INTO cb;
 UPDATE public.dice_rolls SET combat_data=combat_data||jsonb_build_object('attribute',dn,'attribute_value',dv,'attack_attribute',cb.attacker_attribute_name,'attack_value',cb.attacker_value,'attack_results',to_jsonb(cb.attack_results),'attack_highest',cb.attack_highest,'defense_highest',dh,'tiebreak',tb,'outcome',outcome) WHERE id=r.id;
 RETURN cb;
END $$;

CREATE OR REPLACE FUNCTION public.combat_reroll_attack(_combat uuid) RETURNS public.combats LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cb public.combats; a public.characters; r public.dice_rolls; an text; av integer;
BEGIN
 SELECT * INTO cb FROM public.combats WHERE id=_combat FOR UPDATE;
 IF NOT FOUND OR cb.status<>'awaiting_reroll' THEN RAISE EXCEPTION 'Não há nova rolagem pendente'; END IF;
 SELECT * INTO a FROM public.characters WHERE id=cb.attacker_character_id AND (owner_id=auth.uid() OR public.is_mestra(campaign_id,auth.uid()));
 IF NOT FOUND THEN RAISE EXCEPTION 'Só quem controla o atacante pode rolar novamente'; END IF;
 SELECT * INTO an,av FROM public.character_attribute(a,cb.attacker_attribute_id);
 UPDATE public.combats SET round=round+1 WHERE id=cb.id RETURNING * INTO cb;
 r:=public.combat_roll_d20(cb,a.id,av,'attack',left('Nova rolagem de ataque de '||a.name||' ('||an||')',120));
 UPDATE public.dice_rolls SET combat_data=combat_data||jsonb_build_object('attribute',an,'attribute_value',av) WHERE id=r.id;
 UPDATE public.combats SET attack_results=r.results,attack_highest=(SELECT max(v) FROM unnest(r.results) v),attacker_value=av,defense_results='{}',defense_highest=NULL,status='awaiting_defense',updated_at=now() WHERE id=cb.id RETURNING * INTO cb;
 RETURN cb;
END $$;

CREATE OR REPLACE FUNCTION public.combat_damage(_combat uuid) RETURNS public.combats LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cb public.combats; a public.characters; p jsonb; r public.dice_rolls;
BEGIN
 SELECT * INTO cb FROM public.combats WHERE id=_combat FOR UPDATE;
 IF NOT FOUND OR cb.status<>'attacker_won' THEN RAISE EXCEPTION 'O dano só pode ser rolado após o atacante vencer'; END IF;
 IF cb.damage_formula='' THEN RAISE EXCEPTION 'Este ataque não usa item com dano'; END IF;
 SELECT * INTO a FROM public.characters WHERE id=cb.attacker_character_id AND (owner_id=auth.uid() OR public.is_mestra(campaign_id,auth.uid()));
 IF NOT FOUND THEN RAISE EXCEPTION 'Só quem controla o atacante pode rolar o dano'; END IF;
 p:=public.parse_damage_formula(cb.damage_formula);
 r:=public.roll_dice_combined(cb.campaign_id,p->'dice',CASE WHEN jsonb_array_length(p->'dice')=1 THEN 'individual' ELSE 'combined' END,(p->>'modifier')::integer,left('Dano de '||cb.item_name||' em '||cb.defender_name,120),a.id);
 UPDATE public.dice_rolls SET roll_mode='combat',combat_data=jsonb_build_object('combat_id',cb.id,'phase','damage','round',cb.round,'attacker',cb.attacker_name,'defender',cb.defender_name,'item',cb.item_name,'formula',cb.damage_formula) WHERE id=r.id;
 UPDATE public.combats SET damage_total=r.total,damage_roll_id=r.id,status='damage_rolled',updated_at=now() WHERE id=cb.id RETURNING * INTO cb;
 RETURN cb;
END $$;

CREATE OR REPLACE FUNCTION public.combat_cancel(_combat uuid) RETURNS public.combats LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cb public.combats;
BEGIN
 SELECT * INTO cb FROM public.combats WHERE id=_combat FOR UPDATE;
 IF NOT FOUND OR NOT public.is_mestra(cb.campaign_id,auth.uid()) THEN RAISE EXCEPTION 'Só a mestra pode encerrar o combate'; END IF;
 IF cb.status NOT IN ('awaiting_defense_attribute','awaiting_defense','awaiting_reroll','attacker_won') THEN RAISE EXCEPTION 'Este combate já terminou'; END IF;
 UPDATE public.combats SET status=CASE WHEN status='attacker_won' THEN status ELSE 'cancelled' END,damage_formula=CASE WHEN status='attacker_won' THEN '' ELSE damage_formula END,updated_at=now() WHERE id=cb.id RETURNING * INTO cb;
 RETURN cb;
END $$;

REVOKE ALL ON FUNCTION public.parse_damage_formula(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.parse_damage_formula(text) TO authenticated;
REVOKE ALL ON FUNCTION public.combat_attack(uuid,text,uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_attack(uuid,text,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.combat_set_defense(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_set_defense(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.combat_defend(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_defend(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.combat_reroll_attack(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_reroll_attack(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.combat_damage(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_damage(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.combat_cancel(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.combat_cancel(uuid) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.items,public.character_items,public.combats;