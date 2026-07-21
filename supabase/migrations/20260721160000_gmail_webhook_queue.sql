alter table public.gmail_connections
  add column if not exists pending_history_id text,
  add column if not exists last_pubsub_message_id text,
  add column if not exists sync_lock_until timestamptz;

create unique index if not exists gmail_connections_pubsub_message_unique
  on public.gmail_connections(last_pubsub_message_id)
  where last_pubsub_message_id is not null;

create or replace function public.enqueue_gmail_sync(
  target_user_id uuid,
  incoming_history_id text,
  incoming_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  connection public.gmail_connections%rowtype;
  should_start boolean := false;
begin
  select * into connection
  from public.gmail_connections
  where user_id = target_user_id
  for update;

  if not found then
    return false;
  end if;

  if connection.last_pubsub_message_id = incoming_message_id then
    return false;
  end if;

  update public.gmail_connections
  set pending_history_id = case
        when pending_history_id is null then incoming_history_id
        when pending_history_id ~ '^[0-9]+$'
          and incoming_history_id ~ '^[0-9]+$'
          and incoming_history_id::numeric > pending_history_id::numeric
          then incoming_history_id
        else pending_history_id
      end,
      last_pubsub_message_id = incoming_message_id,
      sync_lock_until = case
        when sync_lock_until is null or sync_lock_until < now()
          then now() + interval '5 minutes'
        else sync_lock_until
      end,
      updated_at = now()
  where user_id = target_user_id;

  should_start := connection.sync_lock_until is null or connection.sync_lock_until < now();
  return should_start;
end;
$$;

revoke all on function public.enqueue_gmail_sync(uuid, text, text) from public, anon, authenticated;
grant execute on function public.enqueue_gmail_sync(uuid, text, text) to service_role;