-- Compras pagas em uma conta pessoal, mas destinadas a um espaco compartilhado.
-- Tambem torna convites compativeis com todas as identidades (incluindo Gmail).

alter table public.transactions
  add column if not exists destination_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists installment_group_id uuid,
  add column if not exists installment_number integer not null default 1,
  add column if not exists installment_count integer not null default 1,
  add column if not exists total_purchase_amount numeric(12,2);

alter table public.transactions
  drop constraint if exists transactions_installment_number_check,
  add constraint transactions_installment_number_check
    check (installment_count between 1 and 60 and installment_number between 1 and installment_count),
  drop constraint if exists transactions_total_purchase_amount_check,
  add constraint transactions_total_purchase_amount_check
    check (total_purchase_amount is null or total_purchase_amount > 0),
  drop constraint if exists transactions_amount_positive_check,
  add constraint transactions_amount_positive_check check (amount > 0);

create index if not exists transactions_destination_date_idx
  on public.transactions (destination_profile_id, occurred_at desc)
  where destination_profile_id is not null;

create index if not exists transactions_installment_group_idx
  on public.transactions (installment_group_id, installment_number)
  where installment_group_id is not null;

drop policy if exists txn_member on public.transactions;
drop policy if exists txn_read on public.transactions;
drop policy if exists txn_insert on public.transactions;
drop policy if exists txn_update on public.transactions;
drop policy if exists txn_delete on public.transactions;
create policy txn_read on public.transactions
  for select to authenticated
  using (
    public.is_profile_member(profile_id)
    or (destination_profile_id is not null and public.is_profile_member(destination_profile_id))
  );
create policy txn_insert on public.transactions
  for insert to authenticated
  with check (
    public.is_profile_member(profile_id)
    and (destination_profile_id is null or public.is_profile_member(destination_profile_id))
  );
create policy txn_update on public.transactions
  for update to authenticated
  using (public.is_profile_member(profile_id))
  with check (
    public.is_profile_member(profile_id)
    and (destination_profile_id is null or public.is_profile_member(destination_profile_id))
  );
create policy txn_delete on public.transactions
  for delete to authenticated
  using (public.is_profile_member(profile_id));

-- Uma divisao pertence ao espaco beneficiado (Casa/Empresa), ainda que a
-- transacao tenha sido paga em uma conta pessoal de um dos membros.
create or replace function public.fn_validate_transaction_split()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_already_split numeric(12,2);
begin
  select * into v_transaction
  from public.transactions
  where id = new.transaction_id;

  if v_transaction.id is null then
    raise exception 'Lancamento nao encontrado';
  end if;
  if coalesce(v_transaction.destination_profile_id, v_transaction.profile_id) <> new.profile_id then
    raise exception 'A divisao deve pertencer ao espaco de destino do lancamento';
  end if;
  if new.amount > v_transaction.amount then
    raise exception 'A parte de um membro nao pode superar o valor da parcela';
  end if;
  select coalesce(sum(amount), 0) into v_already_split
  from public.transaction_splits
  where transaction_id = new.transaction_id and id <> new.id;
  if v_already_split + new.amount > v_transaction.amount then
    raise exception 'A soma das partes nao pode superar o valor da parcela';
  end if;
  if new.debtor_user_id = v_transaction.paid_by_user_id then
    raise exception 'Quem pagou nao pode dever para si mesmo';
  end if;
  if not exists (
    select 1 from public.profile_members
    where profile_id = new.profile_id and user_id = new.debtor_user_id
  ) then
    raise exception 'A pessoa escolhida nao faz parte do espaco de destino';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_transaction_split on public.transaction_splits;
create trigger validate_transaction_split
before insert or update on public.transaction_splits
for each row execute function public.fn_validate_transaction_split();

-- Enderecos reconhecidos para o usuario atual: e-mail canonico e identidades
-- vinculadas do Supabase Auth (Google/Gmail inclusive).
create or replace function public.fn_current_identity_emails()
returns table (email text)
language sql
security definer
stable
set search_path = ''
as $$
  select lower(u.email)::text
  from auth.users u
  where u.id = (select auth.uid()) and u.email is not null
  union
  select lower(i.identity_data ->> 'email')::text
  from auth.identities i
  where i.user_id = (select auth.uid())
    and nullif(i.identity_data ->> 'email', '') is not null;
$$;

create or replace function public.fn_invite_profile_member(p_profile_id uuid, p_email text)
returns text
language plpgsql
security definer
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
  ) then raise exception 'Apenas proprietarios podem convidar membros'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail invalido';
  end if;

  select u.id into v_invited_user
  from auth.users u
  where lower(u.email) = v_email
     or exists (
       select 1 from auth.identities i
       where i.user_id = u.id and lower(i.identity_data ->> 'email') = v_email
     )
  limit 1;

  if v_invited_user is not null and exists (
    select 1 from public.profile_members
    where profile_id = p_profile_id and user_id = v_invited_user
  ) then
    return 'member';
  end if;

  insert into public.profile_invitations (profile_id, email, invited_by, status)
  values (p_profile_id, v_email, v_user, 'pending')
  on conflict (profile_id, email) do update
    set invited_by = excluded.invited_by,
        status = 'pending',
        created_at = now(),
        accepted_at = null;
  return 'invited';
end;
$$;

create or replace function public.fn_pending_profile_invitations()
returns table (
  invitation_id uuid,
  profile_id uuid,
  profile_name text,
  invited_email text,
  invited_by_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    pi.id,
    pi.profile_id,
    p.name::text,
    pi.email::text,
    coalesce(
      nullif(inviter.raw_user_meta_data ->> 'full_name', ''),
      nullif(inviter.raw_user_meta_data ->> 'name', ''),
      split_part(inviter.email, '@', 1)
    )::text,
    pi.created_at
  from public.profile_invitations pi
  join public.profiles p on p.id = pi.profile_id
  join auth.users inviter on inviter.id = pi.invited_by
  where pi.status = 'pending'
    and lower(pi.email) in (select e.email from public.fn_current_identity_emails() e)
  order by pi.created_at desc;
$$;

create or replace function public.fn_respond_profile_invitation(
  p_invitation_id uuid,
  p_accept boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invitation public.profile_invitations%rowtype;
begin
  if v_user is null then raise exception 'Nao autenticado'; end if;

  select * into v_invitation
  from public.profile_invitations
  where id = p_invitation_id and status = 'pending'
  for update;

  if v_invitation.id is null
     or lower(v_invitation.email) not in (select e.email from public.fn_current_identity_emails() e) then
    raise exception 'Convite nao encontrado para esta conta';
  end if;

  if p_accept then
    insert into public.profile_members (profile_id, user_id, role)
    values (v_invitation.profile_id, v_user, 'member')
    on conflict (profile_id, user_id) do nothing;

    update public.profile_invitations
    set status = 'accepted', accepted_at = now()
    where id = p_invitation_id;
    return 'accepted';
  end if;

  update public.profile_invitations
  set status = 'cancelled', accepted_at = null
  where id = p_invitation_id;
  return 'declined';
end;
$$;

-- Mantida para compatibilidade com clientes antigos, mas sem aceite automatico.
-- O app novo exige uma decisao explicita na notificacao.
create or replace function public.fn_accept_profile_invitations()
returns integer
language sql
security definer
set search_path = ''
as $$
  select 0;
$$;

create or replace function public.fn_profile_obligations()
returns table (
  split_id uuid,
  transaction_id uuid,
  shared_profile_id uuid,
  shared_profile_name text,
  source_profile_name text,
  description text,
  occurred_at date,
  installment_number integer,
  installment_count integer,
  amount numeric,
  status text,
  payer_user_id uuid,
  payer_name text,
  debtor_user_id uuid,
  debtor_name text,
  direction text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    s.id,
    t.id,
    s.profile_id,
    shared.name::text,
    source.name::text,
    coalesce(t.description, 'Gasto compartilhado')::text,
    t.occurred_at,
    t.installment_number,
    t.installment_count,
    s.amount,
    s.status::text,
    t.paid_by_user_id,
    coalesce(
      nullif(payer.raw_user_meta_data ->> 'full_name', ''),
      nullif(payer.raw_user_meta_data ->> 'name', ''),
      split_part(payer.email, '@', 1)
    )::text,
    s.debtor_user_id,
    coalesce(
      nullif(debtor.raw_user_meta_data ->> 'full_name', ''),
      nullif(debtor.raw_user_meta_data ->> 'name', ''),
      split_part(debtor.email, '@', 1)
    )::text,
    case when s.debtor_user_id = (select auth.uid()) then 'owe' else 'receive' end::text
  from public.transaction_splits s
  join public.transactions t on t.id = s.transaction_id
  join public.profiles shared on shared.id = s.profile_id
  join public.profiles source on source.id = t.profile_id
  join auth.users payer on payer.id = t.paid_by_user_id
  join auth.users debtor on debtor.id = s.debtor_user_id
  where (s.debtor_user_id = (select auth.uid()) or t.paid_by_user_id = (select auth.uid()))
    and public.is_profile_member(s.profile_id)
  order by (s.status = 'pending') desc, t.occurred_at desc, t.installment_number;
$$;

revoke all on function public.fn_current_identity_emails() from public;
revoke all on function public.fn_pending_profile_invitations() from public;
revoke all on function public.fn_respond_profile_invitation(uuid, boolean) from public;
revoke all on function public.fn_profile_obligations() from public;
grant execute on function public.fn_current_identity_emails() to authenticated;
grant execute on function public.fn_pending_profile_invitations() to authenticated;
grant execute on function public.fn_respond_profile_invitation(uuid, boolean) to authenticated;
grant execute on function public.fn_profile_obligations() to authenticated;

-- No perfil pessoal entra apenas a parte de quem pagou. No espaco de destino
-- entra o valor integral, permitindo que a Casa/Empresa veja o gasto completo.
create or replace view public.v_bucket_spending_current
with (security_invoker = true) as
with split_totals as (
  select transaction_id, sum(amount) as shared_amount
  from public.transaction_splits
  group by transaction_id
), attributed as (
  select
    t.profile_id,
    t.category_id,
    case
      when t.destination_profile_id is not null
        then greatest(t.amount - coalesce(s.shared_amount, 0), 0)
      else t.amount
    end as amount
  from public.transactions t
  left join split_totals s on s.transaction_id = t.id
  where date_trunc('month', t.occurred_at) = date_trunc('month', current_date)
    and t.transaction_type = 'expense'
  union all
  select
    t.destination_profile_id,
    t.category_id,
    t.amount
  from public.transactions t
  where t.destination_profile_id is not null
    and t.destination_profile_id <> t.profile_id
    and date_trunc('month', t.occurred_at) = date_trunc('month', current_date)
    and t.transaction_type = 'expense'
)
select
  a.profile_id,
  coalesce(c.bucket, 'outros') as bucket,
  sum(a.amount) as total
from attributed a
left join public.categories c on c.id = a.category_id
group by a.profile_id, coalesce(c.bucket, 'outros');
