-- Server-side push pipeline: DB triggers that fan activity + message inserts
-- out to the `push` edge function via pg_net (async, non-blocking).
--
-- The webhook secret lives in Supabase Vault under 'push_webhook_secret'. If it
-- is absent the trigger is dormant (returns NEW without posting) so the pipeline
-- can be deployed before it is provisioned. pg_net only enqueues the HTTP post
-- (delivery happens out-of-band), and the whole body is exception-guarded so a
-- Vault/enqueue error never rolls back the originating insert.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  webhook_secret text;
begin
  begin
    select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
    where name = 'push_webhook_secret'
    limit 1;

    -- Dormant until the secret is provisioned in Vault.
    if webhook_secret is null then
      return new;
    end if;

    perform net.http_post(
      url := 'https://qjuiqeclnrvkyjnqltxq.supabase.co/functions/v1/push',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-push-secret', webhook_secret
      ),
      body := jsonb_build_object(
        'kind', TG_ARGV[0],
        'record', to_jsonb(new)
      )
    );
  exception
    when others then
      -- Never block the transaction on push enqueue problems. pg_net only
      -- enqueues the request here (actual delivery happens out-of-band), so
      -- this guard covers Vault lookup and enqueue errors, not delivery.
      return new;
  end;

  return new;
end;
$$;

revoke all on function public.notify_push() from public;

drop trigger if exists activity_events_notify_push on public.activity_events;
create trigger activity_events_notify_push
  after insert on public.activity_events
  for each row
  execute function public.notify_push('activity');

drop trigger if exists messages_notify_push on public.messages;
create trigger messages_notify_push
  after insert on public.messages
  for each row
  execute function public.notify_push('message');
