-- Integração privada com Gmail. Estas tabelas são acessíveis somente pela
-- service role; nem mesmo usuários autenticados podem ler os tokens.
create table gmail_connections (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  profile_id                uuid not null references profiles(id) on delete cascade,
  gmail_email               text not null unique,
  encrypted_refresh_token   text not null,
  last_history_id           text,
  watch_expiration          timestamptz,
  last_synced_at            timestamptz,
  last_error                text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table email_imports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  profile_id         uuid not null references profiles(id) on delete cascade,
  gmail_message_id   text not null unique,
  subject            text,
  received_at        timestamptz,
  status             text not null default 'processing'
                     check (status in ('processing', 'imported', 'ignored', 'error')),
  transaction_id     uuid references transactions(id) on delete set null,
  error              text,
  created_at         timestamptz not null default now()
);

create index email_imports_user_received_idx on email_imports (user_id, received_at desc);

alter table gmail_connections enable row level security;
alter table email_imports enable row level security;

-- Sem policies de usuário intencionalmente. A service role ignora RLS.
revoke all on gmail_connections from anon, authenticated;
revoke all on email_imports from anon, authenticated;

