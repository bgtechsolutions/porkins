-- ============================================================================
-- Porkin — Controle financeiro do Gabriel, da Bárbara e da Casa
-- Migration 01: Schema central
-- ============================================================================

-- ----- Tipos (enums) --------------------------------------------------------
create type profile_type   as enum ('pessoal', 'compartilhado');
create type account_kind   as enum ('debito', 'credito', 'conta', 'dinheiro');
create type txn_source     as enum ('manual', 'csv', 'email');
create type goal_priority  as enum ('alta', 'media', 'baixa');
create type goal_status    as enum ('em_andamento', 'concluida', 'pausada');
create type goal_kind      as enum ('reserva', 'curto_prazo', 'medio_prazo', 'longo_prazo');

-- ----- Perfis ---------------------------------------------------------------
-- Gabriel, Bárbara e Casa (compartilhado)
create table profiles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            profile_type not null default 'pessoal',
  color           text,                       -- cor pra UI
  monthly_income  numeric(12,2),              -- renda mensal de referência (nula em perfil compartilhado)
  created_at      timestamptz not null default now()
);

-- Vínculo usuário<->perfil (many-to-many): a Casa tem os dois como membros.
-- Preenchido quando o login (auth) for configurado.
create table profile_members (
  profile_id  uuid not null references profiles(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner',
  primary key (profile_id, user_id)
);

-- ----- Fontes de renda ------------------------------------------------------
create table income_sources (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  name        text not null,                  -- Salário fixo, BG Tech, Vale-combustível...
  kind        text,                           -- salario | beneficio | extra
  amount      numeric(12,2) not null default 0,
  is_variable boolean not null default false, -- hora extra / vale variam
  active      boolean not null default true
);

-- ----- Contas e cartões -----------------------------------------------------
create table accounts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  name        text not null,                  -- Nubank Débito, Nubank Crédito, Black, Santander
  kind        account_kind not null default 'conta',
  active      boolean not null default true
);

-- ----- Categorias (padronizadas) --------------------------------------------
-- Substituem "uma linha por estabelecimento" das planilhas.
-- bucket liga a categoria à regra de distribuição do perfil.
create table categories (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,              -- Mercado, Transporte, Saúde, Assinaturas...
  bucket   text not null default 'essencial', -- essencial | lazer | obrigatoria | nao_obrigatoria | investimento
  icon     text,
  is_income boolean not null default false
);

-- ----- Regra de distribuição por perfil -------------------------------------
-- Gabriel 60/20/10/10 ; Bárbara 60/30/10 ; Casa 70/30
create table allocation_rules (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  bucket      text not null,                  -- mesmo vocabulário de categories.bucket
  label       text not null,                  -- rótulo amigável ("Despesas essenciais")
  percentage  numeric(5,4) not null,          -- 0.6000 = 60%
  unique (profile_id, bucket)
);

-- ----- Transações (o coração) -----------------------------------------------
create table transactions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  category_id  uuid references categories(id) on delete set null,
  description  text,                           -- estabelecimento / o que foi
  amount       numeric(12,2) not null,         -- positivo = gasto
  occurred_at  date not null default current_date,
  source       txn_source not null default 'manual',
  needs_review boolean not null default false, -- true quando a LLM não soube classificar -> notificação
  raw_text     text,                           -- corpo do e-mail / linha do CSV de origem
  created_at   timestamptz not null default now()
);
create index on transactions (profile_id, occurred_at);
create index on transactions (category_id);
create index on transactions (needs_review) where needs_review;

-- ----- Metas / Caixinhas ----------------------------------------------------
create table goals (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  name           text not null,
  target_amount  numeric(12,2) not null,
  current_amount numeric(12,2) not null default 0,
  deadline       date,
  priority       goal_priority not null default 'media',
  weight         numeric(4,1) not null default 1,   -- peso pra sugestão de aporte
  kind           goal_kind not null default 'curto_prazo',
  status         goal_status not null default 'em_andamento',
  joint_group    text,                              -- 'casa_futura' liga a caixinha Casa dos dois
  created_at     timestamptz not null default now()
);
create index on goals (profile_id);
create index on goals (joint_group);

-- ----- Aportes (histórico de investimentos) ---------------------------------
create table contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references goals(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade, -- quem aportou (útil em meta conjunta)
  amount         numeric(12,2) not null,
  contributed_at date not null default current_date,
  note           text
);
create index on contributions (goal_id, contributed_at);

-- ============================================================================
-- RLS — segurança por perfil. Serviço (migrations/seed) ignora RLS.
-- O acesso do app é liberado só pra membros do perfil (profile_members).
-- ============================================================================
create or replace function is_profile_member(p_profile_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profile_members m
    where m.profile_id = p_profile_id and m.user_id = auth.uid()
  );
$$;

alter table profiles         enable row level security;
alter table profile_members  enable row level security;
alter table income_sources   enable row level security;
alter table accounts         enable row level security;
alter table allocation_rules enable row level security;
alter table transactions     enable row level security;
alter table goals            enable row level security;
alter table contributions    enable row level security;
alter table categories       enable row level security;

-- Categorias são globais e legíveis por qualquer usuário autenticado.
create policy categories_read on categories for select to authenticated using (true);

-- Perfis: o membro vê e edita o próprio perfil.
create policy profiles_member  on profiles
  for all to authenticated using (is_profile_member(id)) with check (is_profile_member(id));
create policy members_self on profile_members
  for select to authenticated using (user_id = auth.uid());

-- Demais tabelas: acesso liberado a membros do perfil dono da linha.
create policy income_member on income_sources
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
create policy accounts_member on accounts
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
create policy alloc_member on allocation_rules
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
create policy txn_member on transactions
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
create policy goals_member on goals
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
create policy contrib_member on contributions
  for all to authenticated using (is_profile_member(profile_id)) with check (is_profile_member(profile_id));
