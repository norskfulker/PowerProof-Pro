-- Orders can be cancelled (an online order not paid within an hour, see 066). On its own because
-- Postgres can't use a new enum value in the transaction that adds it.
alter type public.order_status add value if not exists 'cancelled';
