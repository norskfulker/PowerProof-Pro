-- 031: unpublished page work is private to the store owner.
--   custom_pages.layout is readable by anyone once a page is published, so it now holds only what
--   buyers see (template, published version, publish time, SEO). The working draft, version history
--   and the home page's unpublished theme settings move to custom_page_drafts, which only the
--   owner (and admins, read-only) can see.
--   Existing drafts are copied across; the app strips them from layout the next time a page saves,
--   and the last statement here strips any left over.

create table public.custom_page_drafts (
  page_id uuid primary key references public.custom_pages(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index custom_page_drafts_store_idx on public.custom_page_drafts (store_id);
alter table public.custom_page_drafts enable row level security;

create policy custom_page_drafts_owner on public.custom_page_drafts for all to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy custom_page_drafts_admin_read on public.custom_page_drafts for select to authenticated using (public.is_admin());
grant select, insert, update, delete on public.custom_page_drafts to authenticated;

-- Copy every page's private part across
insert into public.custom_page_drafts (page_id, store_id, data)
select c.id, c.store_id,
       jsonb_strip_nulls(jsonb_build_object(
         'sections', coalesce(c.layout->'sections', c.layout->'draft'->'blocks'),
         'style', coalesce(c.layout->'style', c.layout->'draft'->'style'),
         'focus', coalesce(c.layout->'focus', c.layout->'draft'->'focus'),
         'versions', c.layout->'versions',
         'site', c.layout->'site'))
from public.custom_pages c
on conflict (page_id) do nothing;

-- ...and take it out of the public column
update public.custom_pages
   set layout = layout - 'sections' - 'style' - 'focus' - 'versions' - 'site' - 'draft'
 where layout ?| array['sections', 'style', 'focus', 'versions', 'site', 'draft'];

-- The store's home page (slug "home", made by the editor) is not one of the plan's pages: it
-- doesn't count toward the limit, and it can always be made.
create or replace function public.enforce_page_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int; cnt int; owner uuid;
begin
  if new.slug = 'home' then return new; end if;
  select s.owner_id into owner from public.stores s where s.id = new.store_id;
  select l.max_pages into lim from public.plan_limits l join public.profiles p on p.plan = l.plan where p.id = owner;
  if lim is not null then
    select count(*) into cnt from public.custom_pages cp join public.stores s on s.id = cp.store_id where s.owner_id = owner and cp.slug <> 'home';
    if cnt >= lim then raise exception 'plan_limit_pages' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
