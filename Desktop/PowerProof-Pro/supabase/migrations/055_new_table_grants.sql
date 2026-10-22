-- 055: table grants for the tables added in 051 and 053
--
-- This project gives new tables no grants by default, so signed-in users need them spelled out.
-- Row-level security still decides which rows (the store's orders-and-customers area).
--   order_events      read only (notes go through add_order_note; the log is written by triggers)
--   customer_profiles read and write notes and tags (unsubscribed_at is guarded by its trigger)
--   customer_segments read, add and delete saved views
--   email_sends       read only (the server records each send)

grant select on public.order_events to authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert, delete on public.customer_segments to authenticated;
grant select on public.email_sends to authenticated;
