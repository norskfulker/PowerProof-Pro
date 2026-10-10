-- A store's link comes from its name when it is created and stays that way: only PowerProof staff
-- can change it. Applied to the project as migration "015_store_slug_locked".
create or replace function public.lock_store_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug is distinct from old.slug and not public.is_admin() then
    raise exception 'store_slug_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_store_slug_locked before update of slug on public.stores
  for each row execute function public.lock_store_slug();
