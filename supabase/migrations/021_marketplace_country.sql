-- 021: the marketplace is for sellers everywhere: each deal carries its seller's country, and can be
-- filtered by it. Signed-in users only, as in 020.
drop function if exists public.marketplace_deals(text, text, text, text, bigint, bigint, text, text, integer, integer);

create or replace function public.marketplace_deals(
  p_search text default null, p_fulfilment text default null, p_billing text default null, p_kind text default null,
  p_min_minor bigint default null, p_max_minor bigint default null, p_badge text default null,
  p_sort text default 'sold', p_limit integer default 48, p_offset integer default 0,
  p_country text default null
) returns table (
  deal_id uuid, title text, pitch text, billing text, billing_interval text, original_minor bigint, price_minor bigint,
  currency text, product_slug text, store_name text, store_slug text, fulfilment text, kind text,
  cover_url text, cover_bg text, verified boolean, trusted boolean, units bigint, revenue_minor bigint, revenue_30d_minor bigint,
  rating numeric, reviews bigint, ends_at timestamptz, created_at timestamptz, store_country text
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select d.*, p.slug as product_slug, p.currency as cur, p.fulfilment, p.product_type::text as kind, p.cover_bg,
      s.name as store_name, s.slug as store_slug, s.country as store_country,
      (select m.url from public.product_media m where m.product_id = p.id and m.kind = 'image' order by m.sort_order limit 1) as cover_url,
      coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.product_id = p.id and o.status = 'paid' and not oi.is_gift), 0)::bigint as units,
      coalesce((select sum(oi.line_total_minor) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.product_id = p.id and o.status = 'paid' and not oi.is_gift), 0)::bigint as revenue,
      coalesce((select sum(oi.line_total_minor) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.product_id = p.id and o.status = 'paid' and not oi.is_gift and o.paid_at > now() - interval '30 days'), 0)::bigint as revenue30,
      (select count(*) from public.orders o where o.store_id = d.store_id and o.status = 'paid') as paid_orders,
      (select count(*) from public.orders o where o.store_id = d.store_id and o.status = 'refunded') as refunded_orders,
      (select r.avg_rating from public.product_ratings r where r.product_id = p.id) as avg_rating,
      coalesce((select r.review_count from public.product_ratings r where r.product_id = p.id), 0) as review_count
    from public.marketplace_deals d
    join public.products p on p.id = d.product_id and p.status = 'live'
    join public.stores s on s.id = d.store_id and s.status = 'published'
    where d.status = 'live' and (d.ends_at is null or d.ends_at > now())
  ), shown as (
    select b.*,
      -- Trusted: at least 5 paid orders, refunds under 5% of paid + refunded, and no poor reviews
      (b.paid_orders >= 5 and b.refunded_orders::numeric <= 0.05 * (b.paid_orders + b.refunded_orders) and (b.review_count = 0 or coalesce(b.avg_rating, 0) >= 4)) as is_trusted
    from base b
  )
  select s.id, s.title, s.pitch, s.billing, s.billing_interval, s.original_price_minor, s.price_minor, s.cur,
    s.product_slug, s.store_name, s.store_slug, s.fulfilment, s.kind, s.cover_url, s.cover_bg,
    s.verified_at is not null, s.is_trusted, s.units,
    case when s.show_revenue then s.revenue end, case when s.show_revenue then s.revenue30 end,
    round(s.avg_rating, 1), s.review_count, s.ends_at, s.created_at, s.store_country
  from shown s
  where (p_search is null or s.title ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%' or s.store_name ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%')
    and (p_fulfilment is null or s.fulfilment = p_fulfilment)
    and (p_billing is null or s.billing = p_billing)
    and (p_kind is null or s.kind = p_kind)
    and (p_country is null or s.store_country = p_country)
    and (p_min_minor is null or s.price_minor >= p_min_minor)
    and (p_max_minor is null or s.price_minor <= p_max_minor)
    and (p_badge is null or (p_badge = 'verified' and s.verified_at is not null) or (p_badge = 'trusted' and s.is_trusted))
  order by
    case p_sort when 'revenue' then case when s.show_revenue then s.revenue else -1 end when 'discount' then round((1 - s.price_minor::numeric / s.original_price_minor) * 1000) when 'sold' then s.units else null end desc nulls last,
    case when p_sort = 'ending' then s.ends_at end asc nulls last,
    s.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;
revoke all on function public.marketplace_deals(text, text, text, text, bigint, bigint, text, text, integer, integer, text) from public;
grant execute on function public.marketplace_deals(text, text, text, text, bigint, bigint, text, text, integer, integer, text) to authenticated;
