-- 036: importing a store. A creator brings their own store from Shopify, WooCommerce, Amazon (their
-- seller report), Gumroad or their own website, or copies someone else's with the owner's approval.
--   * store_imports: each import, and how ownership was shown (the proof is kept)
--   * import_connections: a source's access token for the minutes an import takes (server only)
--   * copy_requests: asking a store's owner to approve a copy; approved ones can be imported
--   * orders.imported_from / import_ref: past orders brought in as history. Paid elsewhere, so no
--     money moves here: no ledger entries, no invoice from PowerProof, nothing to download.
--   * import_history(): writes those orders and their lines (server only)

create table public.store_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  source text not null check (source in ('shopify', 'woocommerce', 'website', 'amazon', 'gumroad', 'etsy')),
  -- The shop's domain or the site's address, for the creator's list
  source_label text not null check (char_length(source_label) between 1 and 300),
  status text not null default 'previewed' check (status in ('previewed', 'importing', 'done', 'failed')),
  -- { method: oauth | api_key | meta_tag | dns | seller_report | owner_approval, detail }
  proof jsonb not null default '{}'::jsonb check (jsonb_typeof(proof) = 'object'),
  counts jsonb not null default '{}'::jsonb check (jsonb_typeof(counts) = 'object'),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index store_imports_store_idx on public.store_imports (store_id, created_at desc);
alter table public.store_imports enable row level security;
create policy store_imports_owner_read on public.store_imports for select to authenticated using (public.is_store_owner(store_id));
grant select on public.store_imports to authenticated;

-- Never readable from a browser: no policies, no grants
create table public.import_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  source text not null check (source in ('shopify')),
  shop text not null check (char_length(shop) <= 255),
  secret text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);
alter table public.import_connections enable row level security;
revoke all on public.import_connections from public, anon, authenticated;

create table public.copy_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 500),
  host text not null check (char_length(host) between 3 and 255),
  -- Found on the owner's own site, never typed by the requester
  owner_email extensions.citext not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  message text check (message is null or char_length(message) <= 600),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days'
);
create index copy_requests_store_host_idx on public.copy_requests (store_id, host);
alter table public.copy_requests enable row level security;
create policy copy_requests_owner_read on public.copy_requests for select to authenticated using (public.is_store_owner(store_id));
grant select (id, store_id, source_url, host, owner_email, status, message, created_at, decided_at, expires_at) on public.copy_requests to authenticated;

/* Past orders as history ------------------------------------------------------------------- */

alter table public.orders
  add column imported_from text check (imported_from is null or imported_from in ('shopify', 'woocommerce', 'website', 'amazon', 'gumroad', 'etsy')),
  add column import_ref text check (import_ref is null or char_length(import_ref) <= 120);
create unique index orders_import_ref_idx on public.orders (store_id, import_ref) where import_ref is not null;
grant select (imported_from) on public.orders to authenticated;

create or replace view public.creator_orders with (security_invoker = true) as
  select id, ref, store_id, buyer_name, buyer_email, buyer_country, currency, subtotal_minor, discount_minor, tax_minor, total_minor,
         deals_applied, status, paid_at, available_at, invoice_no, created_at,
         payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status, tracking, shipped_at, delivered_at, imported_from
    from public.orders;

-- Writes imported orders (already paid elsewhere). An order already imported is skipped, so running
-- the same import twice is safe. Returns how many were added.
-- p_orders: [{ ref, name, email, country, currency, total, shipping, placed_at, lines: [{ title, quantity, unit, total, product_id }] }]
create or replace function public.import_history(p_store uuid, p_source text, p_orders jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare o jsonb; l jsonb; oid uuid; n integer := 0; v_ref text; v_total bigint; v_currency text;
begin
  select currency_base into v_currency from public.stores where id = p_store;
  if v_currency is null then raise exception 'store_not_found'; end if;
  for o in select * from jsonb_array_elements(p_orders) limit 5000 loop
    v_ref := left(coalesce(o->>'ref', ''), 100);
    if v_ref = '' or coalesce(o->>'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then continue; end if;
    -- Only orders in the store's own currency: the books are kept in it
    if coalesce(o->>'currency', v_currency) <> v_currency then continue; end if;
    v_total := greatest(0, coalesce((o->>'total')::bigint, 0));
    begin
      insert into public.orders (ref, store_id, buyer_name, buyer_email, buyer_phone, buyer_country, consent_at, currency,
        subtotal_minor, discount_minor, tax_minor, total_minor, deals_applied, gateway, status, paid_at, created_at,
        shipping_minor, imported_from, import_ref)
      values ('IMP-' || upper(left(encode(extensions.digest(p_store::text || p_source || v_ref, 'sha256'), 'hex'), 12)), p_store,
        left(coalesce(nullif(trim(o->>'name'), ''), split_part(o->>'email', '@', 1)), 120), lower(trim(o->>'email')), '', nullif(upper(left(o->>'country', 2)), ''),
        coalesce((o->>'placed_at')::timestamptz, now()), v_currency,
        v_total, 0, 0, v_total, '[]'::jsonb, 'import', 'paid', coalesce((o->>'placed_at')::timestamptz, now()), coalesce((o->>'placed_at')::timestamptz, now()),
        greatest(0, coalesce((o->>'shipping')::bigint, 0)), p_source, p_source || ':' || v_ref)
      returning id into oid;
    exception when unique_violation then
      continue;
    end;
    for l in select * from jsonb_array_elements(coalesce(o->'lines', '[]'::jsonb)) limit 100 loop
      insert into public.order_items (order_id, product_id, title, unit_price_minor, quantity, discount_minor, line_total_minor, tax_rate_bps, is_gift, fulfilment)
      values (oid,
        (select p.id from public.products p where p.id = nullif(l->>'product_id', '')::uuid and p.store_id = p_store),
        left(coalesce(nullif(trim(l->>'title'), ''), 'Item'), 160), greatest(0, coalesce((l->>'unit')::bigint, 0)), greatest(1, coalesce((l->>'quantity')::int, 1)), 0,
        greatest(0, coalesce((l->>'total')::bigint, 0)), 0, false, case when l->>'physical' = 'true' then 'physical' else 'digital' end);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.import_history(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_history(uuid, text, jsonb) to service_role;
