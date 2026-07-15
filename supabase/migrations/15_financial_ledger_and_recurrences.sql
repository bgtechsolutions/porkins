-- Ledger bancário auditável, saldos de contas e detecção de recorrências.

alter table public.accounts
  add column if not exists current_balance numeric(12,2),
  add column if not exists balance_updated_at timestamptz,
  add column if not exists credit_limit numeric(12,2),
  add column if not exists statement_closing_day integer,
  add column if not exists due_day integer;

alter table public.accounts
  drop constraint if exists accounts_statement_closing_day_check,
  add constraint accounts_statement_closing_day_check
    check (statement_closing_day is null or statement_closing_day between 1 and 31),
  drop constraint if exists accounts_due_day_check,
  add constraint accounts_due_day_check
    check (due_day is null or due_day between 1 and 31),
  drop constraint if exists accounts_credit_limit_check,
  add constraint accounts_credit_limit_check
    check (credit_limit is null or credit_limit >= 0);

alter table public.transactions
  add column if not exists external_id text,
  add column if not exists import_fingerprint text,
  add column if not exists transfer_group_id uuid,
  add column if not exists status text not null default 'confirmed';

alter table public.transactions
  drop constraint if exists transactions_status_check,
  add constraint transactions_status_check
    check (status in ('pending', 'confirmed', 'cancelled')),
  drop constraint if exists transactions_profile_import_fingerprint_key,
  add constraint transactions_profile_import_fingerprint_key
    unique (profile_id, import_fingerprint);

create index if not exists transactions_account_date_idx
  on public.transactions (account_id, occurred_at desc);
create index if not exists transactions_transfer_group_idx
  on public.transactions (transfer_group_id)
  where transfer_group_id is not null;
create index if not exists transactions_external_id_idx
  on public.transactions (external_id)
  where external_id is not null;

-- Fluxo por conta sem misturar renda/gasto com transferências internas.
create or replace view public.v_account_monthly_flow
with (security_invoker = true) as
select
  t.profile_id,
  t.account_id,
  date_trunc('month', t.occurred_at)::date as month,
  sum(case when t.transaction_type = 'income' then t.amount else 0 end) as income,
  sum(case when t.transaction_type = 'expense' then t.amount else 0 end) as expenses,
  sum(case when t.transaction_type = 'transfer_in' then t.amount else 0 end) as transfers_in,
  sum(case when t.transaction_type = 'transfer_out' then t.amount else 0 end) as transfers_out,
  sum(case when t.transaction_type = 'card_payment' then t.amount else 0 end) as card_payments,
  sum(case
    when t.transaction_type in ('income', 'transfer_in') then t.amount
    when t.transaction_type in ('expense', 'transfer_out', 'card_payment') then -t.amount
    else 0
  end) as net_cash_flow
from public.transactions t
where t.status = 'confirmed'
group by t.profile_id, t.account_id, date_trunc('month', t.occurred_at)::date;

-- Recorrências são sugestões: somente movimentos repetidos e confirmados.
create or replace view public.v_recurring_candidates
with (security_invoker = true) as
with base as (
  select
    t.profile_id,
    t.account_id,
    t.transaction_type,
    coalesce(nullif(trim(t.counterparty), ''), nullif(trim(t.description), ''), 'Sem descrição') as label,
    regexp_replace(
      lower(coalesce(nullif(trim(t.counterparty), ''), nullif(trim(t.description), ''), 'sem descricao')),
      '[^[:alnum:]]+', ' ', 'g'
    ) as recurrence_key,
    t.amount,
    t.occurred_at,
    lag(t.occurred_at) over (
      partition by t.profile_id, t.account_id, t.transaction_type,
        regexp_replace(lower(coalesce(nullif(trim(t.counterparty), ''), nullif(trim(t.description), ''), 'sem descricao')), '[^[:alnum:]]+', ' ', 'g')
      order by t.occurred_at
    ) as previous_at
  from public.transactions t
  where t.status = 'confirmed'
    and t.transaction_type in ('expense', 'income', 'transfer_in', 'transfer_out')
), grouped as (
  select
    profile_id,
    account_id,
    transaction_type,
    recurrence_key,
    max(label) as label,
    count(*) as occurrences,
    round(avg(amount), 2) as average_amount,
    round(coalesce(stddev_pop(amount), 0), 2) as amount_deviation,
    max(occurred_at) as last_occurred_at,
    round(avg((occurred_at - previous_at)::numeric), 0) as average_interval_days
  from base
  group by profile_id, account_id, transaction_type, recurrence_key
  having count(*) >= 3
)
select
  g.*,
  case
    when average_interval_days between 26 and 35 then 'monthly'
    when average_interval_days between 12 and 16 then 'biweekly'
    when average_interval_days between 6 and 8 then 'weekly'
    else 'frequent'
  end as frequency,
  case
    when average_interval_days between 5 and 45
      then last_occurred_at + average_interval_days::integer
    else null
  end as expected_next_at,
  case
    when average_amount > 0 and amount_deviation / average_amount <= 0.05 then 'high'
    when average_amount > 0 and amount_deviation / average_amount <= 0.20 then 'medium'
    else 'low'
  end as confidence
from grouped g;

grant select on public.v_account_monthly_flow to authenticated;
grant select on public.v_recurring_candidates to authenticated;
