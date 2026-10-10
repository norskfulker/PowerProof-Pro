-- 034: cash on delivery. A COD order is placed (stock taken, waiting to ship) but not paid until the
-- creator collects the cash. Its own migration: a new enum value can't be used in the transaction
-- that adds it.
alter type public.order_status add value if not exists 'cod' after 'pending';
