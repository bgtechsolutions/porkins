-- Módulo empresarial: contratos, recebíveis, conciliação e distribuição entre sócios.

create table if not exists public.business_clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  tax_id text,
  email text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (profile_id, name)
);

create table if not exists public.business_contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.business_clients(id) on delete cascade,
  code text not null,
  revenue_type text not null check (revenue_type in ('implementation', 'recurring')),
  total_amount numeric(12,2),
  monthly_amount numeric(12,2),
  installment_count integer check (installment_count is null or installment_count > 0),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  unique (profile_id, code, revenue_type)
);

create table if not exists public.business_receivables (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.business_clients(id) on delete restrict,
  contract_id uuid references public.business_contracts(id) on delete set null,
  external_ref text,
  revenue_type text not null check (revenue_type in ('implementation', 'recurring')),
  description text not null,
  competence_month date not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  installment_number integer,
  installment_count integer,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at date,
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  direct_cost_amount numeric(12,2) not null default 0 check (direct_cost_amount >= 0),
  provider text,
  created_at timestamptz not null default now(),
  unique (profile_id, external_ref)
);

create table if not exists public.business_payment_matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  receivable_id uuid not null references public.business_receivables(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (receivable_id, transaction_id)
);

create table if not exists public.business_allocation_policies (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  revenue_type text not null check (revenue_type in ('implementation', 'recurring')),
  calculation_base text not null default 'gross' check (calculation_base in ('gross', 'net')),
  company_percentage numeric(7,6) not null check (company_percentage between 0 and 1),
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, revenue_type, effective_from)
);

create table if not exists public.business_partner_shares (
  policy_id uuid not null references public.business_allocation_policies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  percentage numeric(7,6) not null check (percentage between 0 and 1),
  primary key (policy_id, user_id)
);

create table if not exists public.business_partner_payables (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  receivable_id uuid references public.business_receivables(id) on delete set null,
  policy_id uuid references public.business_allocation_policies(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payable_type text not null default 'distribution' check (payable_type in ('pro_labore', 'distribution', 'advance', 'reimbursement')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived')),
  due_date date,
  paid_at date,
  payout_transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists business_receivables_profile_status_due_idx on public.business_receivables(profile_id, status, due_date);
create index if not exists business_receivables_contract_idx on public.business_receivables(contract_id);
create index if not exists business_matches_transaction_idx on public.business_payment_matches(transaction_id);
create index if not exists business_payables_profile_status_idx on public.business_partner_payables(profile_id, status, due_date);

alter table public.business_clients enable row level security;
alter table public.business_contracts enable row level security;
alter table public.business_receivables enable row level security;
alter table public.business_payment_matches enable row level security;
alter table public.business_allocation_policies enable row level security;
alter table public.business_partner_shares enable row level security;
alter table public.business_partner_payables enable row level security;

create policy business_clients_member on public.business_clients for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy business_contracts_member on public.business_contracts for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy business_receivables_member on public.business_receivables for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy business_matches_member on public.business_payment_matches for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy business_policies_member on public.business_allocation_policies for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy business_shares_member on public.business_partner_shares for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
create policy business_payables_member on public.business_partner_payables for all to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));

create or replace function public.fn_save_business_allocation_policy(
  p_profile_id uuid,
  p_revenue_type text,
  p_calculation_base text,
  p_company_percentage numeric,
  p_partner_user_ids uuid[],
  p_partner_percentages numeric[]
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_policy_id uuid;
  v_total numeric;
  v_index integer;
begin
  if not is_profile_member(p_profile_id) then raise exception 'Acesso negado'; end if;
  if p_revenue_type not in ('implementation', 'recurring') then raise exception 'Tipo de receita inválido'; end if;
  if p_calculation_base not in ('gross', 'net') then raise exception 'Base de cálculo inválida'; end if;
  if cardinality(p_partner_user_ids) <> cardinality(p_partner_percentages) then raise exception 'Divisão inválida'; end if;
  if exists (select 1 from unnest(p_partner_user_ids) u where not exists (select 1 from profile_members m where m.profile_id = p_profile_id and m.user_id = u)) then raise exception 'Sócio não pertence ao espaço'; end if;
  v_total := coalesce(p_company_percentage, 0) + coalesce((select sum(x) from unnest(p_partner_percentages) x), 0);
  if abs(v_total - 1) > 0.00001 then raise exception 'Empresa e sócios devem somar 100%%'; end if;

  delete from business_allocation_policies
    where profile_id = p_profile_id and revenue_type = p_revenue_type and effective_from = current_date;
  update business_allocation_policies set active = false, effective_to = current_date - 1
    where profile_id = p_profile_id and revenue_type = p_revenue_type and active;
  insert into business_allocation_policies(profile_id, revenue_type, calculation_base, company_percentage)
    values (p_profile_id, p_revenue_type, p_calculation_base, p_company_percentage)
    returning id into v_policy_id;
  if cardinality(p_partner_user_ids) > 0 then
    for v_index in 1..cardinality(p_partner_user_ids) loop
      insert into business_partner_shares(policy_id, profile_id, user_id, percentage)
      values (v_policy_id, p_profile_id, p_partner_user_ids[v_index], p_partner_percentages[v_index]);
    end loop;
  end if;
  return v_policy_id;
end;
$$;

create or replace function public.fn_mark_business_receivable_paid(
  p_receivable_id uuid,
  p_paid_at date,
  p_fee_amount numeric default 0,
  p_tax_amount numeric default 0,
  p_direct_cost_amount numeric default 0,
  p_transaction_id uuid default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_receivable business_receivables%rowtype;
  v_policy business_allocation_policies%rowtype;
  v_base numeric;
  v_share record;
begin
  select * into v_receivable from business_receivables where id = p_receivable_id for update;
  if v_receivable.id is null or not is_profile_member(v_receivable.profile_id) then raise exception 'Recebível não encontrado'; end if;
  if least(p_fee_amount, p_tax_amount, p_direct_cost_amount) < 0 then raise exception 'Custos não podem ser negativos'; end if;
  update business_receivables set status = 'paid', paid_at = p_paid_at,
    fee_amount = p_fee_amount, tax_amount = p_tax_amount, direct_cost_amount = p_direct_cost_amount
    where id = p_receivable_id;
  if p_transaction_id is not null then
    if not exists (select 1 from transactions where id = p_transaction_id and profile_id = v_receivable.profile_id) then raise exception 'Movimento bancário inválido'; end if;
    insert into business_payment_matches(profile_id, receivable_id, transaction_id, amount)
    values (v_receivable.profile_id, p_receivable_id, p_transaction_id, v_receivable.amount)
    on conflict (receivable_id, transaction_id) do nothing;
  end if;
  if exists (select 1 from business_partner_payables where receivable_id = p_receivable_id and payable_type = 'distribution') then return; end if;
  select * into v_policy from business_allocation_policies
    where profile_id = v_receivable.profile_id and revenue_type = v_receivable.revenue_type
      and active and effective_from <= p_paid_at and (effective_to is null or effective_to >= p_paid_at)
    order by effective_from desc limit 1;
  if v_policy.id is null then return; end if;
  v_base := case when v_policy.calculation_base = 'net'
    then greatest(0, v_receivable.amount - p_fee_amount - p_tax_amount - p_direct_cost_amount)
    else v_receivable.amount end;
  for v_share in select user_id, percentage from business_partner_shares where policy_id = v_policy.id loop
    insert into business_partner_payables(profile_id, receivable_id, policy_id, user_id, amount, due_date)
    values (v_receivable.profile_id, p_receivable_id, v_policy.id, v_share.user_id, round(v_base * v_share.percentage, 2), p_paid_at)
    on conflict do nothing;
  end loop;
end;
$$;

revoke execute on function public.fn_save_business_allocation_policy(uuid,text,text,numeric,uuid[],numeric[]) from public, anon;
revoke execute on function public.fn_mark_business_receivable_paid(uuid,date,numeric,numeric,numeric,uuid) from public, anon;
grant execute on function public.fn_save_business_allocation_policy(uuid,text,text,numeric,uuid[],numeric[]) to authenticated;
grant execute on function public.fn_mark_business_receivable_paid(uuid,date,numeric,numeric,numeric,uuid) to authenticated;

