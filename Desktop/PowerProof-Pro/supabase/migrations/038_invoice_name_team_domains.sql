-- 038: the name on invoices and receipts, store teams, and the last pieces of custom domains.
--
-- 1. stores.invoice_name: the seller name buyers see at checkout, on the receipt email and on the
--    invoice. GST, legal name and address stay optional, so a seller who isn't registered can sell.
-- 2. Teams: store_members (invited by email, then accepted by the person signed in with that
--    email). Access is by area. store_can(store, area) replaces is_store_owner() in every policy
--    that guards store data; is_store_owner() itself stays owner-only (payouts use it).
--    Payouts, payout accounts, billing, deleting the store and making admins stay with the owner.
-- 3. Domains: primary_domain() so the free address can send visitors to the store's own domain.

/* 1. Invoice name --------------------------------------------------------------- */

alter table public.stores add column if not exists invoice_name text
  check (invoice_name is null or char_length(btrim(invoice_name)) between 2 and 120);
-- stores uses column grants: buyers may read the name (it's shown at checkout), creators write it
grant select (invoice_name) on public.stores to anon, authenticated;
grant insert (invoice_name), update (invoice_name) on public.stores to authenticated;

-- The buyer's order and invoice carry it
create or replace function public.get_order(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
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
    'store', jsonb_build_object('invoiceName', s.invoice_name, 'legalName', s.legal_name, 'gstin', s.gstin, 'pan', s.pan, 'address', s.company_address, 'invoicePrefix', s.invoice_prefix, 'invoiceFooter', s.invoice_footer)
  );
end $function$;

/* 2. Teams ------------------------------------------------------------------------ */

-- How many people (invited or joined, not counting the owner) a store can have. null = no limit.
alter table public.plan_limits add column if not exists team_seats integer check (team_seats is null or team_seats >= 0);
update public.plan_limits set team_seats = case when plan = 'pro' then 10 else 2 end where team_seats is null;

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references public.profiles(id) on delete cascade,
  -- admin: every area and can invite (but not other admins); member: only `areas`
  role text not null default 'member' check (role in ('admin', 'member')),
  areas text[] not null default '{}' check (areas <@ array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business']::text[]),
  status text not null default 'invited' check (status in ('invited', 'active')),
  token_hash text,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, email)
);
create unique index if not exists store_members_store_user on public.store_members (store_id, user_id) where user_id is not null;
create index if not exists store_members_user on public.store_members (user_id);
create index if not exists store_members_invited_by on public.store_members (invited_by);
create unique index if not exists store_members_token on public.store_members (token_hash) where token_hash is not null;
drop trigger if exists store_members_updated on public.store_members;
create trigger store_members_updated before update on public.store_members for each row execute function public.set_updated_at();

alter table public.store_members enable row level security;
-- Reads only; every change goes through the team_* functions below
revoke all on public.store_members from anon, authenticated;
grant select (id, store_id, email, user_id, role, areas, status, invited_at, expires_at, accepted_at, created_at) on public.store_members to authenticated;
drop policy if exists store_members_read on public.store_members;
create policy store_members_read on public.store_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_store_owner(store_id) or public.is_admin());

/**
 * Whether the signed-in person may work on this part of the store. The owner may do everything;
 * a joined admin every area plus 'team'; a member the areas they were given. 'any' = any access.
 */
create or replace function public.store_can(p_store uuid, p_area text default 'any')
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.stores s where s.id = p_store and s.owner_id = (select auth.uid()))
      or exists (select 1 from public.store_members m
                  where m.store_id = p_store and m.user_id = (select auth.uid()) and m.status = 'active'
                    and (p_area = 'any' or m.role = 'admin' or p_area = any (m.areas)))
$function$;

-- Products and everything hanging off them belong to the catalog area
create or replace function public.is_product_owner(p_product uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.products p where p.id = p_product and public.store_can(p.store_id, 'catalog'))
$function$;

/** Which storage area a store's file belongs to */
create or replace function public.store_can_files(p_bucket text, p_store uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case p_bucket
    when 'product-files' then public.store_can(p_store, 'catalog')
    when 'invoices' then public.store_can(p_store, 'orders')
    else public.store_can(p_store, 'catalog') or public.store_can(p_store, 'design')
  end
$function$;

-- Policies: same shape as before, owner check replaced by the area check
drop policy if exists collection_items_owner on public.collection_items;
create policy collection_items_owner on public.collection_items for all to authenticated
  using (public.is_product_owner(product_id) and exists (select 1 from public.collections c where c.id = collection_items.collection_id and public.store_can(c.store_id, 'catalog')))
  with check (public.is_product_owner(product_id) and exists (select 1 from public.collections c where c.id = collection_items.collection_id and public.store_can(c.store_id, 'catalog')));

drop policy if exists collections_owner on public.collections;
create policy collections_owner on public.collections for all to authenticated using (public.store_can(store_id, 'catalog')) with check (public.store_can(store_id, 'catalog'));

drop policy if exists coupons_owner on public.coupons;
create policy coupons_owner on public.coupons for all to authenticated using (public.store_can(store_id, 'marketing') or public.is_admin()) with check (public.store_can(store_id, 'marketing'));

drop policy if exists custom_page_drafts_owner on public.custom_page_drafts;
create policy custom_page_drafts_owner on public.custom_page_drafts for all to authenticated using (public.store_can(store_id, 'design')) with check (public.store_can(store_id, 'design'));

drop policy if exists custom_pages_auth_read on public.custom_pages;
create policy custom_pages_auth_read on public.custom_pages for select to authenticated
  using ((status = 'published'::public.page_status and public.store_is_public(store_id)) or public.store_can(store_id, 'design') or public.is_admin());
drop policy if exists custom_pages_owner_write on public.custom_pages;
create policy custom_pages_owner_write on public.custom_pages for all to authenticated using (public.store_can(store_id, 'design')) with check (public.store_can(store_id, 'design'));

drop policy if exists deal_rules_owner on public.deal_rules;
create policy deal_rules_owner on public.deal_rules for all to authenticated using (public.store_can(store_id, 'marketing') or public.is_admin()) with check (public.store_can(store_id, 'marketing'));

drop policy if exists disputes_read on public.disputes;
create policy disputes_read on public.disputes for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = disputes.order_id and public.store_can(o.store_id, 'orders')));

drop policy if exists domains_owner on public.domains;
create policy domains_owner on public.domains for all to authenticated using (public.store_can(store_id, 'design') or public.is_admin()) with check (public.store_can(store_id, 'design'));

drop policy if exists leads_owner_delete on public.leads;
create policy leads_owner_delete on public.leads for delete to authenticated using (public.store_can(store_id, 'orders'));
drop policy if exists leads_owner_read on public.leads;
create policy leads_owner_read on public.leads for select to authenticated using (public.store_can(store_id, 'orders') or public.is_admin());

drop policy if exists ledger_read on public.ledger_entries;
create policy ledger_read on public.ledger_entries for select to authenticated using (public.store_can(store_id, 'analytics') or public.is_admin());

drop policy if exists deals_owner_all on public.marketplace_deals;
create policy deals_owner_all on public.marketplace_deals for all to authenticated
  using (public.store_can(store_id, 'marketing') or public.is_admin())
  with check (public.store_can(store_id, 'marketing') and exists (select 1 from public.products p where p.id = marketplace_deals.product_id and p.store_id = marketplace_deals.store_id));

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and (public.store_can(o.store_id, 'orders') or public.is_admin())));

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated using (public.store_can(store_id, 'orders') or public.is_admin());

drop policy if exists products_owner on public.products;
create policy products_owner on public.products for all to authenticated using (public.store_can(store_id, 'catalog')) with check (public.store_can(store_id, 'catalog'));

-- Reviews and questions: answered from the store editor (design) or by whoever looks after orders
drop policy if exists questions_auth on public.questions;
create policy questions_auth on public.questions for select to authenticated
  using ((status = 'published'::public.moderation_status and public.store_is_public(store_id)) or public.store_can(store_id, 'design') or public.store_can(store_id, 'orders') or public.is_admin());
drop policy if exists questions_owner_answer on public.questions;
create policy questions_owner_answer on public.questions for update to authenticated
  using (public.store_can(store_id, 'design') or public.store_can(store_id, 'orders')) with check (public.store_can(store_id, 'design') or public.store_can(store_id, 'orders'));

drop policy if exists reviews_auth on public.reviews;
create policy reviews_auth on public.reviews for select to authenticated
  using ((status = 'published'::public.moderation_status and public.store_is_public(store_id)) or public.store_can(store_id, 'design') or public.store_can(store_id, 'orders') or public.is_admin());
drop policy if exists reviews_owner_reply on public.reviews;
create policy reviews_owner_reply on public.reviews for update to authenticated
  using (public.store_can(store_id, 'design') or public.store_can(store_id, 'orders')) with check (public.store_can(store_id, 'design') or public.store_can(store_id, 'orders'));

drop policy if exists refunds_read on public.refunds;
create policy refunds_read on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = refunds.order_id and (public.store_can(o.store_id, 'orders') or public.is_admin())));

drop policy if exists store_events_owner_read on public.store_events;
create policy store_events_owner_read on public.store_events for select to authenticated using (public.store_can(store_id, 'analytics') or public.is_admin());

drop policy if exists store_imports_owner_read on public.store_imports;
create policy store_imports_owner_read on public.store_imports for select to authenticated using (public.store_can(store_id, 'catalog'));

-- About, FAQ (design) and the policies, which store settings also edit (business)
drop policy if exists store_pages_owner on public.store_pages;
create policy store_pages_owner on public.store_pages for all to authenticated
  using (public.store_can(store_id, 'design') or public.store_can(store_id, 'business')) with check (public.store_can(store_id, 'design') or public.store_can(store_id, 'business'));

drop policy if exists tax_codes_owner on public.tax_codes;
create policy tax_codes_owner on public.tax_codes for all to authenticated
  using (public.store_can(store_id, 'catalog') or public.store_can(store_id, 'business')) with check (public.store_can(store_id, 'catalog') or public.store_can(store_id, 'business'));

drop policy if exists ai_generations_read on public.ai_generations;
create policy ai_generations_read on public.ai_generations for select to authenticated
  using (owner_id = (select auth.uid()) or (store_id is not null and public.store_can(store_id, 'design')) or public.is_admin());

-- Team members read the stores they work on and change only their areas' columns (trigger below)
drop policy if exists stores_member_read on public.stores;
create policy stores_member_read on public.stores for select to authenticated using (public.store_can(id, 'any'));
drop policy if exists stores_member_update on public.stores;
create policy stores_member_update on public.stores for update to authenticated
  using ((public.store_can(id, 'design') or public.store_can(id, 'business')) and status <> 'suspended'::public.store_status)
  with check ((public.store_can(id, 'design') or public.store_can(id, 'business')) and status <> 'suspended'::public.store_status);

create or replace function public.guard_store_member_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  design text[] := array['name', 'tagline', 'logo_url', 'theme', 'theme_mode', 'brand_color', 'status'];
  business text[] := array['support_email', 'refund_days', 'legal_name', 'invoice_name', 'company_address', 'gstin', 'pan', 'business_type', 'invoice_prefix', 'invoice_footer', 'shipping'];
begin
  -- The owner, PowerProof staff and the server are not limited here
  if uid is null or old.owner_id = uid or public.is_admin() then return new; end if;
  if exists (
    select 1 from jsonb_each(to_jsonb(new)) n
     where n.key <> 'updated_at' and n.value is distinct from (to_jsonb(old) -> n.key)
       and not ((n.key = any (design) and public.store_can(old.id, 'design')) or (n.key = any (business) and public.store_can(old.id, 'business')))
  ) then
    raise exception 'not_allowed_for_member' using errcode = '42501';
  end if;
  return new;
end $function$;
drop trigger if exists trg_store_member_guard on public.stores;
create trigger trg_store_member_guard before update on public.stores for each row execute function public.guard_store_member_update();

-- Storage: the same four policies, by area
drop policy if exists "owner read own store files" on storage.objects;
create policy "owner read own store files" on storage.objects for select to authenticated
  using (bucket_id = any (array['store-media', 'ai-images', 'product-files', 'invoices']) and public.store_can_files(bucket_id, public.storage_store_id(name)));
drop policy if exists "owner upload own store files" on storage.objects;
create policy "owner upload own store files" on storage.objects for insert to authenticated
  with check (bucket_id = any (array['store-media', 'ai-images', 'product-files']) and public.store_can_files(bucket_id, public.storage_store_id(name)));
drop policy if exists "owner update own store files" on storage.objects;
create policy "owner update own store files" on storage.objects for update to authenticated
  using (bucket_id = any (array['store-media', 'ai-images', 'product-files']) and public.store_can_files(bucket_id, public.storage_store_id(name)))
  with check (bucket_id = any (array['store-media', 'ai-images', 'product-files']) and public.store_can_files(bucket_id, public.storage_store_id(name)));
drop policy if exists "owner delete own store files" on storage.objects;
create policy "owner delete own store files" on storage.objects for delete to authenticated
  using (bucket_id = any (array['store-media', 'ai-images', 'product-files']) and public.store_can_files(bucket_id, public.storage_store_id(name)));

-- Functions that checked ownership now check the area
create or replace function public.analytics_visits(p_store uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare out jsonb;
begin
  if not (public.store_can(p_store, 'analytics') or public.is_admin()) then raise exception 'not_allowed'; end if;
  select jsonb_build_object(
    'visitors', (select count(distinct session) from public.store_events where store_id = p_store and created_at >= p_from and created_at < p_to),
    'viewers', (select count(distinct session) from public.store_events where store_id = p_store and kind = 'product' and created_at >= p_from and created_at < p_to),
    'started', (select count(*) from public.orders where store_id = p_store and created_at >= p_from and created_at < p_to),
    'paid', (select count(*) from public.orders where store_id = p_store and status = 'paid' and created_at >= p_from and created_at < p_to),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'visitors', n) order by d) from (
        select (created_at at time zone 'Asia/Kolkata')::date d, count(distinct session) n from public.store_events
        where store_id = p_store and created_at >= p_from and created_at < p_to group by 1) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'visitors', n) order by n desc) from (
        select source, count(distinct session) n from public.store_events
        where store_id = p_store and created_at >= p_from and created_at < p_to group by 1 order by 2 desc limit 8) y), '[]'::jsonb)
  ) into out;
  return out;
end $function$;

create or replace function public.set_order_fulfilment(p_order uuid, p_status text, p_carrier text default null::text, p_number text default null::text, p_url text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.store_can(o.store_id, 'orders') then raise exception 'order_not_found'; end if;
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
end $function$;

create or replace function public.settle_cod(p_order uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare o public.orders%rowtype; v_bps int; v_platform bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.store_can(o.store_id, 'orders') then raise exception 'order_not_found'; end if;
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
end $function$;

-- AI pages count against the store owner's daily allowance, whoever on the team runs them
create or replace function public.start_ai_page(p_store uuid, p_prompt text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); v_owner uuid; lim int; used int; gid uuid;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  if not public.store_can(p_store, 'design') then raise exception 'not_your_store' using errcode = '42501'; end if;
  select s.owner_id into v_owner from public.stores s where s.id = p_store;
  perform pg_advisory_xact_lock(hashtext('ai_page:' || v_owner::text));
  select coalesce(l.ai_pages_daily, 0) into lim from public.profiles p left join public.plan_limits l on l.plan = p.plan where p.id = v_owner;
  used := public.ai_pages_used_today(v_owner);
  if used >= lim then raise exception 'ai_daily_limit' using errcode = 'P0001'; end if;
  insert into public.ai_generations (owner_id, store_id, prompt, status, credits_used, kind)
  values (v_owner, p_store, left(coalesce(p_prompt, ''), 4000), 'running', 1, 'page')
  returning id into gid;
  return gid;
end $function$;

create or replace function public.finish_ai_page(p_id uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if p_status not in ('done', 'failed') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.ai_generations set status = p_status
   where id = p_id and kind = 'page' and (owner_id = auth.uid() or (store_id is not null and public.store_can(store_id, 'design')));
end $function$;

/** The stores the signed-in person can open: their own, then the ones they joined */
create or replace function public.my_stores()
 returns table (id uuid, name text, slug text, brand_color text, created_at timestamptz, role text, areas text[], owner_plan text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select t.id, t.name, t.slug, t.brand_color, t.created_at, t.role, t.areas, t.owner_plan from (
    select s.id, s.name, s.slug::text as slug, s.brand_color, s.created_at, 'owner'::text as role,
           array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business']::text[] as areas, p.plan::text as owner_plan
      from public.stores s join public.profiles p on p.id = s.owner_id
     where s.owner_id = (select auth.uid())
    union all
    select s.id, s.name, s.slug::text, s.brand_color, coalesce(m.accepted_at, m.created_at), m.role,
           case when m.role = 'admin' then array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business']::text[] else m.areas end, p.plan::text
      from public.store_members m join public.stores s on s.id = m.store_id join public.profiles p on p.id = s.owner_id
     where m.user_id = (select auth.uid()) and m.status = 'active' and s.owner_id <> m.user_id
  ) t
  order by (t.role = 'owner') desc, t.created_at
$function$;

/** Everyone on a store's team, owner first. For the owner and admins. */
create or replace function public.team_list(p_store uuid)
 returns table (id uuid, email text, name text, role text, areas text[], status text, invited_at timestamptz, expires_at timestamptz, accepted_at timestamptz, last_seen_at timestamptz, is_you boolean)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not public.store_can(p_store, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select t.mid, t.memail, t.mname, t.mrole, t.mareas, t.mstatus, t.minvited, t.mexpires, t.maccepted, t.mseen, t.myou from (
      select null::uuid as mid, p.email::text as memail, p.full_name as mname, 'owner'::text as mrole, '{}'::text[] as mareas, 'active'::text as mstatus,
             s.created_at as minvited, null::timestamptz as mexpires, s.created_at as maccepted, p.last_seen_at as mseen, p.id = (select auth.uid()) as myou
        from public.stores s join public.profiles p on p.id = s.owner_id where s.id = p_store
      union all
      select m.id, m.email::text, p.full_name, m.role, m.areas, m.status, m.invited_at, m.expires_at, m.accepted_at, p.last_seen_at, coalesce(m.user_id = (select auth.uid()), false)
        from public.store_members m left join public.profiles p on p.id = m.user_id
       where m.store_id = p_store
    ) t
    order by (t.mrole = 'owner') desc, t.mstatus, t.minvited;
end $function$;

/** Invites someone by email (or sends a fresh link to someone already invited). Returns the link's secret once. */
create or replace function public.team_invite(p_store uuid, p_email text, p_role text, p_areas text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid(); v_owner uuid; v_email text := lower(btrim(coalesce(p_email, ''))); v_seats int; v_used int;
  v_token text; v_id uuid; v_areas text[]; m public.store_members%rowtype;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  if not public.store_can(p_store, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role' using errcode = '22023'; end if;
  select s.owner_id into v_owner from public.stores s where s.id = p_store;
  if p_role = 'admin' and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  v_areas := array(select distinct a from unnest(coalesce(p_areas, '{}')) a where a = any (array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business']) order by a);
  if p_role = 'member' and coalesce(array_length(v_areas, 1), 0) = 0 then raise exception 'no_areas' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'bad_email' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles p where p.id = v_owner and lower(p.email::text) = v_email) then raise exception 'is_owner' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('team:' || p_store::text, 0));
  select * into m from public.store_members where store_id = p_store and email = v_email::extensions.citext;
  if found then
    if m.status = 'active' then raise exception 'already_member' using errcode = '23505'; end if;
    if m.role = 'admin' and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  else
    select l.team_seats into v_seats from public.profiles p join public.plan_limits l on l.plan = p.plan where p.id = v_owner;
    select count(*) into v_used from public.store_members where store_id = p_store;
    if v_seats is not null and v_used >= v_seats then raise exception 'plan_limit_team' using errcode = 'P0001'; end if;
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.store_members (store_id, email, role, areas, status, token_hash, invited_by, invited_at, expires_at)
  values (p_store, v_email, p_role, case when p_role = 'admin' then '{}'::text[] else v_areas end, 'invited',
          encode(extensions.digest(v_token, 'sha256'), 'hex'), uid, now(), now() + interval '7 days')
  on conflict (store_id, email) do update
    set role = excluded.role, areas = excluded.areas, token_hash = excluded.token_hash, invited_by = excluded.invited_by,
        invited_at = excluded.invited_at, expires_at = excluded.expires_at
  returning store_members.id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email);
end $function$;

/** What an invite link is for, so the page can say it before anyone signs in. No secrets. */
create or replace function public.team_invite_info(p_token text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'storeName', s.name, 'inviter', coalesce(nullif(ip.full_name, ''), 'The store owner'), 'email', m.email::text,
    'role', m.role, 'areas', to_jsonb(m.areas), 'expired', m.expires_at < now())
    from public.store_members m join public.stores s on s.id = m.store_id left join public.profiles ip on ip.id = m.invited_by
   where m.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and m.status = 'invited'
$function$;

/** Joins the store. Only the person signed in with the invited email can. Returns the store. */
create or replace function public.team_accept(p_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); v_email text; m public.store_members%rowtype;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  select * into m from public.store_members where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  if m.expires_at < now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  select lower(p.email::text) into v_email from public.profiles p where p.id = uid;
  if v_email is distinct from lower(m.email::text) then raise exception 'wrong_account' using errcode = '42501'; end if;
  if exists (select 1 from public.stores s where s.id = m.store_id and s.owner_id = uid) then raise exception 'is_owner' using errcode = '22023'; end if;
  update public.store_members set user_id = uid, status = 'active', accepted_at = now(), token_hash = null, expires_at = null where id = m.id;
  return m.store_id;
end $function$;

/** Changes what someone can do. Admins can change members; only the owner can make or change admins. */
create or replace function public.team_update(p_member uuid, p_role text, p_areas text[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); m public.store_members%rowtype; v_owner uuid; v_areas text[];
begin
  select * into m from public.store_members where id = p_member for update;
  if not found or not public.store_can(m.store_id, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
  select s.owner_id into v_owner from public.stores s where s.id = m.store_id;
  if p_role not in ('admin', 'member') then raise exception 'bad_role' using errcode = '22023'; end if;
  if (m.role = 'admin' or p_role = 'admin' or m.user_id = uid) and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  v_areas := array(select distinct a from unnest(coalesce(p_areas, '{}')) a where a = any (array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business']) order by a);
  if p_role = 'member' and coalesce(array_length(v_areas, 1), 0) = 0 then raise exception 'no_areas' using errcode = '22023'; end if;
  update public.store_members set role = p_role, areas = case when p_role = 'admin' then '{}'::text[] else v_areas end where id = m.id;
end $function$;

/** Removes someone or cancels their invite. Anyone can leave a store they joined. */
create or replace function public.team_remove(p_member uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); m public.store_members%rowtype; v_owner uuid;
begin
  select * into m from public.store_members where id = p_member for update;
  if not found then return; end if;
  if m.user_id is distinct from uid then
    if not public.store_can(m.store_id, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
    select s.owner_id into v_owner from public.stores s where s.id = m.store_id;
    if m.role = 'admin' and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  end if;
  delete from public.store_members where id = m.id;
end $function$;

/* 3. Domains ---------------------------------------------------------------------- */

/** The store's own live domain, when it should be the address buyers see (so the free address can redirect there) */
create or replace function public.primary_domain(p_slug text)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select d.hostname::text from public.domains d join public.stores s on s.id = d.store_id
   where s.slug = lower(p_slug)::extensions.citext and s.status = 'published' and d.status = 'active' and d.is_primary
$function$;

/* Who may call what -------------------------------------------------------------- */

revoke execute on function public.store_can(uuid, text), public.store_can_files(text, uuid), public.my_stores(), public.team_list(uuid),
  public.team_invite(uuid, text, text, text[]), public.team_accept(text), public.team_update(uuid, text, text[]), public.team_remove(uuid),
  public.guard_store_member_update() from public, anon;
grant execute on function public.store_can(uuid, text), public.store_can_files(text, uuid), public.my_stores(), public.team_list(uuid),
  public.team_invite(uuid, text, text, text[]), public.team_accept(text), public.team_update(uuid, text, text[]), public.team_remove(uuid) to authenticated;
grant execute on function public.team_invite_info(text), public.primary_domain(text) to anon, authenticated;

-- Trigger functions are not called directly
revoke execute on function public.guard_store_member_update() from authenticated;
