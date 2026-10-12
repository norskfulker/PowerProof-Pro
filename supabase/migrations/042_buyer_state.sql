-- 042: buyer state for GST place-of-supply. Buyers in India give their state at checkout
-- (digital orders: a new field; physical orders: the delivery address). Invoices use it for
-- CGST+SGST vs IGST; older orders keep null and read as before (IGST default). The state is
-- validated against the known list by the server, not the database.

alter table public.orders
  add column buyer_state text check (buyer_state is null or (char_length(buyer_state) between 2 and 60));

drop function if exists public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb, text, bigint, bigint, jsonb);

create or replace function public.create_order(
  p_ref text, p_store uuid, p_name text, p_email text, p_phone text, p_country text,
  p_currency text, p_subtotal bigint, p_discount bigint, p_tax bigint, p_total bigint,
  p_deals jsonb, p_coupon uuid, p_gateway_order_id text, p_items jsonb,
  p_payment_method text default 'online', p_shipping bigint default 0, p_cod_fee bigint default 0, p_ship_to jsonb default null,
  p_buyer_state text default null
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

  insert into public.orders (ref, store_id, buyer_name, buyer_email, buyer_phone, buyer_country, buyer_state, consent_at, currency,
    subtotal_minor, discount_minor, tax_minor, total_minor, deals_applied, gateway, gateway_order_id, coupon_id,
    status, payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status)
  values (p_ref, p_store, p_name, p_email, p_phone, p_country, nullif(trim(coalesce(p_buyer_state, '')), ''), now(), p_currency,
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

revoke all on function public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb, text, bigint, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb, text, bigint, bigint, jsonb, text) to service_role;

-- The order page's data: now carries the buyer's state and the delivery address
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
    'buyerName', o.buyer_name, 'buyerEmail', o.buyer_email::text, 'buyerCountry', coalesce(o.buyer_country, 'IN'), 'buyerState', o.buyer_state, 'currency', o.currency,
    'subtotal', o.subtotal_minor, 'discount', o.discount_minor, 'tax', o.tax_minor, 'total', o.total_minor,
    'invoiceNo', o.invoice_no, 'paidAt', o.paid_at, 'shipTo', o.ship_to,
    'reviewed', coalesce((select jsonb_agg(r.product_id) from public.reviews r where r.order_id = o.id), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('productId', i.product_id, 'title', i.title, 'unit', i.unit_price_minor, 'discount', coalesce(i.discount_minor, 0),
        'total', i.line_total_minor, 'gift', coalesce(i.is_gift, false), 'hsn', i.hsn_sac, 'rateBps', i.tax_rate_bps)) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.file_name, 'size', f.size_bytes, 'product', (select i.title from public.order_items i where i.order_id = o.id and i.product_id = f.product_id limit 1)))
        from public.product_files f where f.product_id in (select i.product_id from public.order_items i where i.order_id = o.id)), '[]'::jsonb),
    'store', jsonb_build_object('legalName', s.legal_name, 'gstin', s.gstin, 'pan', s.pan, 'address', s.company_address, 'invoicePrefix', s.invoice_prefix, 'invoiceFooter', s.invoice_footer)
  );
end $$;

-- The creator orders view, with the buyer's state (a view can't gain a column in place)
drop view public.creator_orders;
create view public.creator_orders with (security_invoker = true) as
  select id, ref, store_id, buyer_name, buyer_email, buyer_country, buyer_state, currency,
         subtotal_minor, discount_minor, tax_minor, total_minor,
         deals_applied, status, paid_at, available_at, invoice_no, created_at,
         payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status, tracking, shipped_at, delivered_at
  from public.orders;
grant select on public.creator_orders to authenticated;
