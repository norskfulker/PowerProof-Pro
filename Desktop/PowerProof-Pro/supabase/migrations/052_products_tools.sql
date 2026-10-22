-- 052: product tools
--
-- 1. Low-stock alerts per product: products.low_stock_at (default 5) is the level that raises the
--    bell (before it was 5 for everything); the cron job also emails the owner once per alert
--    (notifications.emailed_at), unless they switched low-stock emails off.
-- 2. Scheduled publishing: products.publish_at / unpublish_at. run_product_schedule() (the
--    10-minute cron) puts due drafts live (when they're ready: a file for downloads, a collection
--    for things that ship) and due live products back to drafts. A draft that isn't ready stays a
--    draft and the bell says why.
-- 3. product_stats: one product's views, orders, units, revenue, refunds, conversion, daily trend
--    and sources for a period (the product page's Performance panel and Analytics' drill-down).

alter table public.products
  add column if not exists low_stock_at integer not null default 5 check (low_stock_at between 0 and 100000),
  add column if not exists publish_at timestamptz,
  add column if not exists unpublish_at timestamptz;
create index if not exists products_publish_due_idx on public.products (publish_at) where publish_at is not null;
create index if not exists products_unpublish_due_idx on public.products (unpublish_at) where unpublish_at is not null;

alter table public.notifications add column if not exists emailed_at timestamptz;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order', 'cod', 'refund', 'dispute', 'review', 'question', 'lead', 'payout_paid', 'payout_failed', 'low_stock', 'shipped', 'scheduled'));

/* 1. Low stock at each product's own level ---------------------------------------- */

create or replace function public.notify_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_title text; v_product uuid; v_at integer;
begin
  if tg_table_name = 'products' then
    v_store := new.store_id; v_title := new.title; v_product := new.id; v_at := new.low_stock_at;
  else
    select p.store_id, p.title || ' (' || new.title || ')', p.id, p.low_stock_at into v_store, v_title, v_product, v_at from public.products p where p.id = new.product_id;
  end if;
  -- Once each time it drops to the level (not again while it stays below)
  if new.stock is null or new.stock > v_at or (old.stock is not null and old.stock <= v_at) then return null; end if;
  perform public.notify(v_store, 'low_stock', case when new.stock = 0 then 'Sold out: ' else 'Running low: ' end || v_title,
    case when new.stock = 0 then 'Nobody can buy it until you add stock.' else new.stock || ' left.' end,
    '/catalog/products/' || v_product, 'catalog', 'stock:' || new.id || ':' || extract(epoch from now())::bigint / 3600);
  return null;
end $$;

/* 2. Scheduled publishing ---------------------------------------------------------- */

create or replace function public.run_product_schedule() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; v_live int := 0; v_draft int := 0; v_blocked int := 0; v_ready boolean;
begin
  for r in select p.* from public.products p where p.publish_at is not null and p.publish_at <= now() and p.status = 'draft' for update skip locked loop
    v_ready := case when r.fulfilment = 'physical'
      then exists (select 1 from public.collection_items c where c.product_id = r.id)
      else exists (select 1 from public.product_files f where f.product_id = r.id) end;
    if v_ready then
      update public.products set status = 'live', publish_at = null where id = r.id;
      v_live := v_live + 1;
    else
      update public.products set publish_at = null where id = r.id;
      perform public.notify(r.store_id, 'scheduled', 'Didn''t go live: ' || r.title,
        case when r.fulfilment = 'physical' then 'Put it in a collection, then publish it.' else 'Add the file buyers download, then publish it.' end,
        '/catalog/products/' || r.id, 'catalog', 'schedule:' || r.id || ':' || extract(epoch from now())::bigint);
      v_blocked := v_blocked + 1;
    end if;
  end loop;
  -- A product that was published by hand in the meantime just forgets its schedule
  update public.products set publish_at = null where publish_at is not null and publish_at <= now() and status <> 'draft';
  with gone as (
    update public.products set status = 'draft', unpublish_at = null where unpublish_at is not null and unpublish_at <= now() and status = 'live' returning id
  ) select count(*) into v_draft from gone;
  update public.products set unpublish_at = null where unpublish_at is not null and unpublish_at <= now();
  return jsonb_build_object('published', v_live, 'unpublished', v_draft, 'blocked', v_blocked);
end $$;
revoke all on function public.run_product_schedule() from public, anon, authenticated;

/* 3. One product's numbers --------------------------------------------------------- */

create or replace function public.product_stats(p_product uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare sid uuid; out jsonb;
begin
  select store_id into sid from public.products where id = p_product;
  if sid is null or not (public.store_can(sid, 'catalog') or public.store_can(sid, 'analytics') or public.is_admin()) then raise exception 'not_allowed'; end if;
  with sold as (
    select o.id, o.status, o.created_at, sum(i.quantity) units, sum(i.line_total_minor) revenue
    from public.orders o join public.order_items i on i.order_id = o.id and i.product_id = p_product
    where o.store_id = sid and o.created_at >= p_from and o.created_at < p_to and o.status in ('paid', 'refunded')
    group by o.id, o.status, o.created_at
  ),
  views as (
    select session, source, created_at from public.store_events
    where store_id = sid and kind = 'product' and product_id = p_product and created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'viewers', (select count(distinct session) from views),
    'orders', (select count(*) from sold where status = 'paid'),
    'units', coalesce((select sum(units) from sold where status = 'paid'), 0),
    'revenue', coalesce((select sum(revenue) from sold where status = 'paid'), 0),
    'refunds', (select count(*) from sold where status = 'refunded'),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'revenue', rev, 'orders', n, 'viewers', v) order by d) from (
        select d, sum(rev) rev, sum(n) n, sum(v) v from (
          select (created_at at time zone 'Asia/Kolkata')::date d, revenue rev, 1 n, 0 v from sold where status = 'paid'
          union all
          select (created_at at time zone 'Asia/Kolkata')::date, 0, 0, 1 from (select distinct on (session) session, created_at from views order by session, created_at) f
        ) x group by d) y), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'viewers', n) order by n desc) from (
        select coalesce(source, 'direct') source, count(distinct session) n from views group by 1 order by 2 desc limit 6) z), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.product_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.product_stats(uuid, timestamptz, timestamptz) to authenticated;
