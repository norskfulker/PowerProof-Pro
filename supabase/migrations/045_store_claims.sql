-- 045: handing a store to someone by email.
--   * transfer: the owner emails a link; whoever signs in with that email becomes the owner. The
--     previous owner can stay on as an admin.
--   * claim: PowerProof staff build a store (for a brand, or from an outside shop's products) and
--     email its real owner a link to take it over. Staff never stay on.
--   A store has one owner: payouts, GST, KYC and the plan follow that person. Co-owners are the
--   existing Admin team role (store_members), which can do everything except money and the plan.
--   Ownership only moves once the store's money is settled, and the new owner's own business
--   details (legal name, GSTIN, PAN, address, invoice name) are cleared for them to fill in.

create table public.store_claims (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email extensions.citext not null check (char_length(email::text) <= 254),
  kind text not null check (kind in ('transfer', 'claim')),
  -- Transfer only: the previous owner stays as an admin
  keep_previous boolean not null default false,
  -- Shown to the recipient: why they're getting it ("Built from your Etsy shop")
  note text check (note is null or char_length(note) <= 280),
  token_hash text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);
-- One open link per store
create unique index store_claims_one_pending on public.store_claims (store_id) where status = 'pending';
create index store_claims_token on public.store_claims (token_hash) where token_hash is not null;

alter table public.store_claims enable row level security;
-- The owner sees their store's links; staff see all. Changes go through the functions below.
create policy store_claims_read on public.store_claims for select to authenticated
  using (public.is_store_owner(store_id) or public.is_admin());
grant select (id, store_id, email, kind, keep_previous, note, status, created_at, expires_at, accepted_at) on public.store_claims to authenticated;

-- The ownership switch is the one store change that isn't made by the owner. The claim function
-- turns this on for its own transaction only; nothing else can.
create or replace function public.guard_store_member_update() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare
  uid uuid := auth.uid();
  design text[] := array['name', 'tagline', 'logo_url', 'theme', 'theme_mode', 'brand_color', 'status'];
  business text[] := array['support_email', 'refund_days', 'legal_name', 'invoice_name', 'company_address', 'gstin', 'pan', 'business_type', 'invoice_prefix', 'invoice_footer', 'shipping', 'sells', 'cart_reminders'];
begin
  if uid is null or old.owner_id = uid or public.is_admin() then return new; end if;
  if current_setting('powerproof.store_claim', true) = old.id::text then return new; end if;
  if exists (
    select 1 from jsonb_each(to_jsonb(new)) n
     where n.key <> 'updated_at' and n.value is distinct from (to_jsonb(old) -> n.key)
       and not ((n.key = any (design) and public.store_can(old.id, 'design')) or (n.key = any (business) and public.store_can(old.id, 'business')))
  ) then
    raise exception 'not_allowed_for_member' using errcode = '42501';
  end if;
  return new;
end $function$;

/** Why ownership can't move yet (null when it can): the store's money must be settled first */
create or replace function public.store_claim_blocker(p_store uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.ledger_entries l where l.store_id = p_store and l.account = 'creator' group by l.currency having sum(l.amount_minor) <> 0) then 'claim_balance'
    when exists (select 1 from public.payouts p where p.store_id = p_store and p.status in ('requested', 'processing')) then 'claim_payout'
    when exists (select 1 from public.orders o where o.store_id = p_store and o.status = 'cod') then 'claim_cod'
    when exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id where o.store_id = p_store and d.status in ('open', 'under_review')) then 'claim_dispute'
  end
$$;

/**
 * Makes a link. The owner can transfer their store; PowerProof staff can send a claim for any store.
 * Replaces an open link for the same store. Returns the token once (only its hash is kept).
 */
create or replace function public.store_claim_create(p_store uuid, p_email text, p_keep_previous boolean default false, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); v_owner uuid; v_kind text; v_email text := lower(btrim(coalesce(p_email, ''))); v_token text; v_id uuid;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  select owner_id into v_owner from public.stores where id = p_store;
  if v_owner is null then raise exception 'store_not_found' using errcode = 'P0002'; end if;
  if v_owner = uid then v_kind := 'transfer';
  elsif public.is_admin() then v_kind := 'claim';
  else raise exception 'owner_only' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'bad_email' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles p where p.id = v_owner and lower(p.email::text) = v_email) then raise exception 'is_owner' using errcode = '22023'; end if;
  update public.store_claims set status = 'cancelled', token_hash = null where store_id = p_store and status = 'pending';
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.store_claims (store_id, email, kind, keep_previous, note, token_hash, invited_by)
  values (p_store, v_email, v_kind, v_kind = 'transfer' and coalesce(p_keep_previous, false), nullif(btrim(coalesce(p_note, '')), ''), encode(extensions.digest(v_token, 'sha256'), 'hex'), uid)
  returning id into v_id;
  if v_kind = 'claim' then
    insert into public.audit_log (actor_id, action, target_type, target_id, meta) values (uid, 'store_claim_sent', 'store', p_store::text, jsonb_build_object('email', v_email));
  end if;
  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'kind', v_kind, 'blocker', public.store_claim_blocker(p_store));
end $$;

/** What a link is for, so the page can say it before anyone signs in. No secrets. */
create or replace function public.store_claim_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'storeName', s.name, 'storeSlug', s.slug, 'logo', s.logo_url, 'brandColor', s.brand_color,
    'from', case when c.kind = 'claim' then 'PowerProof' else coalesce(nullif(ip.full_name, ''), 'The store owner') end,
    'email', c.email::text, 'kind', c.kind, 'keepPrevious', c.keep_previous, 'note', c.note,
    'products', (select count(*) from public.products p where p.store_id = s.id and p.status <> 'archived'),
    'expired', c.expires_at < now(), 'blocker', public.store_claim_blocker(s.id))
    from public.store_claims c join public.stores s on s.id = c.store_id left join public.profiles ip on ip.id = c.invited_by
   where c.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and c.status = 'pending'
$$;

/** Takes the store over. Only the person signed in with the email it was sent to can. Returns the store. */
create or replace function public.store_claim_accept(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); v_email text; c public.store_claims%rowtype; v_old uuid; v_old_email text; v_lim int; v_cnt int; v_blocker text;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  select * into c from public.store_claims where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and status = 'pending' for update;
  if not found then raise exception 'claim_not_found' using errcode = 'P0002'; end if;
  if c.expires_at < now() then raise exception 'claim_expired' using errcode = '22023'; end if;
  select lower(p.email::text) into v_email from public.profiles p where p.id = uid;
  if v_email is distinct from lower(c.email::text) then raise exception 'wrong_account' using errcode = '42501'; end if;
  select owner_id into v_old from public.stores where id = c.store_id for update;
  if v_old = uid then raise exception 'is_owner' using errcode = '22023'; end if;
  v_blocker := public.store_claim_blocker(c.store_id);
  if v_blocker is not null then raise exception '%', v_blocker using errcode = 'P0001'; end if;
  -- The new owner's plan decides how many stores they can own
  select l.max_stores into v_lim from public.plan_limits l join public.profiles p on p.plan = l.plan where p.id = uid;
  select count(*) into v_cnt from public.stores where owner_id = uid;
  if v_lim is not null and v_cnt >= v_lim then raise exception 'plan_limit_stores' using errcode = 'P0001'; end if;

  perform set_config('powerproof.store_claim', c.store_id::text, true);
  update public.stores
     set owner_id = uid, legal_name = null, invoice_name = null, company_address = null, gstin = null, pan = null, business_type = null, support_email = null
   where id = c.store_id;
  perform set_config('powerproof.store_claim', '', true);

  -- They were on the team: now they own it
  delete from public.store_members where store_id = c.store_id and (user_id = uid or email = c.email);
  -- A transfer can keep the previous owner as an admin; staff who built a store never stay
  if c.kind = 'transfer' and c.keep_previous then
    select p.email::text into v_old_email from public.profiles p where p.id = v_old;
    insert into public.store_members (store_id, email, user_id, role, areas, status, invited_by, invited_at, accepted_at)
    values (c.store_id, v_old_email, v_old, 'admin', '{}', 'active', uid, now(), now())
    on conflict (store_id, email) do update set user_id = excluded.user_id, role = 'admin', areas = '{}', status = 'active', token_hash = null, expires_at = null, accepted_at = now();
  end if;
  -- Deals stay with the store; open team invites the old owner sent stay valid
  update public.store_claims set status = 'accepted', token_hash = null, accepted_at = now(), accepted_by = uid where id = c.id;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (uid, 'store_claimed', 'store', c.store_id::text, jsonb_build_object('kind', c.kind, 'from', v_old));
  return c.store_id;
end $$;

/** Cancels an open link (the owner, or staff) */
create or replace function public.store_claim_cancel(p_claim uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.store_claims%rowtype;
begin
  select * into c from public.store_claims where id = p_claim for update;
  if not found or not (public.is_store_owner(c.store_id) or public.is_admin()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.store_claims set status = 'cancelled', token_hash = null where id = p_claim and status = 'pending';
end $$;

revoke execute on function public.store_claim_create(uuid, text, boolean, text), public.store_claim_accept(text), public.store_claim_cancel(uuid), public.store_claim_blocker(uuid) from public, anon;
grant execute on function public.store_claim_create(uuid, text, boolean, text), public.store_claim_accept(text), public.store_claim_cancel(uuid) to authenticated;
grant execute on function public.store_claim_info(text) to anon, authenticated;
