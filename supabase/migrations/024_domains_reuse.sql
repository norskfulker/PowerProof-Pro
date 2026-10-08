-- 024: custom domains use the existing `domains` table (hostname, status, verify_token, error,
-- last_checked_at) and `resolve_domain()`, which the project already had. An earlier draft added a
-- second table for the same job; it is removed again. Rows are written by the server only; creators
-- read and delete their own (existing policy and grants). The Pro-plan check is the existing
-- enforce_domain_plan trigger.
drop function if exists public.store_for_domain(text);
drop table if exists public.store_domains;
grant execute on function public.resolve_domain(text) to anon, authenticated;
