-- 046: a store's own connections to outside services (Pro).
--
-- 1. store_integrations: one row per store and kind. "payment" is the store's own gateway
--    (their Razorpay account, Stripe, or a custom gateway); "ai" is their own AI provider (any
--    OpenAI-compatible service, Anthropic or Gemini, with its URL, model and options).
--    `config` holds what isn't secret (key id, URLs, model). `secret_enc` holds the API secrets,
--    encrypted by the server (AES-256-GCM) before they're stored; the browser can never read it.
--    Only the server writes rows (service role), after checking the store's owner is on Pro.
-- 2. apply_direct_payment: an order paid through the store's own gateway. The money went straight
--    to the creator, so nothing is added to their PowerProof balance and no platform fee is taken.

create table if not exists public.store_integrations (
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('payment', 'ai')),
  provider text not null check (char_length(provider) between 1 and 40),
  config jsonb not null default '{}'::jsonb,
  secret_enc text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (store_id, kind)
);

alter table public.store_integrations enable row level security;
revoke all on public.store_integrations from anon, authenticated;
-- The owner sees what's connected, never the secrets
grant select (store_id, kind, provider, config, enabled, updated_at) on public.store_integrations to authenticated;

drop policy if exists store_integrations_owner_read on public.store_integrations;
create policy store_integrations_owner_read on public.store_integrations
  for select to authenticated using (public.is_store_owner(store_id));

create or replace function public.apply_direct_payment(p_gateway_order_id text, p_gateway_payment_id text)
returns table (out_order_id uuid, out_ref text, out_token text, out_already_paid boolean)
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; v_token text;
begin
  select * into o from public.orders where gateway_order_id = p_gateway_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if o.status = 'paid' then
    return query select o.id, o.ref, null::text, true; return;      -- a retry: nothing to do
  end if;
  if o.status not in ('pending', 'failed') then raise exception 'order_not_payable' using errcode = 'P0001'; end if;
  if o.gateway not in ('own_razorpay', 'stripe', 'custom') then raise exception 'not_direct' using errcode = 'P0001'; end if;

  update public.orders
     set status = 'paid', gateway_payment_id = p_gateway_payment_id, paid_at = now(),
         available_at = now(), invoice_no = public.next_invoice_no()
   where id = o.id;

  perform public.take_stock(o.id);

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.download_tokens (order_id, token_hash, expires_at)
  values (o.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');

  return query select o.id, o.ref, v_token, false;
end $$;

revoke all on function public.apply_direct_payment(text, text) from public, anon, authenticated;
