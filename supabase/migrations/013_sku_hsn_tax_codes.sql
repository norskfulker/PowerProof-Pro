-- SKU, HSN/SAC codes and GST rates: format checks, one SKU per product per store, and a
-- per-store list of the creator's own tax codes. Applied to the project as migration
-- "013_sku_hsn_tax_codes".

-- 1. Products: the format the app already enforces, now enforced by the database too
alter table public.products
  add constraint products_sku_check check (sku is null or sku ~ '^[A-Za-z0-9_-]{1,32}$'),
  add constraint products_hsn_sac_check check (hsn_sac is null or hsn_sac ~ '^[0-9]{4,8}$');

-- A SKU names one product in a store, ignoring case ("abc-1" and "ABC-1" are the same SKU)
create unique index products_store_sku_key on public.products (store_id, lower(sku)) where sku is not null;

-- 2. The creator's own HSN/SAC codes, with the GST rate that goes with each
create table public.tax_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4,8}$'),
  kind text not null check (kind in ('HSN', 'SAC')),
  description text not null default '' check (char_length(description) <= 120),
  rate_bps integer not null check (rate_bps between 0 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code, rate_bps)
);

create index tax_codes_store_idx on public.tax_codes (store_id);

create trigger tax_codes_set_updated_at before update on public.tax_codes
  for each row execute function public.set_updated_at();

alter table public.tax_codes enable row level security;

-- Only the store's owner can read or change its codes
create policy tax_codes_owner on public.tax_codes
  for all to authenticated
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

revoke all on public.tax_codes from anon, public;
grant select, insert, update, delete on public.tax_codes to authenticated;
