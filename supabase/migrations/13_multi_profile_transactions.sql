-- Porkin como produto multiusuário: espaços financeiros, membros, roteamento
-- de e-mails e tipos de movimentação explícitos.

alter table profiles
  add column if not exists context_type text not null default 'personal'
  check (context_type in ('personal', 'couple', 'household', 'business', 'other'));

update profiles
set context_type = case
  when type = 'pessoal' then 'personal'
  when lower(name) = 'casa' then 'household'
  else 'other'
end;

alter table accounts
  add column if not exists institution text,
  add column if not exists ownership text not null default 'personal'
    check (ownership in ('personal', 'joint', 'business')),
  add column if not exists email_aliases text[] not null default '{}';

alter table transactions
  add column if not exists transaction_type text not null default 'expense'
    check (transaction_type in ('expense', 'income', 'transfer_out', 'transfer_in', 'card_payment')),
  add column if not exists counterparty text,
  add column if not exists account_label text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists paid_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists transactions_profile_type_date_idx
  on transactions (profile_id, transaction_type, occurred_at desc);

insert into categories (name, bucket, is_income)
values
  ('Transferência recebida', 'renda', true),
  ('Transferência enviada', 'transferencia', false),
  ('Pagamento de fatura', 'transferencia', false)
on conflict (name) do nothing;

create table if not exists profile_invitations (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  email       text not null,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (profile_id, email)
);

create table if not exists gmail_import_routes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  match_label  text not null default '*',
  is_default   boolean not null default false,
  priority     integer not null default 100,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, profile_id, match_label)
);

create table if not exists transaction_splits (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references transactions(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  debtor_user_id  uuid not null references auth.users(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  status          text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  settled_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (transaction_id, debtor_user_id)
);

create index if not exists transaction_splits_profile_status_idx
  on transaction_splits (profile_id, status);

create unique index if not exists gmail_import_routes_one_default_idx
  on gmail_import_routes (user_id) where is_default and active;

insert into gmail_import_routes (user_id, profile_id, match_label, is_default)
select user_id, profile_id, '*', true
from gmail_connections
on conflict (user_id, profile_id, match_label) do nothing;

alter table email_imports
  add column if not exists route_id uuid references gmail_import_routes(id) on delete set null,
  add column if not exists parser_version integer not null default 1,
  add column if not exists parsed_payload jsonb;

alter table profile_invitations enable row level security;
alter table gmail_import_routes enable row level security;
alter table transaction_splits enable row level security;

drop policy if exists members_profile_read on profile_members;
create policy members_profile_read on profile_members
  for select to authenticated using (is_profile_member(profile_id));

drop policy if exists invitations_member_read on profile_invitations;
create policy invitations_member_read on profile_invitations
  for select to authenticated using (is_profile_member(profile_id));

drop policy if exists gmail_routes_owner on gmail_import_routes;
create policy gmail_routes_owner on gmail_import_routes
  for all to authenticated
  using (user_id = (select auth.uid()) and is_profile_member(profile_id))
  with check (user_id = (select auth.uid()) and is_profile_member(profile_id));

drop policy if exists transaction_splits_member on transaction_splits;
create policy transaction_splits_member on transaction_splits
  for all to authenticated
  using (is_profile_member(profile_id))
  with check (
    is_profile_member(profile_id)
    and exists (
      select 1 from profile_members
      where profile_id = transaction_splits.profile_id
        and user_id = transaction_splits.debtor_user_id
    )
  );

create or replace function fn_create_profile(
  p_name text,
  p_context_type text default 'household',
  p_color text default '#7c3aed'
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile uuid;
  v_context text := case
    when p_context_type in ('personal', 'couple', 'household', 'business', 'other') then p_context_type
    else 'other'
  end;
  v_type public.profile_type := case when v_context = 'personal' then 'pessoal'::public.profile_type else 'compartilhado'::public.profile_type end;
begin
  if v_user is null then raise exception 'Não autenticado'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Nome obrigatório'; end if;

  insert into public.profiles (name, type, color, context_type, profile_type)
  values (left(trim(p_name), 80), v_type, p_color, v_context, 'razoavel')
  returning id into v_profile;

  insert into public.profile_members (profile_id, user_id, role)
  values (v_profile, v_user, 'owner');

  if v_context = 'personal' then
    insert into public.allocation_rules (profile_id, bucket, label, percentage) values
      (v_profile, 'obrigatoria', 'Despesas obrigatórias', 0.60),
      (v_profile, 'nao_obrig', 'Despesas não obrigatórias', 0.30),
      (v_profile, 'investimento', 'Investimentos', 0.10);
  end if;

  return v_profile;
end;
$$;

create or replace function fn_invite_profile_member(p_profile_id uuid, p_email text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(trim(p_email));
  v_invited_user uuid;
begin
  if not exists (
    select 1 from public.profile_members
    where profile_id = p_profile_id and user_id = v_user and role = 'owner'
  ) then raise exception 'Apenas proprietários podem convidar membros'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'E-mail inválido'; end if;

  select id into v_invited_user from auth.users where lower(email) = v_email limit 1;
  if v_invited_user is not null then
    insert into public.profile_members (profile_id, user_id, role)
    values (p_profile_id, v_invited_user, 'member')
    on conflict (profile_id, user_id) do nothing;
    return 'added';
  end if;

  insert into public.profile_invitations (profile_id, email, invited_by, status)
  values (p_profile_id, v_email, v_user, 'pending')
  on conflict (profile_id, email) do update
    set invited_by = excluded.invited_by, status = 'pending', created_at = now(), accepted_at = null;
  return 'invited';
end;
$$;

create or replace function fn_accept_profile_invitations()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
begin
  if v_user is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = v_user;

  insert into public.profile_members (profile_id, user_id, role)
  select profile_id, v_user, 'member'
  from public.profile_invitations
  where lower(email) = v_email and status = 'pending'
  on conflict (profile_id, user_id) do nothing;
  get diagnostics v_count = row_count;

  update public.profile_invitations
  set status = 'accepted', accepted_at = now()
  where lower(email) = v_email and status = 'pending';
  return v_count;
end;
$$;

create or replace function fn_profile_member_directory(p_profile_id uuid)
returns table (user_id uuid, email text, display_name text, role text)
language sql security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(u.email, '@', 1)
    )::text,
    pm.role
  from public.profile_members pm
  join auth.users u on u.id = pm.user_id
  where pm.profile_id = p_profile_id
    and public.is_profile_member(p_profile_id);
$$;

revoke all on function fn_create_profile(text, text, text) from public;
revoke all on function fn_invite_profile_member(uuid, text) from public;
revoke all on function fn_accept_profile_invitations() from public;
revoke all on function fn_profile_member_directory(uuid) from public;
grant execute on function fn_create_profile(text, text, text) to authenticated;
grant execute on function fn_invite_profile_member(uuid, text) to authenticated;
grant execute on function fn_accept_profile_invitations() to authenticated;
grant execute on function fn_profile_member_directory(uuid) to authenticated;

create or replace view v_bucket_spending_current
with (security_invoker = true) as
select
  t.profile_id,
  coalesce(c.bucket, 'outros') as bucket,
  sum(t.amount) as total
from transactions t
left join categories c on c.id = t.category_id
where date_trunc('month', t.occurred_at) = date_trunc('month', current_date)
  and t.transaction_type = 'expense'
group by t.profile_id, coalesce(c.bucket, 'outros');
