-- 051: order tools
--
-- 1. One order view (order_view) for the buyer's link (get_order) and the creator's print page
--    (creator_order_views). It restores what 042 dropped by mistake: shipping, COD fee, payment
--    method, fulfilment and tracking, line quantity/variant/physical, the invoice name, and files
--    only once paid.
-- 2. order_events: what happened to an order (paid, shipped, delivered, refunds, cancelled,
--    receipt resent) plus private notes. Status changes are logged by triggers; notes come from
--    add_order_note; the server logs "receipt resent". Readable by the store's orders area.
-- 3. Partial refunds: apply_partial_refund returns part of an order and gives back the matching
--    share of PowerProof's fee. The order stays paid (downloads keep working) until the whole
--    amount is refunded. apply_refund now refunds only what's left.

/* 1. The order view ------------------------------------------------------------------- */

create or replace function public.order_view(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o public.orders%rowtype; s public.stores%rowtype;
begin
  select * into o from public.orders where id = p_order;
  if not found then return null; end if;
  select * into s from public.stores where id = o.store_id;
  return jsonb_build_object(
    'id', o.id, 'storeId', o.store_id, 'analytics', coalesce(s.theme->'analytics', '{}'::jsonb), 'ref', o.ref, 'status', o.status,
    'storeName', s.name, 'storeSlug', s.slug, 'supportEmail', s.support_email,
    'buyerName', o.buyer_name, 'buyerEmail', o.buyer_email::text, 'buyerCountry', coalesce(o.buyer_country, 'IN'), 'buyerState', o.buyer_state, 'currency', o.currency,
    'subtotal', o.subtotal_minor, 'discount', o.discount_minor, 'tax', o.tax_minor, 'total', o.total_minor,
    'shipping', o.shipping_minor, 'codFee', o.cod_fee_minor, 'paymentMethod', o.payment_method, 'shipTo', o.ship_to,
    'fulfilment', o.fulfilment_status, 'tracking', o.tracking, 'shippedAt', o.shipped_at, 'deliveredAt', o.delivered_at,
    'invoiceNo', o.invoice_no, 'paidAt', o.paid_at,
    'refunded', coalesce((select sum(f.amount_minor) from public.refunds f where f.order_id = o.id and f.status = 'processed'), 0),
    'reviewed', coalesce((select jsonb_agg(r.product_id) from public.reviews r where r.order_id = o.id), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('productId', i.product_id, 'title', i.title, 'unit', i.unit_price_minor, 'discount', coalesce(i.discount_minor, 0),
        'total', i.line_total_minor, 'gift', coalesce(i.is_gift, false), 'hsn', i.hsn_sac, 'rateBps', i.tax_rate_bps,
        'quantity', i.quantity, 'variant', i.variant_title, 'physical', i.fulfilment = 'physical')) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'files', case when o.status = 'paid' then coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.file_name, 'size', f.size_bytes, 'product', (select i.title from public.order_items i where i.order_id = o.id and i.product_id = f.product_id limit 1)))
        from public.product_files f where f.product_id in (select i.product_id from public.order_items i where i.order_id = o.id)), '[]'::jsonb) else '[]'::jsonb end,
    'store', jsonb_build_object('invoiceName', s.invoice_name, 'legalName', s.legal_name, 'gstin', s.gstin, 'pan', s.pan, 'address', s.company_address, 'invoicePrefix', s.invoice_prefix, 'invoiceFooter', s.invoice_footer)
  );
end $$;
revoke all on function public.order_view(uuid) from public, anon, authenticated;

create or replace function public.get_order(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare oid uuid;
begin
  oid := public.order_for_token(p_token);
  if oid is null then return null; end if;
  return public.order_view(oid);
end $$;

-- Several orders at once for the creator (packing slips, invoices): only orders they can see
create or replace function public.creator_order_views(p_orders uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(array_length(p_orders, 1), 0) > 200 then raise exception 'too_many_orders'; end if;
  return coalesce((
    select jsonb_agg(public.order_view(o.id) order by o.created_at desc)
    from public.orders o
    where o.id = any(p_orders) and (public.store_can(o.store_id, 'orders') or public.is_admin())
  ), '[]'::jsonb);
end $$;
revoke all on function public.creator_order_views(uuid[]) from public, anon;
grant execute on function public.creator_order_views(uuid[]) to authenticated;

/* 2. What happened to an order ------------------------------------------------------- */

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('paid', 'shipped', 'tracking', 'delivered', 'cancelled', 'cod_paid', 'refund', 'receipt_resent', 'note')),
  body text check (body is null or char_length(body) <= 2000),
  amount_minor bigint,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);
create index if not exists order_events_store_idx on public.order_events (store_id);
alter table public.order_events enable row level security;
drop policy if exists order_events_read on public.order_events;
create policy order_events_read on public.order_events for select using (public.store_can(store_id, 'orders') or public.is_admin());
-- Writes go through add_order_note and the triggers below only
revoke insert, update, delete on public.order_events from anon, authenticated;

-- Who is acting, for the log (null for the system and webhooks)
create or replace function public.actor_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(p.full_name), ''), p.email::text) from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public.actor_name() from public, anon, authenticated;

create or replace function public.add_order_note(p_order uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sid uuid; e public.order_events%rowtype;
begin
  select o.store_id into sid from public.orders o where o.id = p_order;
  if sid is null or not public.store_can(sid, 'orders') then raise exception 'order_not_found'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'note_invalid'; end if;
  insert into public.order_events (order_id, store_id, kind, body, actor_id, actor_name)
  values (p_order, sid, 'note', trim(p_body), auth.uid(), public.actor_name()) returning * into e;
  return to_jsonb(e);
end $$;
revoke all on function public.add_order_note(uuid, text) from public, anon;
grant execute on function public.add_order_note(uuid, text) to authenticated;

-- Status, fulfilment and tracking changes write themselves into the log
create or replace function public.log_order_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who uuid := auth.uid(); nm text := public.actor_name();
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'paid' and old.status = 'cod' then
      insert into public.order_events (order_id, store_id, kind, actor_id, actor_name) values (new.id, new.store_id, 'cod_paid', who, nm);
    elsif new.status = 'paid' then
      insert into public.order_events (order_id, store_id, kind, amount_minor) values (new.id, new.store_id, 'paid', new.total_minor);
    end if;
  end if;
  if tg_op = 'UPDATE' and new.fulfilment_status is distinct from old.fulfilment_status and new.fulfilment_status in ('shipped', 'delivered', 'cancelled') then
    insert into public.order_events (order_id, store_id, kind, body, actor_id, actor_name)
    values (new.id, new.store_id, new.fulfilment_status,
      case when new.fulfilment_status = 'shipped' then nullif(concat_ws(' ', new.tracking->>'carrier', new.tracking->>'number'), '') end, who, nm);
  elsif tg_op = 'UPDATE' and new.tracking is distinct from old.tracking and new.fulfilment_status = old.fulfilment_status and new.tracking is not null then
    insert into public.order_events (order_id, store_id, kind, body, actor_id, actor_name)
    values (new.id, new.store_id, 'tracking', nullif(concat_ws(' ', new.tracking->>'carrier', new.tracking->>'number'), ''), who, nm);
  end if;
  return new;
end $$;
revoke all on function public.log_order_change() from public, anon, authenticated;
drop trigger if exists orders_log_change on public.orders;
create trigger orders_log_change after update of status, fulfilment_status, tracking on public.orders
  for each row execute function public.log_order_change();

create or replace function public.log_refund() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'processed' then
    insert into public.order_events (order_id, store_id, kind, body, amount_minor, actor_id, actor_name)
    select new.order_id, o.store_id, 'refund', new.reason, new.amount_minor, auth.uid(), public.actor_name() from public.orders o where o.id = new.order_id;
  end if;
  return new;
end $$;
revoke all on function public.log_refund() from public, anon, authenticated;
drop trigger if exists refunds_log on public.refunds;
create trigger refunds_log after insert on public.refunds for each row execute function public.log_refund();

/* 3. Partial refunds ----------------------------------------------------------------- */

-- How much of an order has been given back so far
create or replace function public.order_refunded(p_order uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_minor), 0)::bigint from public.refunds where order_id = p_order and status = 'processed'
$$;
revoke all on function public.order_refunded(uuid) from public, anon, authenticated;

create or replace function public.apply_partial_refund(p_order uuid, p_amount bigint, p_gateway_refund_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_platform bigint; v_platform_back bigint; v_left bigint; v_fee bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'refunded' then return; end if;
  if o.status <> 'paid' then raise exception 'order_not_refundable'; end if;
  if exists (select 1 from public.refunds where gateway_refund_id = p_gateway_refund_id) then return; end if;
  v_left := o.total_minor - public.order_refunded(o.id);
  if p_amount is null or p_amount <= 0 or p_amount > v_left then raise exception 'refund_amount_invalid'; end if;
  select coalesce(sum(amount_minor), 0) into v_platform from public.ledger_entries where order_id = o.id and kind = 'platform_fee' and account = 'platform';
  select coalesce(-sum(amount_minor), 0) into v_platform_back from public.ledger_entries where order_id = o.id and kind = 'refund' and account = 'platform';
  -- PowerProof's fee comes back in proportion; the last refund settles whatever rounding left over
  v_fee := case when p_amount = v_left then v_platform - v_platform_back else round(v_platform::numeric * p_amount / nullif(o.total_minor, 0))::bigint end;
  insert into public.refunds (order_id, amount_minor, reason, status, gateway_refund_id) values (o.id, p_amount, p_reason, 'processed', p_gateway_refund_id);
  if o.payment_method = 'cod' then
    if v_fee <> 0 then
      insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, ref) values
        (o.id, o.store_id, 'creator', 'refund', v_fee, o.currency, o.ref),
        (o.id, o.store_id, 'platform', 'refund', -v_fee, o.currency, o.ref);
    end if;
  else
    insert into public.ledger_entries (order_id, store_id, account, kind, amount_minor, currency, ref) values
      (o.id, o.store_id, 'buyer', 'refund', p_amount, o.currency, p_gateway_refund_id),
      (o.id, o.store_id, 'creator', 'refund', -(p_amount - v_fee), o.currency, o.ref),
      (o.id, o.store_id, 'platform', 'refund', -v_fee, o.currency, o.ref);
  end if;
  -- All of it given back: the order is refunded, like a full refund
  if p_amount = v_left then
    update public.orders set status = 'refunded', fulfilment_status = case when fulfilment_status = 'unfulfilled' then 'cancelled' else fulfilment_status end where id = o.id;
    if coalesce(o.fulfilment_status, 'unfulfilled') in ('unfulfilled', 'cancelled') then perform public.return_stock(o.id); end if;
    update public.download_tokens set revoked_at = now() where order_id = o.id and revoked_at is null;
  end if;
end $$;
revoke all on function public.apply_partial_refund(uuid, bigint, text, text) from public, anon, authenticated;

-- A full refund gives back whatever is left (all of it when nothing was refunded before)
create or replace function public.apply_refund(p_order uuid, p_gateway_refund_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'refunded' then return; end if;
  if o.status <> 'paid' then raise exception 'order_not_refundable'; end if;
  perform public.apply_partial_refund(p_order, o.total_minor - public.order_refunded(p_order), p_gateway_refund_id, p_reason);
end $$;
revoke all on function public.apply_refund(uuid, text, text) from public, anon, authenticated;
