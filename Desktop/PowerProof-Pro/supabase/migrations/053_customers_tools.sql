-- 053: customer tools
--
-- 1. Notes and tags on a customer (a buyer, by email, per store): customer_profiles. It also
--    holds unsubscribed_at, set by the unsubscribe link in store emails.
-- 2. Saved segments: customer_segments (a name and simple rules, applied in the app).
-- 3. Email from the app: buyers tick "Email me news" at checkout (orders.marketing_opt_in, off
--    unless ticked). customer_audience() says who may get a store's emails; email_sends records
--    each send (history, and the daily limit).
-- All of it belongs to the store's orders-and-customers area.

alter table public.orders add column if not exists marketing_opt_in boolean not null default false;

create table if not exists public.customer_profiles (
  store_id uuid not null references public.stores(id) on delete cascade,
  email extensions.citext not null,
  note text check (note is null or char_length(note) <= 4000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (store_id, email)
);
alter table public.customer_profiles enable row level security;
drop policy if exists customer_profiles_team on public.customer_profiles;
create policy customer_profiles_team on public.customer_profiles for all
  using (public.store_can(store_id, 'orders')) with check (public.store_can(store_id, 'orders'));
-- The team edits notes and tags; only the unsubscribe link (the server's key) sets unsubscribed_at
create or replace function public.guard_unsubscribed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.unsubscribed_at := case when tg_op = 'UPDATE' then old.unsubscribed_at else null end;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists customer_profiles_guard on public.customer_profiles;
create trigger customer_profiles_guard before insert or update on public.customer_profiles
  for each row execute function public.guard_unsubscribed();
create index if not exists customer_profiles_tags_idx on public.customer_profiles using gin (tags);

create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.customer_segments enable row level security;
drop policy if exists customer_segments_team on public.customer_segments;
create policy customer_segments_team on public.customer_segments for all
  using (public.store_can(store_id, 'orders')) with check (public.store_can(store_id, 'orders'));
create index if not exists customer_segments_store_idx on public.customer_segments (store_id);

create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  subject text not null,
  recipients integer not null check (recipients >= 0),
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.email_sends enable row level security;
drop policy if exists email_sends_read on public.email_sends;
create policy email_sends_read on public.email_sends for select using (public.store_can(store_id, 'orders'));
create index if not exists email_sends_store_idx on public.email_sends (store_id, created_at desc);

-- Each buyer of the store: whether they asked for its emails (on any paid order) and haven't unsubscribed
create or replace function public.customer_audience(p_store uuid)
returns table (email text, opted_in boolean, unsubscribed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.store_can(p_store, 'orders') or public.is_admin()) then raise exception 'not_allowed'; end if;
  return query
    select o.buyer_email::text, bool_or(o.marketing_opt_in), coalesce(bool_or(cp.unsubscribed_at is not null), false)
    from public.orders o
    left join public.customer_profiles cp on cp.store_id = o.store_id and cp.email = o.buyer_email
    where o.store_id = p_store and o.status in ('paid', 'refunded', 'cod')
    group by o.buyer_email;
end $$;
revoke all on function public.customer_audience(uuid) from public, anon;
grant execute on function public.customer_audience(uuid) to authenticated;
