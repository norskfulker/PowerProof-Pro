-- 023: first-party visit counting for storefronts. No cookies and no personal data: a random
-- per-tab session id, the page, and where the visit came from. Feeds the dashboard's Visitors,
-- Where buyers come from, and Funnel. Visitors write only through track_event.

create table public.store_events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('view', 'product')),
  path text not null check (char_length(path) <= 300),
  product_id uuid references public.products(id) on delete set null,
  source text not null default 'direct' check (char_length(source) <= 60),
  session text not null check (char_length(session) between 8 and 40),
  created_at timestamptz not null default now()
);
create index store_events_store_time on public.store_events (store_id, created_at desc);

alter table public.store_events enable row level security;
create policy store_events_owner_read on public.store_events for select to authenticated using (public.is_store_owner(store_id) or public.is_admin());
grant select on public.store_events to authenticated;

create or replace function public.track_event(p_store_slug text, p_kind text, p_path text, p_product uuid, p_source text, p_session text)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if p_kind not in ('view', 'product') or char_length(coalesce(p_session, '')) < 8 then return; end if;
  select s.id into sid from public.stores s where s.slug = p_store_slug and s.status = 'published';
  if sid is null then return; end if;
  -- one browser can't flood a store's numbers
  if (select count(*) from public.store_events e where e.store_id = sid and e.session = p_session and e.created_at > now() - interval '1 day') >= 300 then return; end if;
  insert into public.store_events (store_id, kind, path, product_id, source, session)
  values (sid, p_kind, left(coalesce(p_path, '/'), 300),
    (select p.id from public.products p where p.id = p_product and p.store_id = sid),
    left(coalesce(nullif(trim(p_source), ''), 'direct'), 60), left(p_session, 40));
end $$;
revoke all on function public.track_event(text, text, text, uuid, text, text) from public;
grant execute on function public.track_event(text, text, text, uuid, text, text) to anon, authenticated;

-- The store owner's visit numbers for a period: visitors, a daily series, sources and the funnel
create or replace function public.analytics_visits(p_store uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare out jsonb;
begin
  if not (public.is_store_owner(p_store) or public.is_admin()) then raise exception 'not_allowed'; end if;
  select jsonb_build_object(
    'visitors', (select count(distinct session) from public.store_events where store_id = p_store and created_at >= p_from and created_at < p_to),
    'viewers', (select count(distinct session) from public.store_events where store_id = p_store and kind = 'product' and created_at >= p_from and created_at < p_to),
    'started', (select count(*) from public.orders where store_id = p_store and created_at >= p_from and created_at < p_to),
    'paid', (select count(*) from public.orders where store_id = p_store and status = 'paid' and created_at >= p_from and created_at < p_to),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'visitors', n) order by d) from (
        select (created_at at time zone 'Asia/Kolkata')::date d, count(distinct session) n from public.store_events
        where store_id = p_store and created_at >= p_from and created_at < p_to group by 1) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'visitors', n) order by n desc) from (
        select source, count(distinct session) n from public.store_events
        where store_id = p_store and created_at >= p_from and created_at < p_to group by 1 order by 2 desc limit 8) y), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.analytics_visits(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.analytics_visits(uuid, timestamptz, timestamptz) to authenticated;
