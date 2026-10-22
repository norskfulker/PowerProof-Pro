-- 047: how an email signs in, so login can say "this email uses Google" and offer to add a
-- password to that same account. Only the server (service role) may ask; it is rate limited there.

create or replace function public.auth_methods(p_email text)
returns table (out_exists boolean, out_google boolean, out_password boolean)
language sql stable security definer set search_path = '' as $$
  select
    count(u.id) > 0,
    coalesce(bool_or(exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')), false),
    coalesce(bool_or(coalesce(u.encrypted_password, '') <> ''), false)
  from auth.users u
  where lower(u.email) = lower(trim(p_email)) and u.deleted_at is null;
$$;

revoke all on function public.auth_methods(text) from public, anon, authenticated;
grant execute on function public.auth_methods(text) to service_role;
