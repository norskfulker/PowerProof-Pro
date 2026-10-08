-- 018: lead forms, squeeze pages, booking calendars and the marketplace.
-- leads: what visitors submit on a store's pages (a form, a booking, a newsletter signup).
-- submit_lead / booked_slots: the only way a visitor writes or reads anything here.
-- marketplace_listings: live products across published stores, with price, offer and units sold.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  page_id uuid references public.custom_pages(id) on delete set null,
  kind text not null check (kind in ('lead', 'booking', 'newsletter')),
  name text check (name is null or char_length(name) <= 120),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or char_length(phone) <= 30),
  data jsonb not null default '{}' check (pg_column_size(data) <= 4096),
  slot_at timestamptz,
  slot_minutes integer check (slot_minutes is null or slot_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  check ((kind = 'booking') = (slot_at is not null))
);
create index leads_store_created on public.leads (store_id, created_at desc);
-- A time on a page's calendar can be booked once
create unique index leads_booking_slot on public.leads (page_id, slot_at) where kind = 'booking';
-- One newsletter signup per address per store
create unique index leads_newsletter_once on public.leads (store_id, lower(email)) where kind = 'newsletter';

alter table public.leads enable row level security;
create policy leads_owner_read on public.leads for select to authenticated using (public.is_store_owner(store_id) or public.is_admin());
create policy leads_owner_delete on public.leads for delete to authenticated using (public.is_store_owner(store_id));
grant select, delete on public.leads to authenticated;

create or replace function public.submit_lead(
  p_store_slug text, p_page_slug text, p_kind text,
  p_name text, p_email text, p_phone text, p_data jsonb,
  p_slot timestamptz default null, p_minutes integer default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid; pid uuid;
begin
  if p_kind not in ('lead', 'booking', 'newsletter') then raise exception 'lead_invalid'; end if;
  select s.id into sid from public.stores s where s.slug = p_store_slug and s.status = 'published';
  if sid is null then raise exception 'lead_store_not_found'; end if;
  if p_page_slug is not null then
    select c.id into pid from public.custom_pages c where c.store_id = sid and c.slug = p_page_slug and c.status = 'published';
    if pid is null then raise exception 'lead_page_not_found'; end if;
  end if;
  if p_kind <> 'newsletter' and pid is null then raise exception 'lead_page_not_found'; end if;
  if p_kind = 'booking' and (p_slot is null or p_slot < now() or p_slot > now() + interval '90 days' or extract(minute from p_slot)::int % 5 <> 0 or p_minutes is null) then
    raise exception 'booking_invalid';
  end if;
  -- the same person submitting the same page again within a minute is a double click, not a new lead
  if p_email is not null and exists (select 1 from public.leads l where l.store_id = sid and l.page_id is not distinct from pid and lower(l.email) = lower(p_email) and l.created_at > now() - interval '1 minute') then
    return;
  end if;
  -- at most 20 submissions a day per store from one address
  if p_email is not null and (select count(*) from public.leads l where l.store_id = sid and lower(l.email) = lower(p_email) and l.created_at > now() - interval '1 day') >= 20 then
    raise exception 'lead_rate_limited';
  end if;
  begin
    insert into public.leads (store_id, page_id, kind, name, email, phone, data, slot_at, slot_minutes)
    values (sid, pid, p_kind, nullif(trim(p_name), ''), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), coalesce(p_data, '{}'::jsonb), case when p_kind = 'booking' then p_slot end, case when p_kind = 'booking' then p_minutes end);
  exception when unique_violation then
    if p_kind = 'booking' then raise exception 'booking_taken'; end if;
    -- already on the newsletter list: nothing to do
  end;
end $$;
revoke all on function public.submit_lead(text, text, text, text, text, text, jsonb, timestamptz, integer) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text, jsonb, timestamptz, integer) to anon, authenticated;

-- Times already taken on a page's calendar (nothing about who booked them)
create or replace function public.booked_slots(p_store_slug text, p_page_slug text, p_from timestamptz, p_to timestamptz)
returns table (slot_at timestamptz, slot_minutes integer)
language sql stable security definer set search_path = '' as $$
  select l.slot_at, l.slot_minutes from public.leads l
  join public.custom_pages c on c.id = l.page_id and c.slug = p_page_slug and c.status = 'published'
  join public.stores s on s.id = c.store_id and s.slug = p_store_slug and s.status = 'published'
  where l.kind = 'booking' and l.slot_at >= p_from and l.slot_at < p_to
$$;
revoke all on function public.booked_slots(text, text, timestamptz, timestamptz) from public;
grant execute on function public.booked_slots(text, text, timestamptz, timestamptz) to anon, authenticated;

-- The marketplace -------------------------------------------------------------------------
create or replace function public.marketplace_listings(p_search text default null, p_limit integer default 48, p_offset integer default 0)
returns table (
  product_id uuid, title text, slug text, description text, currency text,
  price_minor bigint, compare_at_minor bigint, cover_url text, cover_bg text,
  store_name text, store_slug text, fulfilment text, units bigint,
  deal_label text, deal_ends_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.slug, left(p.description, 200), p.currency,
    p.price_minor::bigint, p.compare_at_price_minor::bigint,
    (select m.url from public.product_media m where m.product_id = p.id and m.kind = 'image' order by m.sort_order limit 1),
    p.cover_bg, s.name, s.slug, p.fulfilment,
    coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.product_id = p.id and o.status = 'paid' and not oi.is_gift), 0)::bigint,
    (select case when r.reward = 'free_product' then r.name || ': free gift' else r.name || ': ' || round(coalesce(r.percent_bps, 0) / 100.0)::int || '% off' end
       from public.deal_rules r
       where r.store_id = p.store_id and r.active and p.id = any (r.trigger_product_ids)
         and (r.starts_at is null or r.starts_at <= now()) and (r.ends_at is null or r.ends_at > now())
       order by r.percent_bps desc nulls last limit 1),
    (select r.ends_at from public.deal_rules r
       where r.store_id = p.store_id and r.active and p.id = any (r.trigger_product_ids)
         and (r.starts_at is null or r.starts_at <= now()) and r.ends_at > now()
       order by r.ends_at limit 1)
  from public.products p
  join public.stores s on s.id = p.store_id and s.status = 'published'
  where p.status = 'live'
    and (p_search is null or p.title ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%' or s.name ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%')
  order by 13 desc, p.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;
revoke all on function public.marketplace_listings(text, integer, integer) from public;
grant execute on function public.marketplace_listings(text, integer, integer) to anon, authenticated;
