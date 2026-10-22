-- 043: what a store sells, notifications, and abandoned checkouts.
--   * stores.sells: 'digital' or 'physical', never both. Physical is "physical shipping turned on":
--     only then do HSN/SAC codes, SKUs, shipping rates and cash on delivery apply. Every product
--     saved must match it, and a store can't switch while it has active products of the other kind.
--   * stores.cart_reminders: email buyers who started checkout and didn't pay (once)
--   * orders.reminded_at: when that reminder went out
--   * notifications: the bell. Written by triggers (orders, reviews, questions, leads, payouts,
--     disputes, stock), read and marked read by the store's team.
--   * profiles.notify: which emails the person wants (in-app notifications are always on)

/* What the store sells --------------------------------------------------------------------- */

alter table public.stores
  add column sells text not null default 'digital' check (sells in ('digital', 'physical')),
  add column cart_reminders boolean not null default true;
grant select (sells) on public.stores to anon;
grant select (sells, cart_reminders), update (sells, cart_reminders) on public.stores to authenticated;

-- Stores that already ship things stay physical
update public.stores s set sells = 'physical'
 where exists (select 1 from public.products p where p.store_id = s.id and p.fulfilment = 'physical' and p.status <> 'archived');

-- A product saved (not archived) must be the kind the store sells
create or replace function public.guard_product_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_sells text;
begin
  if new.status = 'archived' then return new; end if;
  if tg_op = 'UPDATE' and new.fulfilment = old.fulfilment and new.status = old.status and new.store_id = old.store_id then return new; end if;
  select sells into v_sells from public.stores where id = new.store_id;
  if v_sells is distinct from new.fulfilment then
    raise exception 'store_sells_%', coalesce(v_sells, 'digital') using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists products_kind on public.products;
create trigger products_kind before insert or update on public.products for each row execute function public.guard_product_kind();

-- Switching needs the other kind's products archived first
create or replace function public.guard_store_sells() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sells is distinct from old.sells and exists (
    select 1 from public.products p where p.store_id = new.id and p.status <> 'archived' and p.fulfilment = old.sells
  ) then
    raise exception 'sells_has_products' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists stores_sells on public.stores;
create trigger stores_sells before update of sells on public.stores for each row execute function public.guard_store_sells();

/* Abandoned checkouts ---------------------------------------------------------------------- */

alter table public.orders add column reminded_at timestamptz;
create index orders_abandoned_idx on public.orders (created_at) where status = 'pending' and reminded_at is null;

/* Email preferences ------------------------------------------------------------------------ */

-- { newOrder, payouts, reviews, questions, leads, lowStock }: true unless switched off
alter table public.profiles add column notify jsonb not null default '{}'::jsonb check (jsonb_typeof(notify) = 'object');
grant select (notify), update (notify) on public.profiles to authenticated;

/* Notifications ---------------------------------------------------------------------------- */

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('order', 'cod', 'refund', 'dispute', 'review', 'question', 'lead', 'payout_paid', 'payout_failed', 'low_stock', 'shipped')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 400),
  href text check (href is null or (href ~ '^/' and char_length(href) <= 300)),
  -- The team area that sees it (lib/team.ts): owners and admins see every one
  area text not null default 'any',
  -- One notification per thing that happened (a trigger firing twice doesn't repeat it)
  dedupe text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, dedupe)
);
create index notifications_store_idx on public.notifications (store_id, created_at desc);
create index notifications_unread_idx on public.notifications (store_id) where read_at is null;

alter table public.notifications enable row level security;
-- 'owner' (payouts) is the store owner alone, as in the app; any other area follows store_can
create or replace function public.notification_visible(p_store uuid, p_area text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_area = 'owner' then exists (select 1 from public.stores s where s.id = p_store and s.owner_id = (select auth.uid()))
              else public.store_can(p_store, p_area) end
$$;
create policy notifications_read on public.notifications for select to authenticated using (public.notification_visible(store_id, area));
-- Marking read is the only change the team makes; rows are written by the triggers below
create policy notifications_mark on public.notifications for update to authenticated using (public.notification_visible(store_id, area)) with check (public.notification_visible(store_id, area));
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_store uuid, p_kind text, p_title text, p_body text, p_href text, p_area text, p_dedupe text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (store_id, kind, title, body, href, area, dedupe)
  values (p_store, p_kind, left(p_title, 160), left(p_body, 400), p_href, p_area, p_dedupe)
  on conflict (store_id, dedupe) do nothing;
$$;

create or replace function public.money_text(p_minor bigint, p_currency text) returns text
language sql stable set search_path = '' as $$
  select case p_currency when 'INR' then '₹' when 'USD' then '$' when 'EUR' then '€' when 'GBP' then '£' else p_currency || ' ' end
         || to_char(p_minor / 100.0, 'FM999,999,999,990.00');
$$;

-- Orders: paid, placed for cash on delivery, refunded
create or replace function public.notify_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_amount text := public.money_text(new.total_minor, new.currency);
  v_was text := case when tg_op = 'UPDATE' then old.status::text end;
begin
  -- A COD order that's collected later was already announced when it was placed
  if new.status = 'paid' and v_was is distinct from 'paid' and v_was is distinct from 'cod' then
    perform public.notify(new.store_id, 'order', 'New order: ' || v_amount, coalesce(new.buyer_name, 'A buyer') || ' paid for order ' || new.ref || '.', '/sales/orders/' || new.id, 'orders', 'order:' || new.id);
  elsif new.status = 'cod' and v_was is distinct from 'cod' then
    perform public.notify(new.store_id, 'cod', 'Cash on delivery order: ' || v_amount, coalesce(new.buyer_name, 'A buyer') || ' placed order ' || new.ref || '. Ship it and collect on delivery.', '/sales/orders/' || new.id, 'orders', 'cod:' || new.id);
  elsif new.status = 'refunded' and v_was is not null and v_was <> 'refunded' then
    perform public.notify(new.store_id, 'refund', 'Refunded: ' || v_amount, 'Order ' || new.ref || ' for ' || new.buyer_name || ' was refunded.', '/sales/orders/' || new.id, 'orders', 'refund:' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert or update of status on public.orders for each row execute function public.notify_order();

-- Card disputes
create or replace function public.notify_dispute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
  select id, store_id, ref into o from public.orders where id = new.order_id;
  if o.id is null then return null; end if;
  perform public.notify(o.store_id, 'dispute', 'A buyer disputed order ' || o.ref, 'Their bank opened a dispute for ' || public.money_text(new.amount_minor, new.currency) || '. Reply before the deadline.', '/sales/orders/' || o.id, 'orders', 'dispute:' || new.id);
  return null;
end $$;
drop trigger if exists disputes_notify on public.disputes;
create trigger disputes_notify after insert on public.disputes for each row execute function public.notify_dispute();

-- Reviews and questions from buyers
create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.store_id, 'review', coalesce(nullif(new.reviewer_name, ''), 'A buyer') || ' left a ' || new.rating || '-star review', coalesce(nullif(new.title, ''), left(new.body, 140)), '/store/' || new.store_id || '/design/pages/home/edit?panel=reviews', 'design', 'review:' || new.id);
  return null;
end $$;
drop trigger if exists reviews_notify on public.reviews;
create trigger reviews_notify after insert on public.reviews for each row execute function public.notify_review();

create or replace function public.notify_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.store_id, 'question', coalesce(nullif(new.asker_name, ''), 'A buyer') || ' asked a question', left(new.body, 200), '/store/' || new.store_id || '/design/pages/home/edit?panel=questions', 'design', 'question:' || new.id);
  return null;
end $$;
drop trigger if exists questions_notify on public.questions;
create trigger questions_notify after insert on public.questions for each row execute function public.notify_question();

-- Forms, bookings and newsletter sign-ups
create or replace function public.notify_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_what text := case new.kind when 'booking' then 'booked a slot' when 'newsletter' then 'joined your newsletter' else 'sent a form' end;
begin
  perform public.notify(new.store_id, 'lead', coalesce(nullif(new.name, ''), new.email, 'Someone') || ' ' || v_what, new.email, '/sales/leads', 'orders', 'lead:' || new.id);
  return null;
end $$;
drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert on public.leads for each row execute function public.notify_lead();

-- Payouts: sent, or came back
create or replace function public.notify_payout() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_amount text := public.money_text(new.amount_minor, new.currency);
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.notify(new.store_id, 'payout_paid', v_amount || ' is on its way to you', 'Your withdrawal was sent to your payout account.', '/sales/payouts/balance', 'owner', 'payout_paid:' || new.id);
  elsif new.status = 'failed' and old.status is distinct from 'failed' then
    perform public.notify(new.store_id, 'payout_failed', 'Your payout of ' || v_amount || ' came back', coalesce(new.failure_reason, 'The money is back in your balance. Check your payout details.'), '/sales/payouts/balance', 'owner', 'payout_failed:' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists payouts_notify on public.payouts;
create trigger payouts_notify after update of status on public.payouts for each row execute function public.notify_payout();

-- Stock running out (5 or fewer left), once each time it drops past that
create or replace function public.notify_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_title text; v_product uuid;
begin
  if new.stock is null or new.stock > 5 or (old.stock is not null and old.stock <= 5) then return null; end if;
  if tg_table_name = 'products' then
    v_store := new.store_id; v_title := new.title; v_product := new.id;
  else
    select p.store_id, p.title || ' (' || new.title || ')', p.id into v_store, v_title, v_product from public.products p where p.id = new.product_id;
  end if;
  perform public.notify(v_store, 'low_stock', case when new.stock = 0 then 'Sold out: ' else 'Running low: ' end || v_title,
    case when new.stock = 0 then 'Nobody can buy it until you add stock.' else new.stock || ' left.' end,
    '/catalog/products/' || v_product, 'catalog', 'stock:' || new.id || ':' || extract(epoch from now())::bigint / 3600);
  return null;
end $$;
drop trigger if exists products_stock_notify on public.products;
create trigger products_stock_notify after update of stock on public.products for each row when (new.track_stock) execute function public.notify_stock();
drop trigger if exists variants_stock_notify on public.product_variants;
create trigger variants_stock_notify after update of stock on public.product_variants for each row execute function public.notify_stock();

-- Marks everything this person can see as read
create or replace function public.notifications_read_all(p_store uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.notifications set read_at = now() where store_id = p_store and read_at is null and public.notification_visible(store_id, area);
$$;

revoke execute on function public.notify(uuid, text, text, text, text, text, text), public.guard_product_kind(), public.guard_store_sells(),
  public.notify_order(), public.notify_dispute(), public.notify_review(), public.notify_question(), public.notify_lead(), public.notify_payout(), public.notify_stock()
  from public, anon, authenticated;
revoke execute on function public.notification_visible(uuid, text) from public, anon;
grant execute on function public.notifications_read_all(uuid), public.notification_visible(uuid, text) to authenticated;
