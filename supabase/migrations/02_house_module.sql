-- ============================================================================
-- Migration 02: Módulo Casa (enxoval e custos de mudança)
-- ============================================================================
create type product_status as enum ('pendente', 'pesquisando', 'comprado', 'presente');
create type house_cost_type as enum ('recorrente', 'entrada');

-- Controle de Produtos — página "pai" das planilhas (Prioridades e Enxoval eram
-- só visões filtradas dela; aqui vira UMA tabela).
create table house_products (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  category       text,                       -- Cozinha, Mesa, Cama e banho...
  name           text not null,
  priority       int,                        -- 1 = mais urgente
  ideal_qty      text,
  planned_month  text,
  buy_when       text,                       -- "Antes da mudança", "Após imóvel definido"...
  min_value      numeric(12,2),
  max_value      numeric(12,2),
  budget_base    numeric(12,2),              -- média orçada
  real_value     numeric(12,2) default 0,    -- gasto real
  status         product_status not null default 'pendente',
  paid_by        text,                       -- Casal, Gabriel, Bárbara, Nenhum
  split_barbara  numeric(5,4) default 0.5,   -- rateio da Bárbara (resto é do Gabriel)
  store_link     text,
  notes          text
);

-- Gastos na Mudança — despesas recorrentes (aluguel, luz...) e de entrada
-- (geladeira, fogão...). Rateio proporcional à renda: Bárbara ~63,4% / Gabriel ~36,6%.
create table house_costs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  cost_type      house_cost_type not null,
  name           text not null,
  min_value      numeric(12,2),
  max_value      numeric(12,2),
  expected_value numeric(12,2),
  essential      boolean default true,
  buy_when       text,                       -- só para 'entrada'
  barbara_pct    numeric(5,4) default 0.6341,
  gabriel_pct    numeric(5,4) default 0.3659,
  note           text
);

alter table house_products enable row level security;
alter table house_costs    enable row level security;
create policy hp_member on house_products
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
create policy hc_member on house_costs
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
