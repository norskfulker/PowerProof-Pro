-- Payment activity and the unpaid-order timeout.
--  1. payment_events: every step of an order's payment (provider webhooks, the app's own signals,
--     and states we infer), deduplicated per provider event.
--  2. cancel_unpaid_order(): cancels an online order still unpaid an hour after it was created.
--     Called by the cron (app/api/cron/unpaid), which first asks Razorpay whether it was paid.
--  3. Live updates: payment, order and store events go out over Supabase Realtime (RLS applies).
--  4. store_events also counts "added to cart" (the storefront's Buy opens the cart).

/* 1. Orders: when and why one was cancelled ------------------------------------------------ */

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200);

-- Creators read orders through creator_orders (security_invoker): the new columns, appended
grant select (cancelled_at, cancel_reason) on public.orders to authenticated;
create or replace view public.creator_orders with (security_invoker = true) as
  select id, ref, store_id, buyer_name, buyer_email, buyer_country, buyer_state, currency, subtotal_minor, discount_minor, tax_minor,
         total_minor, deals_applied, status, paid_at, available_at, invoice_no, created_at, payment_method, shipping_minor, cod_fee_minor,
         ship_to, fulfilment_status, tracking, shipped_at, delivered_at, cancelled_at, cancel_reason
    from public.orders;

-- The cron's question: online orders still unpaid
create index if not exists orders_unpaid_created on public.orders (created_at) where status in ('pending', 'failed') and payment_method = 'online';

/* 2. Payment events -------------------------------------------------------------------------- */

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  kind text not null check (kind in ('initiated', 'pending', 'succeeded', 'failed', 'abandoned', 'cancelled', 'expired',
                                     'refund_requested', 'refund_processing', 'refunded', 'refund_failed', 'late_payment', 'disputed')),
  -- provider: the gateway said so (signed webhook or API read); app: our own server or checkout did it;
  -- inferred: worked out by us without the provider confirming
  source text not null check (source in ('provider', 'app', 'inferred')),
  payment_id text check (payment_id is null or char_length(payment_id) <= 120),
  refund_id text check (refund_id is null or char_length(refund_id) <= 120),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency text check (currency is null or char_length(currency) = 3),
  method text check (method is null or char_length(method) <= 40),
  -- The provider's own words; null means it gave none (shown as "Reason unavailable")
  reason text check (reason is null or char_length(reason) <= 300),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  provider_event_id text not null check (char_length(provider_event_id) <= 200),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- The same webhook delivered twice (or the same app signal sent twice) is stored once
  constraint payment_events_once unique (provider, provider_event_id)
);
create index if not exists payment_events_store_time on public.payment_events (store_id, occurred_at desc);
create index if not exists payment_events_order_time on public.payment_events (order_id, occurred_at);

alter table public.payment_events enable row level security;
drop policy if exists payment_events_read on public.payment_events;
create policy payment_events_read on public.payment_events for select to authenticated
  using (public.store_can(store_id, 'orders') or public.is_admin());
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;

/* Notifications: two new kinds ---------------------------------------------------------------- */

do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.notifications'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind = ANY%'
  loop execute format('alter table public.notifications drop constraint %I', c); end loop;
end $$;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'order', 'cod', 'refund', 'dispute', 'review', 'question', 'lead', 'payout_paid', 'payout_failed', 'low_stock', 'shipped', 'scheduled',
  'order_cancelled', 'payment_issue'));

/* 3. Cancel one unpaid order ------------------------------------------------------------------- */

/**
 * Cancels an online order that is still unpaid (pending or failed) and was created more than an
 * hour ago. Locks the row, so a payment being applied at the same moment wins or waits; a second
 * call changes nothing (returns false). Stock is only taken when an order is paid, so there is
 * nothing to put back. Writes the order's timeline, a payment event, the audit log and the store's
 * notification. The buyer's email is sent by the caller.
 */
create or replace function public.cancel_unpaid_order(p_order uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare o public.orders%rowtype; v_reason constant text := 'Payment not received within 1 hour';
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.status not in ('pending', 'failed') or o.payment_method <> 'online' or o.created_at > now() - interval '1 hour' then
    return false;
  end if;
  update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason where id = o.id;
  insert into public.order_events (order_id, store_id, kind, body) values (o.id, o.store_id, 'cancelled', v_reason);
  insert into public.payment_events (order_id, store_id, provider, kind, source, amount_minor, currency, reason, provider_event_id)
  values (o.id, o.store_id, coalesce(nullif(o.gateway, ''), 'razorpay'), 'expired', 'app', o.total_minor, o.currency, v_reason, 'expire:' || o.id)
  on conflict (provider, provider_event_id) do nothing;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (null, 'order_auto_cancelled', 'order', o.id::text, jsonb_build_object('ref', o.ref, 'was', o.status, 'reason', v_reason, 'created_at', o.created_at));
  perform public.notify(o.store_id, 'order_cancelled', 'Order ' || o.ref || ' cancelled', 'No payment arrived within an hour, so it was cancelled automatically.', '/sales/orders/' || o.id, 'orders', 'cancelled:' || o.id);
  return true;
end $function$;

revoke all on function public.cancel_unpaid_order(uuid) from public, anon, authenticated;

/* 4. Store events: "added to cart" ------------------------------------------------------------- */

do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.store_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind = ANY%'
  loop execute format('alter table public.store_events drop constraint %I', c); end loop;
end $$;
alter table public.store_events add constraint store_events_kind_check check (kind in ('view', 'product', 'cart'));

create or replace function public.track_event(p_store_slug text, p_kind text, p_path text, p_product uuid, p_source text, p_session text)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if p_kind not in ('view', 'product', 'cart') or char_length(coalesce(p_session, '')) < 8 then return; end if;
  select s.id into sid from public.stores s where s.slug = p_store_slug and s.status = 'published';
  if sid is null then return; end if;
  -- one browser can't flood a store's numbers
  if (select count(*) from public.store_events e where e.store_id = sid and e.session = p_session and e.created_at > now() - interval '1 day') >= 300 then return; end if;
  -- A cart line needs a product of this store
  if p_kind = 'cart' and not exists (select 1 from public.products p where p.id = p_product and p.store_id = sid) then return; end if;
  insert into public.store_events (store_id, kind, path, product_id, source, session)
  values (sid, p_kind, left(coalesce(p_path, '/'), 300),
    (select p.id from public.products p where p.id = p_product and p.store_id = sid),
    left(coalesce(nullif(trim(p_source), ''), 'direct'), 60), left(p_session, 40));
end $$;
revoke all on function public.track_event(text, text, text, uuid, text, text) from public;
grant execute on function public.track_event(text, text, text, uuid, text, text) to anon, authenticated;

/* 5. Realtime: the dashboards listen for these (each subscriber only gets rows its RLS allows) */

do $$
declare t text;
begin
  foreach t in array array['payment_events', 'order_events', 'store_events', 'orders'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
