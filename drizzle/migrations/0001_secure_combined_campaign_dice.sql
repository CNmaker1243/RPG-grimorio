ALTER TABLE public.dice_rolls ADD COLUMN dice_groups jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN roll_mode text NOT NULL DEFAULT 'individual', ADD COLUMN character_id uuid, ADD COLUMN character_name text NOT NULL DEFAULT '', ADD COLUMN roller_name text NOT NULL DEFAULT '';
UPDATE public.dice_rolls SET dice_groups = jsonb_build_array(jsonb_build_object('sides', split_part(split_part(expression, 'd', 2), '+', 1)::text::integer, 'count', cardinality(results), 'results', to_jsonb(results))) WHERE expression ~ '^[0-9]+d[0-9]+(\+[0-9]+)?$';
REVOKE INSERT, UPDATE, DELETE ON public.dice_rolls FROM anon, authenticated;
GRANT SELECT ON public.dice_rolls TO authenticated;
CREATE OR REPLACE FUNCTION public.roll_dice_combined(_campaign uuid, _dice jsonb, _mode text DEFAULT 'combined', _modifier integer DEFAULT 0, _label text DEFAULT '', _character uuid DEFAULT NULL)
RETURNS public.dice_rolls LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); item jsonb; sides integer; amount integer; number_of_dice integer := 0; i integer; v integer; total_value integer := 0;
  bytes bytea; sample bigint; cutoff bigint; values_for_group integer[]; all_values integer[] := '{}'; groups jsonb := '[]'; expression_value text := ''; result_row public.dice_rolls; cname text := ''; uname text := ''; seen integer[] := '{}';
BEGIN
  IF uid IS NULL OR NOT public.is_member(_campaign, uid) THEN RAISE EXCEPTION 'Você não participa desta campanha'; END IF;
  IF _dice IS NULL OR jsonb_typeof(_dice) <> 'array' OR jsonb_array_length(_dice) NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'Selecione os dados da rolagem'; END IF;
  IF _mode IS NULL OR _mode NOT IN ('individual', 'combined') OR (_mode = 'individual' AND jsonb_array_length(_dice) <> 1) THEN RAISE EXCEPTION 'Modalidade inválida'; END IF;
  IF _modifier IS NULL OR _modifier NOT BETWEEN -10000 AND 10000 THEN RAISE EXCEPTION 'Modificador inválido'; END IF;
  IF _character IS NOT NULL THEN
    SELECT name INTO cname FROM public.characters WHERE id = _character AND campaign_id = _campaign AND (owner_id = uid OR public.is_mestra(_campaign, uid));
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem indisponível nesta campanha'; END IF;
  END IF;
  SELECT display_name INTO uname FROM public.profiles WHERE id = uid;
  FOR item IN SELECT value FROM jsonb_array_elements(_dice) LOOP
    IF jsonb_typeof(item) <> 'object' OR NOT (item ? 'sides' AND item ? 'count') OR (item->>'sides') !~ '^[0-9]+$' OR (item->>'count') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
    sides := (item->>'sides')::integer; amount := (item->>'count')::integer;
    IF sides NOT IN (4,6,8,10,12,20,100) OR sides = ANY(seen) THEN RAISE EXCEPTION 'Tipo de dado inválido ou repetido'; END IF;
    IF amount NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Quantidade de dados entre 1 e 100'; END IF;
    number_of_dice := number_of_dice + amount;
    IF number_of_dice > 100 THEN RAISE EXCEPTION 'Máximo de 100 dados por rolagem'; END IF;
    seen := array_append(seen, sides); values_for_group := '{}';
    cutoff := 4294967296 - mod(4294967296::bigint, sides::bigint);
    FOR i IN 1..amount LOOP
      LOOP
        bytes := extensions.gen_random_bytes(4);
        sample := get_byte(bytes,0)::bigint * 16777216 + get_byte(bytes,1)::bigint * 65536 + get_byte(bytes,2)::bigint * 256 + get_byte(bytes,3)::bigint;
        EXIT WHEN sample < cutoff;
      END LOOP;
      v := mod(sample, sides)::integer + 1;
      values_for_group := array_append(values_for_group, v); all_values := array_append(all_values, v); total_value := total_value + v;
    END LOOP;
    groups := groups || jsonb_build_array(jsonb_build_object('sides', sides, 'count', amount, 'results', to_jsonb(values_for_group)));
    expression_value := expression_value || CASE WHEN expression_value = '' THEN '' ELSE ' + ' END || amount || 'd' || sides;
  END LOOP;
  expression_value := expression_value || CASE WHEN _modifier > 0 THEN ' + ' || _modifier WHEN _modifier < 0 THEN ' - ' || abs(_modifier) ELSE '' END;
  INSERT INTO public.dice_rolls(campaign_id,user_id,expression,results,modifier,total,label,dice_groups,roll_mode,character_id,character_name,roller_name)
  VALUES (_campaign,uid,expression_value,all_values,_modifier,total_value + _modifier,left(coalesce(_label,''),120),groups,_mode,_character,coalesce(cname,''),coalesce(nullif(uname,''),'Sem nome')) RETURNING * INTO result_row;
  RETURN result_row;
END $$;
REVOKE ALL ON FUNCTION public.roll_dice_combined(uuid,jsonb,text,integer,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roll_dice_combined(uuid,jsonb,text,integer,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.roll_dice(_campaign uuid, _count integer, _sides integer, _modifier integer DEFAULT 0, _label text DEFAULT '')
RETURNS public.dice_rolls LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.roll_dice_combined(_campaign,jsonb_build_array(jsonb_build_object('sides',_sides,'count',_count)),'individual',_modifier,_label,NULL);
END $$;
REVOKE ALL ON FUNCTION public.roll_dice(uuid,integer,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roll_dice(uuid,integer,integer,integer,text) TO authenticated;