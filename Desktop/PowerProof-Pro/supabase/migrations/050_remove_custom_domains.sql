-- 050: custom domains removed
--
-- Stores live at their PowerProof address only (/s/<store>). Removes the domains table (empty when
-- this ran), the lookups the router used (resolve_domain, primary_domain), the Pro-plan trigger
-- that guarded it, its status type, the plan_limits.custom_domain flag, and the domain column of
-- admin_stores.

drop function if exists public.resolve_domain(text);
drop function if exists public.primary_domain(text);
drop table if exists public.domains cascade;
drop function if exists public.enforce_domain_plan() cascade;
drop type if exists public.domain_status;
alter table public.plan_limits drop column if exists custom_domain;

-- The founder console's stores list, as before but without the domain
drop function if exists public.admin_stores(text, integer);
create function public.admin_stores(p_q text default null, p_limit integer default 300)
returns table(id uuid, slug text, name text, status text, owner_id uuid, owner_email text, owner_name text, currency text, country text, created_at timestamptz, products bigint, orders bigint, gross bigint)
language plpgsql stable security definer set search_path = '' as $$
declare q text := case when nullif(trim(coalesce(p_q, '')), '') is null then null else '%' || replace(replace(trim(p_q), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select s.id, s.slug::text, s.name, s.status::text, s.owner_id, pr.email::text, pr.full_name, s.currency_base::text, s.country, s.created_at,
      (select count(*) from public.products p where p.store_id = s.id),
      (select count(*) from public.orders o where o.store_id = s.id and o.status = 'paid'),
      coalesce((select sum(o.total_minor) from public.orders o where o.store_id = s.id and o.status = 'paid' and o.currency::text = s.currency_base::text), 0)::bigint
    from public.stores s left join public.profiles pr on pr.id = s.owner_id
    where q is null or s.name ilike q or s.slug::text ilike q or pr.email::text ilike q
    order by s.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function public.admin_stores(text, integer) from public, anon;
grant execute on function public.admin_stores(text, integer) to authenticated;
