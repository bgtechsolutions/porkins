-- Personalizacao, categorias proprias, patrimonio e governanca dos espacos.

create table if not exists public.profile_user_settings (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_sections jsonb not null default '{"attention":true,"upcoming":true,"planning":true,"goals":true,"context":true}'::jsonb,
  objectives text[] not null default '{}',
  theme text not null default 'system' check (theme in ('system','light','dark')),
  hide_values boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);

alter table public.categories
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists color text,
  add column if not exists archived boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists categories_profile_idx on public.categories(profile_id, is_income, archived);

create table if not exists public.financial_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  asset_type text not null check (asset_type in ('cash','investment','vehicle','property','business','other')),
  current_value numeric(14,2) not null default 0 check (current_value >= 0),
  liability_balance numeric(14,2) not null default 0 check (liability_balance >= 0),
  ownership_percentage numeric(7,6) not null default 1 check (ownership_percentage > 0 and ownership_percentage <= 1),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_split_rules (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  percentage numeric(7,6) not null check (percentage >= 0 and percentage <= 1),
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);

alter table public.profiles add column if not exists join_code text;
update public.profiles set join_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 8)) where join_code is null;
alter table public.profiles alter column join_code set not null;
create unique index if not exists profiles_join_code_unique on public.profiles(join_code);

alter table public.transactions add column if not exists transfer_group_id uuid;
create index if not exists transactions_transfer_group_idx on public.transactions(transfer_group_id) where transfer_group_id is not null;

alter table public.profile_user_settings enable row level security;
alter table public.financial_assets enable row level security;
alter table public.profile_split_rules enable row level security;

create policy settings_own on public.profile_user_settings for all to authenticated
  using (user_id = (select auth.uid()) and public.is_profile_member(profile_id))
  with check (user_id = (select auth.uid()) and public.is_profile_member(profile_id));
create policy assets_member on public.financial_assets for all to authenticated
  using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy split_rules_member on public.profile_split_rules for all to authenticated
  using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));

drop policy if exists categories_read on public.categories;
drop policy if exists categories_select on public.categories;
drop policy if exists categories_write on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (profile_id is null or public.is_profile_member(profile_id));
create policy categories_write on public.categories for all to authenticated
  using (profile_id is not null and public.is_profile_member(profile_id))
  with check (profile_id is not null and public.is_profile_member(profile_id));

create or replace function public.fn_join_profile_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid;
begin
  if (select auth.uid()) is null then raise exception 'Nao autenticado'; end if;
  select id into v_profile from public.profiles where join_code = upper(trim(p_code));
  if v_profile is null then raise exception 'Codigo invalido'; end if;
  insert into public.profile_members(profile_id,user_id,role)
  values (v_profile,(select auth.uid()),'member') on conflict do nothing;
  return v_profile;
end; $$;

create or replace function public.fn_regenerate_profile_join_code(p_profile_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not exists (select 1 from public.profile_members where profile_id=p_profile_id and user_id=(select auth.uid()) and role='owner')
    then raise exception 'Apenas proprietarios'; end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_profile_id::text),1,8));
  update public.profiles set join_code=v_code where id=p_profile_id;
  return v_code;
end; $$;

create or replace function public.fn_manage_profile_member(p_profile_id uuid,p_user_id uuid,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profile_members where profile_id=p_profile_id and user_id=(select auth.uid()) and role='owner')
    then raise exception 'Apenas proprietarios'; end if;
  if p_user_id=(select auth.uid()) then raise exception 'Gerencie seu proprio acesso por outro proprietario'; end if;
  if p_action='remove' then delete from public.profile_members where profile_id=p_profile_id and user_id=p_user_id;
  elsif p_action in ('owner','member') then update public.profile_members set role=p_action where profile_id=p_profile_id and user_id=p_user_id;
  else raise exception 'Acao invalida'; end if;
end; $$;

revoke all on function public.fn_join_profile_by_code(text) from public;
revoke all on function public.fn_regenerate_profile_join_code(uuid) from public;
revoke all on function public.fn_manage_profile_member(uuid,uuid,text) from public;
grant execute on function public.fn_join_profile_by_code(text) to authenticated;
grant execute on function public.fn_regenerate_profile_join_code(uuid) to authenticated;
grant execute on function public.fn_manage_profile_member(uuid,uuid,text) to authenticated;
