
create type public.campaign_role as enum ('mestra','jogador');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  owner_id uuid not null default auth.uid(),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text),1,8)),
  max_characters_per_player int not null default 1 check (max_characters_per_player between 0 and 50),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;

create table public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null,
  role public.campaign_role not null default 'jogador',
  max_characters int check (max_characters between 0 and 50),
  can_create_characters boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);
grant select, update, delete on public.campaign_members to authenticated;
grant all on public.campaign_members to service_role;
alter table public.campaign_members enable row level security;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  notes text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.characters to authenticated;
grant all on public.characters to service_role;
alter table public.characters enable row level security;

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null,
  expression text not null,
  results int[] not null,
  modifier int not null default 0,
  total int not null,
  label text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.dice_rolls to authenticated;
grant all on public.dice_rolls to service_role;
alter table public.dice_rolls enable row level security;

-- helpers
create or replace function public.is_member(_campaign uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from campaign_members where campaign_id=_campaign and user_id=_user)
$$;
create or replace function public.is_mestra(_campaign uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from campaign_members where campaign_id=_campaign and user_id=_user and role='mestra')
$$;
create or replace function public.shares_campaign(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from campaign_members m1 join campaign_members m2 on m1.campaign_id=m2.campaign_id
    where m1.user_id=_a and m2.user_id=_b)
$$;

-- profiles policies
create policy "profiles read self or campaign mates" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_campaign(auth.uid(), id));
create policy "profiles insert self" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- campaigns policies
create policy "campaigns read members" on public.campaigns for select to authenticated
  using (public.is_member(id, auth.uid()));
create policy "campaigns insert self owner" on public.campaigns for insert to authenticated
  with check (owner_id = auth.uid());
create policy "campaigns update mestra" on public.campaigns for update to authenticated
  using (public.is_mestra(id, auth.uid())) with check (public.is_mestra(id, auth.uid()));
create policy "campaigns delete owner" on public.campaigns for delete to authenticated
  using (owner_id = auth.uid());

create or replace function public.campaign_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'Não é permitido alterar a dona da campanha';
  end if;
  return new;
end $$;
create trigger campaigns_guard before update on public.campaigns for each row execute function public.campaign_guard();

create or replace function public.add_owner_as_mestra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into campaign_members(campaign_id, user_id, role) values (new.id, new.owner_id, 'mestra');
  return new;
end $$;
create trigger campaigns_add_owner after insert on public.campaigns for each row execute function public.add_owner_as_mestra();

-- members policies (no direct insert; join via RPC)
create policy "members read same campaign" on public.campaign_members for select to authenticated
  using (public.is_member(campaign_id, auth.uid()));
create policy "members update by mestra" on public.campaign_members for update to authenticated
  using (public.is_mestra(campaign_id, auth.uid())) with check (public.is_mestra(campaign_id, auth.uid()));
create policy "members delete by mestra or self leave" on public.campaign_members for delete to authenticated
  using (public.is_mestra(campaign_id, auth.uid()) or user_id = auth.uid());

create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from campaigns where id = coalesce(new.campaign_id, old.campaign_id);
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.campaign_id <> old.campaign_id then
      raise exception 'Alteração não permitida';
    end if;
    if new.role <> old.role and old.user_id = owner then
      raise exception 'A criadora da campanha permanece mestra';
    end if;
    if new.role <> old.role and old.user_id = auth.uid() then
      raise exception 'Você não pode alterar seu próprio papel';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.user_id = owner and owner is not null and exists(select 1 from campaigns where id = old.campaign_id) then
      raise exception 'A criadora não pode ser removida da campanha';
    end if;
    return old;
  end if;
  return new;
end $$;
create trigger members_guard_upd before update on public.campaign_members for each row execute function public.members_guard();
create trigger members_guard_del before delete on public.campaign_members for each row
  when (pg_trigger_depth() = 0) execute function public.members_guard();

-- join via code
create or replace function public.join_campaign(_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select id into c from campaigns where invite_code = upper(trim(_code));
  if c is null then raise exception 'Código de convite inválido'; end if;
  insert into campaign_members(campaign_id, user_id, role) values (c, auth.uid(), 'jogador')
  on conflict (campaign_id, user_id) do nothing;
  return c;
end $$;
revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;

create or replace function public.regenerate_invite(_campaign uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not is_mestra(_campaign, auth.uid()) then raise exception 'Apenas a mestra'; end if;
  code := upper(substr(md5(gen_random_uuid()::text),1,8));
  update campaigns set invite_code = code where id = _campaign;
  return code;
end $$;
revoke all on function public.regenerate_invite(uuid) from public, anon;
grant execute on function public.regenerate_invite(uuid) to authenticated;

-- characters
create policy "characters read own or mestra" on public.characters for select to authenticated
  using (owner_id = auth.uid() or public.is_mestra(campaign_id, auth.uid()));
create policy "characters insert own as member" on public.characters for insert to authenticated
  with check ((owner_id = auth.uid() and public.is_member(campaign_id, auth.uid())) or public.is_mestra(campaign_id, auth.uid()));
create policy "characters update own or mestra" on public.characters for update to authenticated
  using (owner_id = auth.uid() or public.is_mestra(campaign_id, auth.uid()))
  with check (owner_id = auth.uid() or public.is_mestra(campaign_id, auth.uid()));
create policy "characters delete own or mestra" on public.characters for delete to authenticated
  using (owner_id = auth.uid() or public.is_mestra(campaign_id, auth.uid()));

create or replace function public.characters_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare m campaign_members; lim int; cnt int;
begin
  if tg_op = 'UPDATE' then
    if new.campaign_id <> old.campaign_id or new.owner_id <> old.owner_id then
      raise exception 'Não é permitido mover a ficha';
    end if;
    new.updated_at := now();
    return new;
  end if;
  if not is_member(new.campaign_id, new.owner_id) then raise exception 'Dona da ficha não participa da campanha'; end if;
  if is_mestra(new.campaign_id, auth.uid()) then return new; end if;
  select * into m from campaign_members where campaign_id = new.campaign_id and user_id = new.owner_id;
  if not m.can_create_characters then raise exception 'A mestra desativou a criação de fichas para você'; end if;
  select coalesce(m.max_characters, c.max_characters_per_player) into lim from campaigns c where c.id = new.campaign_id;
  select count(*) into cnt from characters where campaign_id = new.campaign_id and owner_id = new.owner_id;
  if cnt >= lim then raise exception 'Limite de fichas atingido (%)', lim; end if;
  return new;
end $$;
create trigger characters_guard before insert or update on public.characters for each row execute function public.characters_guard();

-- dice
create policy "rolls read members" on public.dice_rolls for select to authenticated
  using (public.is_member(campaign_id, auth.uid()));

create or replace function public.roll_dice(_campaign uuid, _count int, _sides int, _modifier int default 0, _label text default '')
returns public.dice_rolls
language plpgsql security definer set search_path = public as $$
declare r int[] := '{}'; i int; t int := 0; row dice_rolls; v int;
begin
  if not is_member(_campaign, auth.uid()) then raise exception 'Você não participa desta campanha'; end if;
  if _count < 1 or _count > 100 then raise exception 'Quantidade de dados entre 1 e 100'; end if;
  if _sides < 2 or _sides > 1000 then raise exception 'Faces entre 2 e 1000'; end if;
  if abs(_modifier) > 10000 then raise exception 'Modificador inválido'; end if;
  for i in 1.._count loop
    v := floor(random() * _sides)::int + 1;
    r := r || v; t := t + v;
  end loop;
  insert into dice_rolls(campaign_id, user_id, expression, results, modifier, total, label)
  values (_campaign, auth.uid(),
    _count || 'd' || _sides || case when _modifier > 0 then '+' || _modifier when _modifier < 0 then _modifier::text else '' end,
    r, _modifier, t + _modifier, left(coalesce(_label,''), 120))
  returning * into row;
  return row;
end $$;
revoke all on function public.roll_dice(uuid,int,int,int,text) from public, anon;
grant execute on function public.roll_dice(uuid,int,int,int,text) to authenticated;

alter publication supabase_realtime add table public.dice_rolls;
alter publication supabase_realtime add table public.campaign_members;
