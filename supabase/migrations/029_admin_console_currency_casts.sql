-- 029: the admin lists return currency codes as plain text (the stores and payouts columns use a currency type)

create or replace function public.admin_stores(p_q text default null, p_limit integer default 300)
returns table (id uuid, slug text, name text, status text, owner_id uuid, owner_email text, owner_name text, currency text, country text, created_at timestamptz, products bigint, orders bigint, gross bigint, domain text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select s.id, s.slug::text, s.name, s.status::text, s.owner_id, pr.email::text, pr.full_name, s.currency_base::text, s.country, s.created_at,
      (select count(*) from public.products p where p.store_id = s.id),
      (select count(*) from public.orders o where o.store_id = s.id and o.status = 'paid'),
      coalesce((select sum(o.total_minor) from public.orders o where o.store_id = s.id and o.status = 'paid' and o.currency::text = s.currency_base::text), 0)::bigint,
      (select d.hostname::text from public.domains d where d.store_id = s.id and d.status = 'active' limit 1)
    from public.stores s left join public.profiles pr on pr.id = s.owner_id
    where q is null or s.name ilike q or s.slug::text ilike q or pr.email::text ilike q
    order by s.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function public.admin_deals()
returns table (id uuid, created_at timestamptz, title text, store_id uuid, store_name text, billing text, price_minor bigint, original_price_minor bigint, currency text, status text, verified_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select d.id, d.created_at, d.title, d.store_id, s.name, d.billing, d.price_minor, d.original_price_minor, s.currency_base::text, d.status, d.verified_at, d.ends_at
    from public.marketplace_deals d join public.stores s on s.id = d.store_id
    order by (d.verified_at is null and d.status = 'live') desc, d.created_at desc limit 300;
end $$;

create or replace function public.admin_payouts(p_status text default null)
returns table (id uuid, store_id uuid, store_name text, owner_email text, holder_name text, method_kind text, method_label text, currency text, amount_minor bigint, fee_minor bigint, status text, failure_reason text, gateway_payout_id text, requested_at timestamptz, processed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select p.id, p.store_id, s.name, pr.email::text, m.holder_name, m.kind,
      case when m.account_last4 is not null then coalesce(m.bank_name, 'Bank') || ' ••' || m.account_last4
           when m.upi_masked is not null then m.upi_masked
           when m.wallet_address is not null then coalesce(m.asset, '') || ' ' || coalesce(m.network, '') || ' …' || right(m.wallet_address, 6)
           else m.kind end,
      p.currency::text, p.amount_minor, p.fee_minor, p.status::text, p.failure_reason, p.gateway_payout_id, p.requested_at, p.processed_at
    from public.payouts p
    join public.stores s on s.id = p.store_id
    left join public.profiles pr on pr.id = p.owner_id
    left join public.payout_methods m on m.id = p.method_id
    where p_status is null or p.status::text = p_status
    order by (p.status in ('requested', 'processing')) desc, p.requested_at desc limit 300;
end $$;

create or replace function public.admin_orders(p_q text default null, p_status text default null, p_limit integer default 300)
returns table (id uuid, ref text, store_id uuid, store_name text, status text, buyer_name text, buyer_email text, country text, currency text, total_minor bigint, paid_at timestamptz, created_at timestamptz, refunded boolean, disputed boolean)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select o.id, o.ref, o.store_id, s.name, o.status::text, o.buyer_name,
      left(o.buyer_email::text, 1) || '***@' || split_part(o.buyer_email::text, '@', 2), o.buyer_country, o.currency::text, o.total_minor, o.paid_at, o.created_at,
      o.status = 'refunded', exists (select 1 from public.disputes d where d.order_id = o.id and d.status in ('open', 'under_review'))
    from public.orders o join public.stores s on s.id = o.store_id
    where (p_status is null or o.status::text = p_status) and (q is null or o.ref ilike q or o.buyer_email::text ilike q or o.buyer_name ilike q or s.name ilike q)
    order by o.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function public.admin_refunds()
returns table (id uuid, created_at timestamptz, order_id uuid, order_ref text, store_name text, amount_minor bigint, currency text, reason text, status text, gateway_refund_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select r.id, r.created_at, r.order_id, o.ref, s.name, r.amount_minor, o.currency::text, r.reason, r.status, r.gateway_refund_id
    from public.refunds r join public.orders o on o.id = r.order_id join public.stores s on s.id = o.store_id
    order by r.created_at desc limit 300;
end $$;

create or replace function public.admin_disputes(p_status text default null)
returns table (id uuid, created_at timestamptz, order_id uuid, order_ref text, store_name text, amount_minor bigint, currency text, reason text, status text, respond_by timestamptz, gateway_dispute_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select d.id, d.created_at, d.order_id, o.ref, s.name, d.amount_minor, d.currency::text, d.reason, d.status, d.respond_by, d.gateway_dispute_id
    from public.disputes d join public.orders o on o.id = d.order_id join public.stores s on s.id = o.store_id
    where p_status is null or d.status = p_status
    order by (d.status in ('open', 'under_review')) desc, d.created_at desc limit 300;
end $$;
