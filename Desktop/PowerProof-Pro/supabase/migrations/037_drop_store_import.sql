-- 037: removes what only the old "Import a store" flow used (Shopify sign-in, owner approval of a
-- copy, past orders brought in as history). Products now come in from a link on the Products page,
-- which keeps using store_imports to record each link read and what the creator confirmed.
-- All of these were empty when this was written.

-- The orders view, without imported_from (a view can't lose a column in place)
drop view public.creator_orders;
create view public.creator_orders with (security_invoker = true) as
  select id, ref, store_id, buyer_name, buyer_email, buyer_country, currency,
         subtotal_minor, discount_minor, tax_minor, total_minor,
         deals_applied, status, paid_at, available_at, invoice_no, created_at,
         payment_method, shipping_minor, cod_fee_minor, ship_to, fulfilment_status, tracking, shipped_at, delivered_at
  from public.orders;
grant select on public.creator_orders to authenticated;

drop function public.import_history(uuid, text, jsonb);

drop index if exists public.orders_import_ref_idx;
alter table public.orders drop column imported_from, drop column import_ref;

drop table public.copy_requests;
drop table public.import_connections;

-- store_imports now records links only
comment on table public.store_imports is 'Each link a creator read with "Add from a link": where from, and what they confirmed (proof.method = rights_confirmed).';
