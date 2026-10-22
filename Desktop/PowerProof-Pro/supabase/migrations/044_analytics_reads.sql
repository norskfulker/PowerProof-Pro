-- 044: what the Analytics page reads. The store's team sees when a checkout reminder went out, so
-- it can count abandoned checkouts that were reminded and later recovered.
grant select (reminded_at) on public.orders to authenticated;

-- creator_orders (042) shows the buyer's state for GST, but the column itself was never granted,
-- so the view (security invoker) refused every read: the Orders page couldn't load.
grant select (buyer_state) on public.orders to authenticated;
