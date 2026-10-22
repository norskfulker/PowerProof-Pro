-- 056: a store can sell digital and physical products at the same time.
--   * stores.sells gains 'both'. 'digital' and 'physical' still mean only that kind.
--   * A product saved (not archived) must be a kind the store has switched on.
--   * Switching a kind off needs that kind's active products archived first (as before).

alter table public.stores drop constraint if exists stores_sells_check;
alter table public.stores add constraint stores_sells_check check (sells in ('digital', 'physical', 'both'));

create or replace function public.guard_product_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_sells text;
begin
  if new.status = 'archived' then return new; end if;
  if tg_op = 'UPDATE' and new.fulfilment = old.fulfilment and new.status = old.status and new.store_id = old.store_id then return new; end if;
  select sells into v_sells from public.stores where id = new.store_id;
  if v_sells = 'both' then return new; end if;
  if v_sells is distinct from new.fulfilment then
    raise exception 'store_sells_%', coalesce(v_sells, 'digital') using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.guard_store_sells() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sells is distinct from old.sells and new.sells <> 'both' and exists (
    select 1 from public.products p where p.store_id = new.id and p.status <> 'archived' and p.fulfilment <> new.sells
  ) then
    raise exception 'sells_has_products' using errcode = 'P0001';
  end if;
  return new;
end $$;
