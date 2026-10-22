-- 028: the founder console. Every admin screen reads and writes the database through the functions
-- below; each one checks is_admin() first and writes an audit_log row for anything it changes.
-- Also adds the two things the console needs that did not exist: card disputes and content reports.

-- Card disputes (chargebacks), filled in from the payment gateway's webhook
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  gateway_dispute_id text not null unique,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  reason text,
  status text not null default 'open' check (status in ('open', 'under_review', 'won', 'lost', 'closed')),
  respond_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_order_idx on public.disputes (order_id);
create trigger disputes_updated before update on public.disputes for each row execute function public.set_updated_at();
alter table public.disputes enable row level security;
create policy disputes_read on public.disputes for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = disputes.order_id and public.is_store_owner(o.store_id)));
grant select on public.disputes to authenticated;

create or replace function public.record_dispute(p_payment_id text, p_dispute_id text, p_amount bigint, p_currency text, p_reason text, p_status text, p_respond_by timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin
  select o.id into oid from public.orders o where o.gateway_payment_id = p_payment_id;
  if oid is null then return; end if;
  insert into public.disputes (order_id, gateway_dispute_id, amount_minor, currency, reason, status, respond_by)
  values (oid, p_dispute_id, greatest(coalesce(p_amount, 0), 0), upper(p_currency), left(p_reason, 300), p_status, p_respond_by)
  on conflict (gateway_dispute_id) do update
    set status = excluded.status, reason = coalesce(excluded.reason, public.disputes.reason), respond_by = coalesce(excluded.respond_by, public.disputes.respond_by);
end $$;
revoke all on function public.record_dispute(text, text, bigint, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_dispute(text, text, bigint, text, text, text, timestamptz) to service_role;

-- Reports: anyone can flag a review, question, product or store; only the admin console reads them
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('review', 'question', 'product', 'store')),
  target_id uuid not null,
  store_id uuid references public.stores(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  reporter_email extensions.citext,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_open_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
alter table public.reports enable row level security;
create policy reports_admin_read on public.reports for select to authenticated using (public.is_admin());
grant select on public.reports to authenticated;

create or replace function public.report_content(p_type text, p_target uuid, p_reason text, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid; em text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if p_type not in ('review', 'question', 'product', 'store') or char_length(trim(coalesce(p_reason, ''))) not between 5 and 500 then raise exception 'report_invalid'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'report_invalid'; end if;
  -- only things a visitor could actually see
  if p_type = 'review' then
    select r.store_id into sid from public.reviews r where r.id = p_target and r.status = 'published' and public.store_is_public(r.store_id);
  elsif p_type = 'question' then
    select q.store_id into sid from public.questions q where q.id = p_target and q.status = 'published' and public.store_is_public(q.store_id);
  elsif p_type = 'product' then
    select p.store_id into sid from public.products p where p.id = p_target and p.status = 'live' and public.store_is_public(p.store_id);
  else
    select s.id into sid from public.stores s where s.id = p_target and s.status = 'published';
  end if;
  if sid is null then raise exception 'report_target_not_found'; end if;
  -- one open report per person per thing, and a ceiling per thing so it can't be flooded
  if em is not null and exists (select 1 from public.reports x where x.target_type = p_type and x.target_id = p_target and x.status = 'open' and x.reporter_email = em::extensions.citext) then return; end if;
  if (select count(*) from public.reports x where x.target_type = p_type and x.target_id = p_target and x.status = 'open') >= 25 then return; end if;
  insert into public.reports (target_type, target_id, store_id, reason, reporter_email) values (p_type, p_target, sid, trim(p_reason), em::extensions.citext);
end $$;
revoke all on function public.report_content(text, uuid, text, text) from public;
grant execute on function public.report_content(text, uuid, text, text) to anon, authenticated;

-- A suspended store stays suspended until an admin lifts it; sellers can't suspend or un-suspend themselves
create or replace function public.guard_store_suspension() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and not public.is_admin() and auth.uid() is not null
     and (old.status = 'suspended' or new.status = 'suspended') then
    raise exception 'store_suspended';
  end if;
  return new;
end $$;
create trigger trg_store_suspension before update on public.stores for each row execute function public.guard_store_suspension();

-- Reading ---------------------------------------------------------------------------------------

create or replace function public.admin_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'disputes_open', (select count(*) from public.disputes where status in ('open', 'under_review')),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'payouts_open', (select count(*) from public.payouts where status in ('requested', 'processing')));
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'creators', (select count(*) from public.profiles),
    'creatorsNew30', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'pro', (select count(*) from public.profiles where plan = 'pro'),
    'stores', (select count(*) from public.stores),
    'storesLive', (select count(*) from public.stores where status = 'published'),
    'storesSuspended', (select count(*) from public.stores where status = 'suspended'),
    'paidOrders', (select count(*) from public.orders where status = 'paid'),
    'paidOrders30', (select count(*) from public.orders where status = 'paid' and paid_at > now() - interval '30 days'),
    'refunded', (select count(*) from public.orders where status = 'refunded'),
    'gmv', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'all', total, 'last30', last30) order by total desc)
        from (select o.currency, sum(o.total_minor) total, coalesce(sum(o.total_minor) filter (where o.paid_at > now() - interval '30 days'), 0) last30
              from public.orders o where o.status = 'paid' group by o.currency) g), '[]'::jsonb),
    'fees', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amt) order by amt desc)
        from (select l.currency, sum(l.amount_minor) amt from public.ledger_entries l where l.account = 'platform' group by l.currency) f), '[]'::jsonb),
    'payoutsOpen', (select count(*) from public.payouts where status in ('requested', 'processing')),
    'disputesOpen', (select count(*) from public.disputes where status in ('open', 'under_review')),
    'reportsOpen', (select count(*) from public.reports where status = 'open'),
    'dealsToVerify', (select count(*) from public.marketplace_deals where status = 'live' and verified_at is null),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'orders', coalesce(o.n, 0), 'creators', coalesce(c.n, 0)) order by d)
        from generate_series((now() at time zone 'Asia/Kolkata')::date - 29, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d
        left join (select (paid_at at time zone 'Asia/Kolkata')::date as day, count(*) as n from public.orders where status = 'paid' and paid_at > now() - interval '31 days' group by 1) o on o.day = d::date
        left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*) as n from public.profiles where created_at > now() - interval '31 days' group by 1) c on c.day = d::date), '[]'::jsonb));
end $$;

create or replace function public.admin_creators(p_q text default null, p_limit integer default 300)
returns table (id uuid, email text, full_name text, plan text, country text, created_at timestamptz, stores bigint, suspended bigint, orders bigint, revenue jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select pr.id, pr.email::text, pr.full_name, pr.plan::text, pr.country, pr.created_at,
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

create or replace function public.admin_stores(p_q text default null, p_limit integer default 300)
returns table (id uuid, slug text, name text, status text, owner_id uuid, owner_email text, owner_name text, currency text, country text, created_at timestamptz, products bigint, orders bigint, gross bigint, domain text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select s.id, s.slug::text, s.name, s.status::text, s.owner_id, pr.email::text, pr.full_name, s.currency_base, s.country, s.created_at,
      (select count(*) from public.products p where p.store_id = s.id),
      (select count(*) from public.orders o where o.store_id = s.id and o.status = 'paid'),
      coalesce((select sum(o.total_minor) from public.orders o where o.store_id = s.id and o.status = 'paid' and o.currency = s.currency_base), 0)::bigint,
      (select d.hostname::text from public.domains d where d.store_id = s.id and d.status = 'active' limit 1)
    from public.stores s left join public.profiles pr on pr.id = s.owner_id
    where q is null or s.name ilike q or s.slug::text ilike q or pr.email::text ilike q
    order by s.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function public.admin_orders(p_q text default null, p_status text default null, p_limit integer default 300)
returns table (id uuid, ref text, store_id uuid, store_name text, status text, buyer_name text, buyer_email text, country text, currency text, total_minor bigint, paid_at timestamptz, created_at timestamptz, refunded boolean, disputed boolean)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select o.id, o.ref, o.store_id, s.name, o.status::text, o.buyer_name,
      left(o.buyer_email::text, 1) || '***@' || split_part(o.buyer_email::text, '@', 2), o.buyer_country, o.currency, o.total_minor, o.paid_at, o.created_at,
      o.status = 'refunded', exists (select 1 from public.disputes d where d.order_id = o.id and d.status in ('open', 'under_review'))
    from public.orders o join public.stores s on s.id = o.store_id
    where (p_status is null or o.status::text = p_status) and (q is null or o.ref ilike q or o.buyer_email::text ilike q or o.buyer_name ilike q or s.name ilike q)
    order by o.created_at desc limit least(greatest(p_limit, 1), 500);
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
      p.currency, p.amount_minor, p.fee_minor, p.status::text, p.failure_reason, p.gateway_payout_id, p.requested_at, p.processed_at
    from public.payouts p
    join public.stores s on s.id = p.store_id
    left join public.profiles pr on pr.id = p.owner_id
    left join public.payout_methods m on m.id = p.method_id
    where p_status is null or p.status::text = p_status
    order by (p.status in ('requested', 'processing')) desc, p.requested_at desc limit 300;
end $$;

create or replace function public.admin_refunds()
returns table (id uuid, created_at timestamptz, order_id uuid, order_ref text, store_name text, amount_minor bigint, currency text, reason text, status text, gateway_refund_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select r.id, r.created_at, r.order_id, o.ref, s.name, r.amount_minor, o.currency, r.reason, r.status, r.gateway_refund_id
    from public.refunds r join public.orders o on o.id = r.order_id join public.stores s on s.id = o.store_id
    order by r.created_at desc limit 300;
end $$;

create or replace function public.admin_disputes(p_status text default null)
returns table (id uuid, created_at timestamptz, order_id uuid, order_ref text, store_name text, amount_minor bigint, currency text, reason text, status text, respond_by timestamptz, gateway_dispute_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select d.id, d.created_at, d.order_id, o.ref, s.name, d.amount_minor, d.currency, d.reason, d.status, d.respond_by, d.gateway_dispute_id
    from public.disputes d join public.orders o on o.id = d.order_id join public.stores s on s.id = o.store_id
    where p_status is null or d.status = p_status
    order by (d.status in ('open', 'under_review')) desc, d.created_at desc limit 300;
end $$;

-- Reviews and questions, with who wrote them and where
create or replace function public.admin_content(p_type text, p_status text default null)
returns table (id uuid, kind text, created_at timestamptz, status text, store_id uuid, store_name text, product_title text, author text, rating smallint, title text, body text, answer text, open_reports bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_type = 'review' then
    return query
      select r.id, 'review'::text, r.created_at, r.status::text, r.store_id, s.name, p.title, r.reviewer_name, r.rating, r.title, r.body, r.creator_reply,
        (select count(*) from public.reports x where x.target_type = 'review' and x.target_id = r.id and x.status = 'open')
      from public.reviews r join public.stores s on s.id = r.store_id left join public.products p on p.id = r.product_id
      where p_status is null or r.status::text = p_status
      order by r.created_at desc limit 300;
  else
    return query
      select q.id, 'question'::text, q.created_at, q.status::text, q.store_id, s.name, p.title, q.asker_name, null::smallint, null::text, q.body, q.answer,
        (select count(*) from public.reports x where x.target_type = 'question' and x.target_id = q.id and x.status = 'open')
      from public.questions q join public.stores s on s.id = q.store_id left join public.products p on p.id = q.product_id
      where p_status is null or q.status::text = p_status
      order by q.created_at desc limit 300;
  end if;
end $$;

create or replace function public.admin_reports(p_status text default null)
returns table (id uuid, created_at timestamptz, target_type text, target_id uuid, store_id uuid, store_name text, label text, excerpt text, reason text, reporter_email text, status text, resolved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select x.id, x.created_at, x.target_type, x.target_id, x.store_id, s.name,
      case x.target_type when 'review' then 'Review' when 'question' then 'Question' when 'product' then 'Product' else 'Store' end,
      case x.target_type
        when 'review' then (select left(coalesce(r.title || ' · ', '') || coalesce(r.body, ''), 200) from public.reviews r where r.id = x.target_id)
        when 'question' then (select left(q.body, 200) from public.questions q where q.id = x.target_id)
        when 'product' then (select p.title from public.products p where p.id = x.target_id)
        else (select st.name from public.stores st where st.id = x.target_id) end,
      x.reason, x.reporter_email::text, x.status, x.resolved_at
    from public.reports x left join public.stores s on s.id = x.store_id
    where p_status is null or x.status = p_status
    order by (x.status = 'open') desc, x.created_at desc limit 300;
end $$;

create or replace function public.admin_deals()
returns table (id uuid, created_at timestamptz, title text, store_id uuid, store_name text, billing text, price_minor bigint, original_price_minor bigint, currency text, status text, verified_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select d.id, d.created_at, d.title, d.store_id, s.name, d.billing, d.price_minor, d.original_price_minor, s.currency_base, d.status, d.verified_at, d.ends_at
    from public.marketplace_deals d join public.stores s on s.id = d.store_id
    order by (d.verified_at is null and d.status = 'live') desc, d.created_at desc limit 300;
end $$;

create or replace function public.admin_audit(p_q text default null, p_limit integer default 300)
returns table (id bigint, created_at timestamptz, actor_email text, action text, target_type text, target_id text, meta jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select a.id, a.created_at, pr.email::text, a.action, a.target_type, a.target_id, a.meta
    from public.audit_log a left join public.profiles pr on pr.id = a.actor_id
    where q is null or a.action ilike q or a.target_id ilike q or pr.email::text ilike q or a.target_type ilike q
    order by a.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;

-- Doing things ------------------------------------------------------------------------------------

create or replace function public.admin_set_store_status(p_store uuid, p_suspend boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare cur text; nxt text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select s.status::text into cur from public.stores s where s.id = p_store for update;
  if cur is null then raise exception 'store_not_found'; end if;
  if p_suspend then
    if cur = 'suspended' then return cur; end if;
    if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
    nxt := 'suspended';
  else
    if cur <> 'suspended' then return cur; end if;
    -- back to what it was before, or a draft the seller can republish
    select coalesce((select a.meta->>'from' from public.audit_log a where a.action = 'suspend_store' and a.target_id = p_store::text order by a.created_at desc limit 1), 'draft') into nxt;
    if nxt not in ('draft', 'published') then nxt := 'draft'; end if;
  end if;
  update public.stores set status = nxt::public.store_status where id = p_store;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_suspend then 'suspend_store' else 'restore_store' end, 'store', p_store::text, jsonb_build_object('from', cur, 'to', nxt, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
  return nxt;
end $$;

create or replace function public.admin_moderate(p_type text, p_id uuid, p_hide boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_type = 'review' then
    update public.reviews set status = (case when p_hide then 'hidden' else 'published' end)::public.moderation_status where id = p_id;
  elsif p_type = 'question' then
    update public.questions set status = (case when p_hide then 'hidden' else 'published' end)::public.moderation_status where id = p_id;
  else
    raise exception 'moderate_invalid';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_found'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_hide then 'hide_' else 'show_' end || p_type, p_type, p_id::text, jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
end $$;

-- Closes a report: either the thing is taken down, or the report is dismissed
create or replace function public.admin_resolve_report(p_report uuid, p_remove boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'open' then return; end if;
  if p_remove then
    if r.target_type in ('review', 'question') then perform public.admin_moderate(r.target_type, r.target_id, true, r.reason);
    elsif r.target_type = 'product' then update public.products set status = 'archived' where id = r.target_id;
    else perform public.admin_set_store_status(r.target_id, true, r.reason);
    end if;
  end if;
  update public.reports set status = case when p_remove then 'actioned' else 'dismissed' end, resolved_by = auth.uid(), resolved_at = now() where id = r.id;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_remove then 'report_actioned' else 'report_dismissed' end, 'report', r.id::text, jsonb_build_object('target_type', r.target_type, 'target_id', r.target_id));
end $$;

-- The payout queue is worked by hand until a payout provider is connected: mark it on its way, paid (with the bank reference) or failed (the money goes back to the seller)
create or replace function public.admin_set_payout(p_payout uuid, p_action text, p_ref text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select status::text into cur from public.payouts where id = p_payout for update;
  if cur is null then raise exception 'not_found'; end if;
  if cur in ('paid', 'failed', 'cancelled') then raise exception 'payout_closed'; end if;
  if p_action = 'processing' then
    update public.payouts set status = 'processing' where id = p_payout;
  elsif p_action = 'paid' then
    if char_length(trim(coalesce(p_ref, ''))) < 4 then raise exception 'reference_required'; end if;
    perform public.settle_payout(p_payout, true, trim(p_ref), null);
  elsif p_action = 'failed' then
    if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
    perform public.settle_payout(p_payout, false, null, trim(p_reason));
  else
    raise exception 'payout_action_invalid';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), 'payout_' || p_action, 'payout', p_payout::text, jsonb_build_object('from', cur, 'ref', nullif(trim(coalesce(p_ref, '')), ''), 'reason', nullif(trim(coalesce(p_reason, '')), '')));
end $$;

-- Verifying a marketplace deal now leaves a trace, and only signed-in admins can call it
create or replace function public.admin_verify_deal(p_deal uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.marketplace_deals set verified_at = case when p_on then now() end where id = p_deal;
  if not found then raise exception 'not_found'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_on then 'verify_deal' else 'unverify_deal' end, 'deal', p_deal::text, '{}'::jsonb);
end $$;

-- Phone reveal keeps its reason check; it just refuses for anyone who isn't signed in
revoke all on function public.admin_verify_deal(uuid, boolean) from public, anon;
revoke all on function public.admin_search(text, integer) from public, anon;
revoke all on function public.admin_reveal_buyer_phone(uuid, text) from public, anon;

revoke all on function
  public.admin_counts(), public.admin_overview(), public.admin_creators(text, integer), public.admin_stores(text, integer),
  public.admin_orders(text, text, integer), public.admin_payouts(text), public.admin_refunds(), public.admin_disputes(text),
  public.admin_content(text, text), public.admin_reports(text), public.admin_deals(), public.admin_audit(text, integer),
  public.admin_set_store_status(uuid, boolean, text), public.admin_moderate(text, uuid, boolean, text),
  public.admin_resolve_report(uuid, boolean), public.admin_set_payout(uuid, text, text, text)
  from public, anon;
grant execute on function
  public.admin_counts(), public.admin_overview(), public.admin_creators(text, integer), public.admin_stores(text, integer),
  public.admin_orders(text, text, integer), public.admin_payouts(text), public.admin_refunds(), public.admin_disputes(text),
  public.admin_content(text, text), public.admin_reports(text), public.admin_deals(), public.admin_audit(text, integer),
  public.admin_set_store_status(uuid, boolean, text), public.admin_moderate(text, uuid, boolean, text),
  public.admin_resolve_report(uuid, boolean), public.admin_set_payout(uuid, text, text, text)
  to authenticated;
