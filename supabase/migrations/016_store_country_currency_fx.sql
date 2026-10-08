-- 016: a store's country decides its currency; prices are set in that currency.
-- fx_rates holds the rates used to show prices to buyers in another currency (display only).

alter table public.stores
  add column if not exists country text not null default 'IN';

alter table public.stores
  add constraint stores_country_check check (country ~ '^[A-Z]{2}$'),
  add constraint stores_currency_check check (currency_base in ('INR','USD','EUR','GBP','AED','SGD','AUD','CAD'));

grant select (country) on public.stores to anon, authenticated;
grant insert (country) on public.stores to authenticated;
grant update (country) on public.stores to authenticated;

-- Every product is priced in its store's currency, whatever the client sends
create or replace function public.products_use_store_currency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select currency_base into new.currency from public.stores where id = new.store_id;
  return new;
end $$;

drop trigger if exists trg_products_currency on public.products;
create trigger trg_products_currency before insert or update of store_id, currency on public.products
  for each row execute function public.products_use_store_currency();

-- Country and currency are chosen once. Changing them under live prices would reprice the catalogue.
create or replace function public.lock_store_currency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.currency_base is distinct from old.currency_base or new.country is distinct from old.country)
     and not public.is_admin()
     and exists (select 1 from public.products where store_id = old.id) then
    raise exception 'store_currency_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_store_currency_lock on public.stores;
create trigger trg_store_currency_lock before update of currency_base, country on public.stores
  for each row execute function public.lock_store_currency();

-- Rates for showing a price in another currency: units of the currency per 1 US dollar.
create table if not exists public.fx_rates (
  currency text primary key check (currency in ('INR','USD','EUR','GBP','AED','SGD','AUD','CAD')),
  per_usd numeric not null check (per_usd > 0),
  updated_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy fx_rates_read on public.fx_rates for select using (true);
create policy fx_rates_admin_write on public.fx_rates for all using (public.is_admin()) with check (public.is_admin());
grant select on public.fx_rates to anon, authenticated;
