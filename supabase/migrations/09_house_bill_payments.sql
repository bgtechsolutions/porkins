-- ============================================================================
-- Migration 09: Controle de pagamento das contas da casa (por mês)
-- Marca uma conta recorrente como paga em um mês específico (ym = 'AAAA-MM').
-- ============================================================================
create table house_bill_payments (
  id         uuid primary key default gen_random_uuid(),
  cost_id    uuid not null references house_costs(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  ym         text not null,                 -- '2026-07'
  paid_at    timestamptz not null default now(),
  unique (cost_id, ym)
);

alter table house_bill_payments enable row level security;
create policy hbp_member on house_bill_payments
  for all to authenticated
  using (is_profile_member(profile_id))
  with check (is_profile_member(profile_id));
