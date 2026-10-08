-- 020: the marketplace lives inside the creator app, so only signed-in users can read it.
revoke execute on function public.marketplace_deals(text, text, text, text, bigint, bigint, text, text, integer, integer) from anon;
grant execute on function public.marketplace_deals(text, text, text, text, bigint, bigint, text, text, integer, integer) to authenticated;
