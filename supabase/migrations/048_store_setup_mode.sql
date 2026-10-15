-- 048: how a store was set up (with AI or by hand) and when it first opened to buyers.
-- Until the store first opens (status becomes 'published'), the creator may switch between the
-- two setups as often as they like. From then on the choice is fixed: the database refuses a
-- change. first_opened_at is only ever written by the trigger, never by the app.

alter table public.stores
  add column if not exists setup_mode text not null default 'manual' check (setup_mode in ('ai', 'manual')),
  add column if not exists first_opened_at timestamptz;

-- Stores that are already open count as opened (their last change is the closest record we have)
update public.stores set first_opened_at = coalesce(updated_at, created_at) where status = 'published' and first_opened_at is null;

create or replace function public.store_first_open()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.first_opened_at := case when new.status = 'published' then now() end;
    return new;
  end if;
  -- Set once, by the first open; never cleared or moved
  new.first_opened_at := coalesce(old.first_opened_at, case when new.status = 'published' then now() end);
  if old.first_opened_at is not null and new.setup_mode is distinct from old.setup_mode then
    raise exception 'setup_mode_locked: the store has opened, so its setup can no longer be switched' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists stores_first_open on public.stores;
create trigger stores_first_open before insert or update on public.stores
  for each row execute function public.store_first_open();
