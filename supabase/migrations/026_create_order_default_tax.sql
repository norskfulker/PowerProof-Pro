-- 026: a product with no tax rate (a null in the order lines) must not make the order fail:
-- order_items.tax_rate_bps is NOT NULL, so a missing rate is saved as 0. Found by testing.
create or replace function public.create_order(
  p_ref text, p_store uuid, p_name text, p_email text, p_phone text, p_country text,
  p_currency text, p_subtotal bigint, p_discount bigint, p_tax bigint, p_total bigint,
  p_deals jsonb, p_coupon uuid, p_gateway_order_id text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare oid uuid; it jsonb;
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.status = 'published') then raise exception 'store_not_open'; end if;
  insert into public.orders (ref, store_id, buyer_name, buyer_email, buyer_phone, buyer_country, consent_at, currency,
    subtotal_minor, discount_minor, tax_minor, total_minor, deals_applied, gateway, gateway_order_id, coupon_id)
  values (p_ref, p_store, p_name, p_email, p_phone, p_country, now(), p_currency,
    p_subtotal, p_discount, p_tax, p_total, coalesce(p_deals, '[]'::jsonb), 'razorpay', p_gateway_order_id, p_coupon)
  returning id into oid;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, product_id, title, unit_price_minor, quantity, discount_minor, line_total_minor, tax_rate_bps, hsn_sac, is_gift)
    values (oid, (it->>'product_id')::uuid, it->>'title', (it->>'unit_price_minor')::bigint, 1, coalesce((it->>'discount_minor')::bigint, 0),
      (it->>'line_total_minor')::bigint, coalesce(nullif(it->>'tax_rate_bps', '')::int, 0), nullif(it->>'hsn_sac', ''), coalesce((it->>'is_gift')::boolean, false));
  end loop;
  return oid;
end $$;
