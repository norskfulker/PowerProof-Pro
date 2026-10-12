-- 041: Fixed bundle prices. A bundle discount may set one total price for all its products
-- (bundle_price_minor + bundle_price_currency) instead of a percent off each. percent_bps keeps a
-- derived percent so older readers (labels, ordering) still work; the engine prefers the fixed
-- price when present. Currency is the store's own (checked when the bundle is saved).

alter table public.deal_rules
  add column bundle_price_minor integer check (bundle_price_minor is null or bundle_price_minor >= 0),
  add column bundle_price_currency text check (bundle_price_currency is null or char_length(bundle_price_currency) = 3);
