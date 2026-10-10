-- 022: the buyer side of selling. Orders are only ever created, paid, downloaded from and refunded
-- by server code holding the service-role key; none of these functions can be called by a browser.

-- Creates an order and its lines in one go. Prices are worked out by the server, never the buyer.
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
    values (oid, (it->>'product_id')::uuid, it->>'title', (it->>'unit_price_minor')::bigint, 1, (it->>'discount_minor')::bigint,
      (it->>'line_total_minor')::bigint, nullif(it->>'tax_rate_bps', '')::int, nullif(it->>'hsn_sac', ''), coalesce((it->>'is_gift')::boolean, false));
  end loop;
  return oid;
end $$;

-- A fresh download link for a paid order (used when a buyer looks their order up again)
create or replace function public.issue_download_token(p_order uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not exists (select 1 from public.orders o where o.id = p_order and o.status = 'paid') then raise exception 'order_not_paid'; end if;
  insert into public.download_tokens (order_id, token_hash, expires_at, max_downloads)
  values (p_order, encode(extensions.digest(t, 'sha256'), 'hex'), now() + interval '30 days', 25);
  return t;
end $$;

-- Which paid order a download token belongs to (nothing if it's wrong, expired or revoked)
create or replace function public.order_for_token(p_token text) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.order_id from public.download_tokens d join public.orders o on o.id = d.order_id
  where d.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and d.revoked_at is null and d.expires_at > now() and o.status = 'paid'
  limit 1
$$;

-- Checks a download and counts it. Returns the file's place in private storage, or raises.
create or replace function public.claim_download(p_token text, p_file uuid) returns table (storage_path text, file_name text, mime_type text)
language plpgsql security definer set search_path = '' as $$
declare d public.download_tokens%rowtype;
begin
  select * into d from public.download_tokens t where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or d.revoked_at is not null or d.expires_at <= now() then raise exception 'download_invalid'; end if;
  if d.download_count >= d.max_downloads then raise exception 'download_limit'; end if;
  if not exists (select 1 from public.orders o where o.id = d.order_id and o.status = 'paid') then raise exception 'download_invalid'; end if;
  update public.download_tokens set download_count = download_count + 1 where id = d.id;
  return query
    select f.storage_path, f.file_name, f.mime_type from public.product_files f
    where f.id = p_file and exists (select 1 from public.order_items i where i.order_id = d.order_id and i.product_id = f.product_id);
  if not found then raise exception 'download_invalid'; end if;
end $$;

-- Refunds the whole order: buyer gets the total back, the platform returns its fee, and the creator
-- gives back the rest (the card fee isn't refunded by the gateway). Downloads stop.
create or replace function public.apply_refund(p_order uuid, p_gateway_refund_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_platform bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'refunded' then return; end if;
  if o.status <> 'paid' then raise exception 'order_not_refundable'; end if;
  select coalesce(sum(amount_minor), 0) into v_platform from public.ledger_entries where order_id = o.id and kind = 'platform_fee';
  insert into public.refunds (order_id, amount_minor, reason, status, gateway_refund_id) values (o.id, o.total_minor, p_reason, 'processed', p_gateway_refund_id);
  insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, ref) values
    (o.id, o.store_id, 'buyer', 'refund', o.total_minor, o.currency, p_gateway_refund_id),
    (o.id, o.store_id, 'creator', 'refund', -(o.total_minor - v_platform), o.currency, o.ref),
    (o.id, o.store_id, 'platform', 'refund', -v_platform, o.currency, o.ref);
  update public.orders set status = 'refunded' where id = o.id;
  update public.download_tokens set revoked_at = now() where order_id = o.id and revoked_at is null;
end $$;

revoke all on function public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.issue_download_token(uuid) from public, anon, authenticated;
revoke all on function public.order_for_token(text) from public, anon, authenticated;
revoke all on function public.claim_download(text, uuid) from public, anon, authenticated;
revoke all on function public.apply_refund(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_order(text, uuid, text, text, text, text, text, bigint, bigint, bigint, bigint, jsonb, uuid, text, jsonb) to service_role;
grant execute on function public.issue_download_token(uuid) to service_role;
grant execute on function public.order_for_token(text) to service_role;
grant execute on function public.claim_download(text, uuid) to service_role;
grant execute on function public.apply_refund(uuid, text, text) to service_role;
