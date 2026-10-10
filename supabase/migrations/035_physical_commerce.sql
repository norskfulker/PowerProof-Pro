-- 035: physical products. Variants (size, colour), stock, flat-rate shipping, cash on delivery,
-- the buyer's address, and shipping an order (tracking, delivered).
--   * products: options (the variant choices), stock tracking, weight
--   * product_variants: one row per combination, with its own price, SKU, stock and picture
--   * stores.shipping: zones with a flat rate (free over an amount), and cash on delivery
--   * orders: how it's paid (online or COD), shipping and COD charges, where it goes, and where it is
--   * order_items: the variant and how many
--   * create_order (new arguments), apply_payment and apply_refund take and give back stock
--   * set_order_fulfilment, settle_cod: the creator ships, delivers, collects cash or cancels

/* Products --------------------------------------------------------------------------------- */

alter table public.products
  add column options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 3),
  add column track_stock boolean not null default false,
  add column stock integer check (stock is null or stock >= 0),
  add column weight_grams integer check (weight_grams is null or weight_grams between 0 and 1000000);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  -- The chosen value for each of the product's options, in their order: ["M", "Blue"]
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  sku text check (sku is null or sku ~ '^[A-Za-z0-9_-]{1,32}$'),
  price_minor bigint not null check (price_minor >= 0),
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor > price_minor),
  -- Null when the product doesn't count stock
  stock integer check (stock is null or stock >= 0),
  image_url text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 2048)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);

alter table public.product_variants enable row level security;
create policy product_variants_owner on public.product_variants for all to authenticated
  using (public.is_product_owner(product_id)) with check (public.is_product_owner(product_id));
create policy product_variants_public on public.product_variants for select to anon, authenticated
  using (public.product_is_public(product_id));
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

/* Shipping settings ------------------------------------------------------------------------ */

-- { zones: [{ id, name, countries: ["IN"] or ["*"], rateMinor, freeOverMinor, days }],
--   cod: { enabled, feeMinor, maxOrderMinor } }. Checked by the server when an order is priced.
alter table public.stores add column shipping jsonb not null default '{}'::jsonb check (jsonb_typeof(shipping) = 'object');
grant select (shipping) on public.stores to anon;
grant select (shipping), insert (shipping), update (shipping) on public.stores to authenticated;

/* Orders ----------------------------------------------------------------------------------- */

alter table public.orders
  add column payment_method text not null default 'online' check (payment_method in ('online', 'cod')),
  add column shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  add column cod_fee_minor bigint not null default 0 check (cod_fee_minor >= 0),
  -- { name, phone, line1, line2, city, state, pincode, country }
  add column ship_to jsonb check (ship_to is null or jsonb_typeof(ship_to) = 'object'),
  -- Null for orders with nothing to ship
  add column fulfilment_status text check (fulfilment_status is null or fulfilment_status in ('unfulfilled', 'shipped', 'delivered', 'cancelled')),
  -- { carrier, number, url }
  add column tracking jsonb check (tracking is null or jsonb_typeof(tracking) = 'object'),
  add column shipped_at timestamptz,
  add column delivered_at timestamptz,
  -- Stock is taken once (when paid, or when a COD order is placed) and given back once
  add column stock_taken boolean not null default false;
create index orders_store_fulfilment_idx on public.orders (store_id, fulfilment_status) where fulfilment_status is not null;

-- Creators see where to send it (the buyer's phone inside the address is for the courier)
grant select (payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status, tracking, shipped_at, delivered_at) on public.orders to authenticated;

alter table public.order_items
  add column variant_id uuid references public.product_variants(id) on delete set null,
  add column variant_title text check (variant_title is null or char_length(variant_title) <= 120),
  add column fulfilment text not null default 'digital' check (fulfilment in ('digital', 'physical'));
grant select (variant_id, variant_title, fulfilment) on public.order_items to authenticated;

create or replace view public.creator_orders with (security_invoker = true) as
  select id, ref, store_id, buyer_name, buyer_email, buyer_country, currency, subtotal_minor, discount_minor, tax_minor, total_minor,
         deals_applied, status, paid_at, available_at, invoice_no, created_at,
         payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status, tracking, shipped_at, delivered_at
    from public.orders;

/* Stock ------------------------------------------------------------------------------------ */

-- Takes the order's physical items out of stock (once). Never below zero: an order that paid
-- for the last one twice still goes through, and the creator sees 0.
create or replace function public.take_stock(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare it record;
begin
  update public.orders set stock_taken = true where id = p_order and not stock_taken;
  if not found then return; end if;
  for it in select i.product_id, i.variant_id, i.quantity from public.order_items i where i.order_id = p_order and i.fulfilment = 'physical' and i.product_id is not null loop
    if it.variant_id is not null then
      update public.product_variants set stock = greatest(0, stock - it.quantity) where id = it.variant_id and stock is not null;
    else
      update public.products set stock = greatest(0, stock - it.quantity) where id = it.product_id and track_stock and stock is not null;
    end if;
  end loop;
end $$;

-- Puts it back (once): a cancelled COD order, or a refund for something that wasn't sent
create or replace function public.return_stock(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare it record;
begin
  update public.orders set stock_taken = false where id = p_order and stock_taken;
  if not found then return; end if;
  for it in select i.product_id, i.variant_id, i.quantity from public.order_items i where i.order_id = p_order and i.fulfilment = 'physical' and i.product_id is not null loop
    if it.variant_id is not null then
      update public.product_variants set stock = stock + it.quantity where id = it.variant_id and stock is not null;
    else
      update public.products set stock = stock + it.quantity where id = it.product_id and track_stock and stock is not null;
    end if;
  end loop;
end $$;

/* Creating an order ------------------------------------------------------------------------ */

drop function if exists public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb);

create or replace function public.create_order(
  p_ref text, p_store uuid, p_name text, p_email text, p_phone text, p_country text,
  p_currency text, p_subtotal bigint, p_discount bigint, p_tax bigint, p_total bigint,
  p_deals jsonb, p_coupon uuid, p_gateway_order_id text, p_items jsonb,
  p_payment_method text default 'online', p_shipping bigint default 0, p_cod_fee bigint default 0, p_ship_to jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare oid uuid; it jsonb; v_physical boolean;
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.status = 'published') then raise exception 'store_not_open'; end if;
  if p_payment_method not in ('online', 'cod') then raise exception 'bad_payment_method'; end if;
  select bool_or(coalesce(x->>'fulfilment', 'digital') = 'physical') into v_physical from jsonb_array_elements(p_items) x;
  if v_physical and p_ship_to is null then raise exception 'address_required'; end if;
  -- Cash on delivery is only for orders where everything is shipped (no downloads before paying)
  if p_payment_method = 'cod' and exists (select 1 from jsonb_array_elements(p_items) x where coalesce(x->>'fulfilment', 'digital') <> 'physical') then raise exception 'cod_physical_only'; end if;

  insert into public.orders (ref, store_id, buyer_name, buyer_email, buyer_phone, buyer_country, consent_at, currency,
    subtotal_minor, discount_minor, tax_minor, total_minor, deals_applied, gateway, gateway_order_id, coupon_id,
    status, payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status)
  values (p_ref, p_store, p_name, p_email, p_phone, p_country, now(), p_currency,
    p_subtotal, p_discount, p_tax, p_total, coalesce(p_deals, '[]'::jsonb), case when p_payment_method = 'cod' then 'cod' else 'razorpay' end, p_gateway_order_id, p_coupon,
    (case when p_payment_method = 'cod' then 'cod' else 'pending' end)::public.order_status, p_payment_method, coalesce(p_shipping, 0), coalesce(p_cod_fee, 0),
    case when v_physical then p_ship_to end, case when v_physical then 'unfulfilled' end)
  returning id into oid;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, product_id, title, unit_price_minor, quantity, discount_minor, line_total_minor, tax_rate_bps, hsn_sac, is_gift, variant_id, variant_title, fulfilment)
    values (oid, (it->>'product_id')::uuid, it->>'title', (it->>'unit_price_minor')::bigint, greatest(1, coalesce((it->>'quantity')::int, 1)), coalesce((it->>'discount_minor')::bigint, 0),
      (it->>'line_total_minor')::bigint, coalesce(nullif(it->>'tax_rate_bps', '')::int, 0), nullif(it->>'hsn_sac', ''), coalesce((it->>'is_gift')::boolean, false),
      nullif(it->>'variant_id', '')::uuid, nullif(it->>'variant_title', ''), coalesce(it->>'fulfilment', 'digital'));
  end loop;

  -- A COD order is placed now: it holds its stock until it's delivered or cancelled
  if p_payment_method = 'cod' then perform public.take_stock(oid); end if;
  return oid;
end $$;

/* Paying, refunding ------------------------------------------------------------------------ */

create or replace function public.apply_payment(p_gateway_order_id text, p_gateway_payment_id text, p_gateway_fee_minor bigint default null)
returns table (out_order_id uuid, out_ref text, out_token text, out_already_paid boolean)
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_bps int; v_platform bigint; v_gw bigint; v_net bigint;
        v_token text; v_hold interval := interval '3 hours';
begin
  select * into o from public.orders where gateway_order_id = p_gateway_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if o.status = 'paid' then
    return query select o.id, o.ref, null::text, true; return;      -- webhook retry: do nothing, safely
  end if;
  if o.status not in ('pending','failed') then raise exception 'order_not_payable' using errcode = 'P0001'; end if;

  select l.platform_fee_bps into v_bps
  from public.stores s join public.profiles p on p.id = s.owner_id join public.plan_limits l on l.plan = p.plan
  where s.id = o.store_id;

  v_platform := round(o.total_minor * v_bps / 10000.0);
  v_gw := coalesce(p_gateway_fee_minor, round(o.total_minor * 200 / 10000.0));   -- estimate until the real fee arrives
  v_net := o.total_minor - v_platform - v_gw;

  update public.orders
     set status = 'paid', gateway_payment_id = p_gateway_payment_id, paid_at = now(),
         available_at = now() + v_hold, invoice_no = public.next_invoice_no()
   where id = o.id;

  insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, available_at, ref) values
    (o.id, o.store_id, 'buyer',    'payment',      -o.total_minor, o.currency, null,             p_gateway_payment_id),
    (o.id, o.store_id, 'creator',  'sale',          v_net,         o.currency, now() + v_hold,   o.ref),
    (o.id, o.store_id, 'platform', 'platform_fee',  v_platform,    o.currency, null,             o.ref),
    (o.id, o.store_id, 'gateway',  'gateway_fee',   v_gw,          o.currency, null,             o.ref);

  perform public.take_stock(o.id);

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.download_tokens (order_id, token_hash, expires_at)
  values (o.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');

  return query select o.id, o.ref, v_token, false;
end $$;

-- Online: the buyer gets the total back, the platform returns its fee, the creator the rest.
-- Cash on delivery: the creator hands the cash back themselves; the platform returns its fee.
-- Anything not sent yet goes back into stock.
create or replace function public.apply_refund(p_order uuid, p_gateway_refund_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_platform bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'refunded' then return; end if;
  if o.status <> 'paid' then raise exception 'order_not_refundable'; end if;
  select coalesce(sum(amount_minor), 0) into v_platform from public.ledger_entries where order_id = o.id and kind = 'platform_fee' and account = 'platform';
  insert into public.refunds (order_id, amount_minor, reason, status, gateway_refund_id) values (o.id, o.total_minor, p_reason, 'processed', p_gateway_refund_id);
  if o.payment_method = 'cod' then
    if v_platform <> 0 then
      insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, ref) values
        (o.id, o.store_id, 'creator', 'refund', v_platform, o.currency, o.ref),
        (o.id, o.store_id, 'platform', 'refund', -v_platform, o.currency, o.ref);
    end if;
  else
    insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, ref) values
      (o.id, o.store_id, 'buyer', 'refund', o.total_minor, o.currency, p_gateway_refund_id),
      (o.id, o.store_id, 'creator', 'refund', -(o.total_minor - v_platform), o.currency, o.ref),
      (o.id, o.store_id, 'platform', 'refund', -v_platform, o.currency, o.ref);
  end if;
  update public.orders set status = 'refunded', fulfilment_status = case when fulfilment_status = 'unfulfilled' then 'cancelled' else fulfilment_status end where id = o.id;
  if coalesce(o.fulfilment_status, 'unfulfilled') in ('unfulfilled', 'cancelled') then perform public.return_stock(o.id); end if;
  update public.download_tokens set revoked_at = now() where order_id = o.id and revoked_at is null;
end $$;

/* Shipping an order (the creator) ---------------------------------------------------------- */

-- Shipped (with tracking), delivered, or cancelled. Only the store's owner. A cancel is for an
-- order that hasn't been paid (cash on delivery); a paid one is refunded instead.
create or replace function public.set_order_fulfilment(p_order uuid, p_status text, p_carrier text default null, p_number text default null, p_url text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.is_store_owner(o.store_id) then raise exception 'order_not_found'; end if;
  if o.fulfilment_status is null then raise exception 'nothing_to_ship'; end if;
  if o.status not in ('paid', 'cod') then raise exception 'order_not_shippable'; end if;
  if p_url is not null and p_url <> '' and p_url !~ '^https://' then raise exception 'bad_tracking_url'; end if;
  if p_status = 'shipped' then
    if o.fulfilment_status not in ('unfulfilled', 'shipped') then raise exception 'bad_fulfilment_step'; end if;
    update public.orders set fulfilment_status = 'shipped', shipped_at = coalesce(shipped_at, now()),
      tracking = jsonb_strip_nulls(jsonb_build_object('carrier', nullif(left(trim(coalesce(p_carrier, '')), 60), ''), 'number', nullif(left(trim(coalesce(p_number, '')), 80), ''), 'url', nullif(left(trim(coalesce(p_url, '')), 500), '')))
     where id = o.id;
  elsif p_status = 'delivered' then
    if o.fulfilment_status not in ('unfulfilled', 'shipped') then raise exception 'bad_fulfilment_step'; end if;
    update public.orders set fulfilment_status = 'delivered', shipped_at = coalesce(shipped_at, now()), delivered_at = now() where id = o.id;
  elsif p_status = 'cancelled' then
    if o.status <> 'cod' or o.fulfilment_status = 'delivered' then raise exception 'refund_instead'; end if;
    update public.orders set fulfilment_status = 'cancelled', status = 'failed' where id = o.id;
    perform public.return_stock(o.id);
  else
    raise exception 'bad_fulfilment_step';
  end if;
end $$;

-- The creator collected the cash: the order is paid, gets its invoice, and the platform's fee is
-- taken from the creator's balance (the money never passed through the gateway).
create or replace function public.settle_cod(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_bps int; v_platform bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.is_store_owner(o.store_id) then raise exception 'order_not_found'; end if;
  if o.status = 'paid' then return; end if;
  if o.status <> 'cod' then raise exception 'not_cod'; end if;
  select l.platform_fee_bps into v_bps
    from public.stores s join public.profiles p on p.id = s.owner_id join public.plan_limits l on l.plan = p.plan where s.id = o.store_id;
  v_platform := round(o.total_minor * coalesce(v_bps, 0) / 10000.0);
  update public.orders set status = 'paid', paid_at = now(), available_at = now(), invoice_no = public.next_invoice_no(),
    gateway_payment_id = coalesce(gateway_payment_id, 'cod_' || o.id::text),
    fulfilment_status = 'delivered', shipped_at = coalesce(shipped_at, now()), delivered_at = coalesce(delivered_at, now())
   where id = o.id;
  if v_platform > 0 then
    insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, available_at, ref) values
      (o.id, o.store_id, 'platform', 'platform_fee', v_platform, o.currency, null, o.ref),
      (o.id, o.store_id, 'creator', 'adjustment', -v_platform, o.currency, now(), 'Cash on delivery: platform fee');
  end if;
end $$;

/* The buyer's order page ------------------------------------------------------------------- */

-- A placed COD order has a page too (it has nothing to download)
create or replace function public.order_for_token(p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  return (select d.order_id from public.download_tokens d join public.orders o on o.id = d.order_id
   where d.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and d.revoked_at is null and d.expires_at > now() and o.status in ('paid', 'cod')
   limit 1);
end $$;

create or replace function public.issue_download_token(p_order uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not exists (select 1 from public.orders o where o.id = p_order and o.status in ('paid', 'cod')) then raise exception 'order_not_paid'; end if;
  insert into public.download_tokens (order_id, token_hash, expires_at, max_downloads)
  values (p_order, encode(extensions.digest(t, 'sha256'), 'hex'), now() + interval '30 days', 25);
  return t;
end $$;

create or replace function public.lookup_order(p_email text, p_ref text) returns text
language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin
  select o.id into oid from public.orders o where o.ref = upper(trim(p_ref)) and lower(o.buyer_email::text) = lower(trim(p_email)) and o.status in ('paid', 'cod');
  if oid is null then return null; end if;
  if (select count(*) from public.download_tokens d where d.order_id = oid and d.created_at > now() - interval '1 hour') >= 5 then raise exception 'lookup_rate_limited'; end if;
  return public.issue_download_token(oid);
end $$;

create or replace function public.get_order(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare oid uuid; o public.orders%rowtype; s public.stores%rowtype;
begin
  oid := public.order_for_token(p_token);
  if oid is null then return null; end if;
  select * into o from public.orders where id = oid;
  select * into s from public.stores where id = o.store_id;
  return jsonb_build_object(
    'id', o.id, 'storeId', o.store_id, 'analytics', coalesce(s.theme->'analytics', '{}'::jsonb), 'ref', o.ref, 'status', o.status,
    'storeName', s.name, 'storeSlug', s.slug, 'supportEmail', s.support_email,
    'buyerName', o.buyer_name, 'buyerEmail', o.buyer_email::text, 'buyerCountry', coalesce(o.buyer_country, 'IN'), 'currency', o.currency,
    'subtotal', o.subtotal_minor, 'discount', o.discount_minor, 'tax', o.tax_minor, 'total', o.total_minor,
    'shipping', o.shipping_minor, 'codFee', o.cod_fee_minor, 'paymentMethod', o.payment_method, 'shipTo', o.ship_to,
    'fulfilment', o.fulfilment_status, 'tracking', o.tracking, 'shippedAt', o.shipped_at, 'deliveredAt', o.delivered_at,
    'invoiceNo', o.invoice_no, 'paidAt', o.paid_at,
    'reviewed', coalesce((select jsonb_agg(r.product_id) from public.reviews r where r.order_id = o.id), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('productId', i.product_id, 'title', i.title, 'unit', i.unit_price_minor, 'discount', coalesce(i.discount_minor, 0),
        'total', i.line_total_minor, 'gift', coalesce(i.is_gift, false), 'hsn', i.hsn_sac, 'rateBps', i.tax_rate_bps,
        'quantity', i.quantity, 'variant', i.variant_title, 'physical', i.fulfilment = 'physical')) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'files', case when o.status = 'paid' then coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.file_name, 'size', f.size_bytes, 'product', (select i.title from public.order_items i where i.order_id = o.id and i.product_id = f.product_id limit 1)))
        from public.product_files f where f.product_id in (select i.product_id from public.order_items i where i.order_id = o.id)), '[]'::jsonb) else '[]'::jsonb end,
    'store', jsonb_build_object('legalName', s.legal_name, 'gstin', s.gstin, 'pan', s.pan, 'address', s.company_address, 'invoicePrefix', s.invoice_prefix, 'invoiceFooter', s.invoice_footer)
  );
end $$;

/* Who may call what ------------------------------------------------------------------------ */

revoke all on function public.take_stock(uuid) from public, anon, authenticated;
revoke all on function public.return_stock(uuid) from public, anon, authenticated;
revoke all on function public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb, text, bigint, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb, text, bigint, bigint, jsonb) to service_role;
revoke all on function public.set_order_fulfilment(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_order_fulfilment(uuid, text, text, text, text) to authenticated;
revoke all on function public.settle_cod(uuid) from public, anon;
grant execute on function public.settle_cod(uuid) to authenticated;
revoke all on function public.order_for_token(text) from public, anon, authenticated;
revoke all on function public.issue_download_token(uuid) from public, anon, authenticated;
grant execute on function public.order_for_token(text) to service_role;
grant execute on function public.issue_download_token(uuid) to service_role;
