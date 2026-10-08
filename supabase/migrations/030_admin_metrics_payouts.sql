-- 030: what the founder console needs to see how the platform is used, and to pay sellers.
--   * creator activity (one row per person per day, plus "last seen") for daily/monthly/yearly active users and "online now"
--   * admin_overview now takes a time range (3, 7, 30 days) and compares with the period before
--   * admin_live: a light count of who is online right now
--   * admin_products, admin_set_product_status: the products in every store
--   * admin_team: who is an admin; admin_webhooks: the payment webhook log
--   * payout conversion fields, and settle_payout_by_gateway for Razorpay's payout webhooks

alter table public.profiles add column last_seen_at timestamptz;

create table public.activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
create index activity_days_day_idx on public.activity_days (day);
alter table public.activity_days enable row level security;

-- Called by the creator app when it opens and every few minutes while it is in use
create or replace function public.touch_activity() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  update public.profiles set last_seen_at = now() where id = uid and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
  insert into public.activity_days (user_id, day) values (uid, (now() at time zone 'Asia/Kolkata')::date) on conflict do nothing;
end $$;
revoke all on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

alter table public.payouts
  add column payout_currency text,
  add column payout_amount_minor bigint,
  add column fx_rate numeric;

-- Razorpay tells us a payout finished or came back: close it the same way the admin buttons do
create or replace function public.settle_payout_by_gateway(p_gateway_id text, p_ok boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  select id into pid from public.payouts where gateway_payout_id = p_gateway_id;
  if pid is null then return; end if;
  perform public.settle_payout(pid, p_ok, null, p_reason);
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (null, case when p_ok then 'payout_paid' else 'payout_failed' end, 'payout', pid::text, jsonb_build_object('by', 'razorpay', 'gateway_id', p_gateway_id, 'reason', p_reason));
end $$;
revoke all on function public.settle_payout_by_gateway(text, boolean, text) from public, anon, authenticated;
grant execute on function public.settle_payout_by_gateway(text, boolean, text) to service_role;

-- Overview ----------------------------------------------------------------------------------------

drop function public.admin_overview();
create or replace function public.admin_overview(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 1), 90);
  today date := (now() at time zone 'Asia/Kolkata')::date;
  p_from timestamptz := ((today - (d - 1))::timestamp at time zone 'Asia/Kolkata');
  p_to timestamptz := now();
  q_from timestamptz := ((today - (2 * d - 1))::timestamp at time zone 'Asia/Kolkata');
  t0 timestamptz := (today::timestamp at time zone 'Asia/Kolkata');
  t30 timestamptz := ((today - 29)::timestamp at time zone 'Asia/Kolkata');
  t365 timestamptz := ((today - 364)::timestamp at time zone 'Asia/Kolkata');
  out jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  out := jsonb_build_object(
    'days', d,
    'totals', jsonb_build_object(
      'creators', (select count(*) from public.profiles),
      'pro', (select count(*) from public.profiles where plan = 'pro'),
      'stores', (select count(*) from public.stores),
      'storesLive', (select count(*) from public.stores where status = 'published'),
      'storesSuspended', (select count(*) from public.stores where status = 'suspended'),
      'products', (select count(*) from public.products),
      'productsLive', (select count(*) from public.products where status = 'live'),
      'paidOrders', (select count(*) from public.orders where status = 'paid'),
      'buyers', (select count(distinct buyer_email) from public.orders where status = 'paid'),
      'refunded', (select count(*) from public.orders where status = 'refunded'),
      'gmv', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', t) order by t desc)
          from (select o.currency, sum(o.total_minor) t from public.orders o where o.status = 'paid' group by o.currency) g), '[]'::jsonb),
      'fees', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', t) order by t desc)
          from (select l.currency, sum(l.amount_minor) t from public.ledger_entries l where l.account = 'platform' group by l.currency) f), '[]'::jsonb)));

  out := out || jsonb_build_object(
    'period', jsonb_build_object(
      'payments', (select count(*) from public.orders where status = 'paid' and paid_at >= p_from and paid_at < p_to),
      'refunds', (select count(*) from public.refunds where created_at >= p_from and created_at < p_to),
      'signups', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
      'newStores', (select count(*) from public.stores where created_at >= p_from and created_at < p_to),
      'buyers', (select count(distinct buyer_email) from public.orders where status = 'paid' and paid_at >= p_from and paid_at < p_to),
      'activeCreators', (select count(distinct user_id) from public.activity_days where day >= today - (d - 1)),
      'visitors', (select count(distinct session) from public.store_events where created_at >= p_from and created_at < p_to),
      'gmv', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', t) order by t desc)
          from (select o.currency, sum(o.total_minor) t from public.orders o where o.status = 'paid' and o.paid_at >= p_from and o.paid_at < p_to group by o.currency) g), '[]'::jsonb),
      'fees', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', t) order by t desc)
          from (select l.currency, sum(l.amount_minor) t from public.ledger_entries l where l.account = 'platform' and l.created_at >= p_from and l.created_at < p_to group by l.currency) f), '[]'::jsonb)),
    'before', jsonb_build_object(
      'payments', (select count(*) from public.orders where status = 'paid' and paid_at >= q_from and paid_at < p_from),
      'signups', (select count(*) from public.profiles where created_at >= q_from and created_at < p_from),
      'activeCreators', (select count(distinct user_id) from public.activity_days where day >= today - (2 * d - 1) and day < today - (d - 1)),
      'visitors', (select count(distinct session) from public.store_events where created_at >= q_from and created_at < p_from)));

  out := out || jsonb_build_object(
    'activity', jsonb_build_object(
      'creators', jsonb_build_object(
        'dau', (select count(distinct user_id) from public.activity_days where day = today),
        'mau', (select count(distinct user_id) from public.activity_days where day >= today - 29),
        'yau', (select count(distinct user_id) from public.activity_days where day >= today - 364)),
      'visitors', jsonb_build_object(
        'dau', (select count(distinct session) from public.store_events where created_at >= t0),
        'mau', (select count(distinct session) from public.store_events where created_at >= t30),
        'yau', (select count(distinct session) from public.store_events where created_at >= t365)),
      'buyers', jsonb_build_object(
        'dau', (select count(distinct buyer_email) from public.orders where status = 'paid' and paid_at >= t0),
        'mau', (select count(distinct buyer_email) from public.orders where status = 'paid' and paid_at >= t30),
        'yau', (select count(distinct buyer_email) from public.orders where status = 'paid' and paid_at >= t365))),
    'live', jsonb_build_object(
      'creators', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
      'visitors', (select count(distinct session) from public.store_events where created_at > now() - interval '5 minutes'),
      'payments', (select count(*) from public.orders where status = 'paid' and paid_at > now() - interval '1 hour')),
    'queues', jsonb_build_object(
      'payouts', (select count(*) from public.payouts where status in ('requested', 'processing')),
      'disputes', (select count(*) from public.disputes where status in ('open', 'under_review')),
      'reports', (select count(*) from public.reports where status = 'open'),
      'deals', (select count(*) from public.marketplace_deals where status = 'live' and verified_at is null),
      'webhookFailures', (select count(*) from public.webhook_events where error is not null and processed_at is null and created_at > now() - interval '7 days')));

  out := out || jsonb_build_object(
    'series', coalesce((select jsonb_agg(jsonb_build_object('day', x::date, 'payments', coalesce(o.n, 0), 'signups', coalesce(s.n, 0), 'activeCreators', coalesce(a.n, 0), 'visitors', coalesce(v.n, 0)) order by x)
      from generate_series(today - (d - 1), today, interval '1 day') x
      left join (select (paid_at at time zone 'Asia/Kolkata')::date as day, count(*) as n from public.orders where status = 'paid' and paid_at >= p_from group by 1) o on o.day = x::date
      left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n from public.profiles where created_at >= p_from group by 1) s on s.day = x::date
      left join (select ad.day, count(*) as n from public.activity_days ad where ad.day >= today - (d - 1) group by 1) a on a.day = x::date
      left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(distinct session) as n from public.store_events where created_at >= p_from group by 1) v on v.day = x::date), '[]'::jsonb));
  return out;
end $$;

-- Cheap enough to ask every few seconds
create or replace function public.admin_live() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'creators', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'visitors', (select count(distinct session) from public.store_events where created_at > now() - interval '5 minutes'),
    'payments', (select count(*) from public.orders where status = 'paid' and paid_at > now() - interval '1 hour'),
    'at', now());
end $$;

-- Creators now show when they were last in the app
drop function public.admin_creators(text, integer);
create or replace function public.admin_creators(p_q text default null, p_limit integer default 300)
returns table (id uuid, email text, full_name text, plan text, country text, created_at timestamptz, last_seen_at timestamptz, stores bigint, suspended bigint, orders bigint, revenue jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select pr.id, pr.email::text, pr.full_name, pr.plan::text, pr.country, pr.created_at, pr.last_seen_at,
      (select count(*) from public.stores s where s.owner_id = pr.id),
      (select count(*) from public.stores s where s.owner_id = pr.id and s.status = 'suspended'),
      (select count(*) from public.orders o join public.stores s on s.id = o.store_id where s.owner_id = pr.id and o.status = 'paid'),
      coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount', x.amt)) from (
        select o.currency, sum(o.total_minor) amt from public.orders o join public.stores s on s.id = o.store_id
        where s.owner_id = pr.id and o.status = 'paid' group by o.currency) x), '[]'::jsonb)
    from public.profiles pr
    where q is null or pr.email::text ilike q or pr.full_name ilike q
    order by pr.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;

-- Payouts carry what is needed to convert and send them
drop function public.admin_payouts(text);
create or replace function public.admin_payouts(p_status text default null)
returns table (id uuid, store_id uuid, store_name text, store_country text, owner_email text, holder_name text, method_kind text, method_label text, has_fund_account boolean, currency text, amount_minor bigint, fee_minor bigint, status text, failure_reason text, gateway_payout_id text, payout_currency text, payout_amount_minor bigint, fx_rate numeric, requested_at timestamptz, processed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select p.id, p.store_id, s.name, s.country, pr.email::text, m.holder_name, m.kind,
      case when m.account_last4 is not null then coalesce(m.bank_name, 'Bank') || ' ••' || m.account_last4
           when m.upi_masked is not null then m.upi_masked
           when m.wallet_address is not null then coalesce(m.asset, '') || ' ' || coalesce(m.network, '') || ' …' || right(m.wallet_address, 6)
           else m.kind end,
      m.gateway_fund_account_id is not null,
      p.currency::text, p.amount_minor, p.fee_minor, p.status::text, p.failure_reason, p.gateway_payout_id, p.payout_currency, p.payout_amount_minor, p.fx_rate, p.requested_at, p.processed_at
    from public.payouts p
    join public.stores s on s.id = p.store_id
    left join public.profiles pr on pr.id = p.owner_id
    left join public.payout_methods m on m.id = p.method_id
    where p_status is null or p.status::text = p_status
    order by (p.status in ('requested', 'processing')) desc, p.requested_at desc limit 300;
end $$;

-- Products -----------------------------------------------------------------------------------------

create or replace function public.admin_products(p_q text default null, p_status text default null, p_store uuid default null)
returns table (id uuid, title text, slug text, status text, store_id uuid, store_name text, store_slug text, store_status text, fulfilment text, product_type text, currency text, price_minor bigint, created_at timestamptz, units bigint, revenue bigint)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select p.id, p.title, p.slug::text, p.status::text, p.store_id, s.name, s.slug::text, s.status::text, p.fulfilment, p.product_type, p.currency::text, p.price_minor, p.created_at,
      coalesce(sum(i.quantity) filter (where o.id is not null and not coalesce(i.is_gift, false)), 0)::bigint,
      coalesce(sum(i.line_total_minor) filter (where o.id is not null and not coalesce(i.is_gift, false)), 0)::bigint
    from public.products p
    join public.stores s on s.id = p.store_id
    left join public.order_items i on i.product_id = p.id
    left join public.orders o on o.id = i.order_id and o.status = 'paid'
    where (p_status is null or p.status::text = p_status) and (p_store is null or p.store_id = p_store)
      and (q is null or p.title ilike q or s.name ilike q or p.sku ilike q)
    group by p.id, s.id
    order by p.created_at desc limit 500;
end $$;

create or replace function public.admin_set_product_status(p_product uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('live', 'draft', 'archived') then raise exception 'product_status_invalid'; end if;
  select status::text into cur from public.products where id = p_product for update;
  if cur is null then raise exception 'not_found'; end if;
  if p_status <> 'live' and char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update public.products set status = p_status::public.product_status where id = p_product;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), 'product_' || p_status, 'product', p_product::text, jsonb_build_object('from', cur, 'to', p_status, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
end $$;

-- Team and webhooks --------------------------------------------------------------------------------

create or replace function public.admin_team()
returns table (id uuid, email text, full_name text, since timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select u.id, u.email::text, pr.full_name, u.created_at, u.last_sign_in_at
    from auth.users u left join public.profiles pr on pr.id = u.id
    where u.raw_app_meta_data->>'role' = 'admin'
    order by u.created_at;
end $$;

create or replace function public.admin_webhooks(p_failed boolean default false)
returns table (id bigint, gateway text, event_id text, event_type text, created_at timestamptz, processed_at timestamptz, error text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select w.id, w.gateway, w.event_id, w.event_type, w.created_at, w.processed_at, w.error
    from public.webhook_events w
    where not p_failed or (w.processed_at is null)
    order by w.created_at desc limit 200;
end $$;

revoke all on function public.admin_overview(integer), public.admin_live(), public.admin_creators(text, integer), public.admin_payouts(text),
  public.admin_products(text, text, uuid), public.admin_set_product_status(uuid, text, text), public.admin_team(), public.admin_webhooks(boolean) from public, anon;
grant execute on function public.admin_overview(integer), public.admin_live(), public.admin_creators(text, integer), public.admin_payouts(text),
  public.admin_products(text, text, uuid), public.admin_set_product_status(uuid, text, text), public.admin_team(), public.admin_webhooks(boolean) to authenticated;
