-- Page views were never recorded: the storefront called track_event without p_product, and the
-- API only matches a function when every argument is there, so each call failed (PGRST202).
-- The storefront now sends p_product: null; this overload also takes calls without it, so tabs
-- still running the old script are counted too.

create or replace function public.track_event(p_store_slug text, p_kind text, p_path text, p_source text, p_session text)
returns void language sql security definer set search_path = '' as $$
  select public.track_event(p_store_slug, p_kind, p_path, null::uuid, p_source, p_session);
$$;
revoke all on function public.track_event(text, text, text, text, text) from public;
grant execute on function public.track_event(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
