-- 040: Pro billing via Razorpay Subscriptions (INR-only, ₹1,999/mo, card upfront).
-- The trial starts after the creator authorises the mandate; the first charge is 30 days later.
-- Receipts only (no GST invoice). Plan flips happen only here on the server, never from the browser.

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  razorpay_customer_id text not null default '',
  razorpay_subscription_id text not null default '' check (char_length(razorpay_subscription_id) <= 80),
  status text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'cancelled', 'completed', 'expired', 'paused')),
  trial_ends_at timestamptz,
  current_start timestamptz,
  current_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index billing_subscriptions_user_idx on public.billing_subscriptions (user_id);
create unique index billing_subscriptions_rz_sub_idx on public.billing_subscriptions (razorpay_subscription_id)
  where char_length(razorpay_subscription_id) > 0;

create table public.billing_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions (id) on delete set null,
  razorpay_payment_id text not null default '' check (char_length(razorpay_payment_id) <= 80),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'INR' check (char_length(currency) = 3),
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

create unique index billing_receipts_payment_idx on public.billing_receipts (razorpay_payment_id)
  where char_length(razorpay_payment_id) > 0;
create index billing_receipts_user_idx on public.billing_receipts (user_id, created_at desc);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_receipts enable row level security;

-- Server-only writes (service role bypasses RLS). Creators read their own rows.
create policy billing_subscriptions_owner_read on public.billing_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy billing_receipts_owner_read on public.billing_receipts for select to authenticated
  using (user_id = auth.uid());

grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_receipts to authenticated;
