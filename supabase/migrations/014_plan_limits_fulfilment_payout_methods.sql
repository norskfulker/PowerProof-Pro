-- Free plan: 10 products and 3 pages. Products can be digital or physical. A creator may keep up to
-- 5 bank accounts (in the company's or a director's name), 5 UPI IDs and 5 crypto wallets.
-- Applied to the project as migration "014_plan_limits_fulfilment_payout_methods".

-- 1. Plan limits: pages ---------------------------------------------------------------------
alter table public.plan_limits add column max_pages integer check (max_pages is null or max_pages >= 0);
update public.plan_limits set max_products = 10, max_pages = 3 where plan = 'free';
update public.plan_limits set max_pages = null where plan = 'pro';

create or replace function public.enforce_page_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int; cnt int; owner uuid;
begin
  select s.owner_id into owner from public.stores s where s.id = new.store_id;
  select l.max_pages into lim from public.plan_limits l join public.profiles p on p.plan = l.plan where p.id = owner;
  if lim is not null then
    select count(*) into cnt from public.custom_pages cp join public.stores s on s.id = cp.store_id where s.owner_id = owner;
    if cnt >= lim then raise exception 'plan_limit_pages' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;

create trigger trg_page_limit before insert on public.custom_pages
  for each row execute function public.enforce_page_limit();

-- 2. Products: digital or physical ----------------------------------------------------------
alter table public.products
  add column fulfilment text not null default 'digital' check (fulfilment in ('digital', 'physical'));
grant select (fulfilment) on public.products to anon;

-- 3. Payout methods: crypto wallets, and at most 5 of each kind -------------------------------
alter table public.payout_methods drop constraint payout_methods_kind_check;
alter table public.payout_methods
  add constraint payout_methods_kind_check check (kind in ('bank', 'upi', 'crypto')),
  add column asset text check (asset is null or asset in ('USDT', 'USDC', 'BTC', 'ETH')),
  add column network text check (network is null or network in ('TRC20', 'ERC20', 'BEP20', 'POLYGON', 'SOLANA', 'BITCOIN')),
  add column wallet_address text check (wallet_address is null or wallet_address ~ '^[A-Za-z0-9]{26,100}$'),
  add constraint payout_methods_crypto_check check ((kind = 'crypto') = (wallet_address is not null and asset is not null and network is not null));
grant insert (asset, network, wallet_address), update (asset, network, wallet_address) on public.payout_methods to authenticated;

create or replace function public.payout_name_tokens(p text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct t), '{}') from unnest(regexp_split_to_array(lower(regexp_replace(coalesce(p, ''), '[^a-zA-Z0-9 ]+', ' ', 'g')), '\s+')) t where t <> ''
$$;

-- A bank account must be in the company's name or in the name of the person who runs it. Names
-- match when one holds all the words of the other ("Ravi Kumar" and "KUMAR RAVI S").
create or replace function public.enforce_payout_method_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cnt int; h text[]; ok boolean := false; r record;
begin
  select count(*) into cnt from public.payout_methods where owner_id = new.owner_id and kind = new.kind;
  if cnt >= 5 then raise exception 'payout_method_limit' using errcode = 'P0001'; end if;
  if new.kind = 'bank' then
    h := public.payout_name_tokens(new.holder_name);
    if coalesce(array_length(h, 1), 0) = 0 then raise exception 'payout_holder_mismatch' using errcode = 'P0001'; end if;
    for r in
      select legal_name as n from public.stores where owner_id = new.owner_id and legal_name is not null
      union all select full_name from public.profiles where id = new.owner_id and full_name is not null
    loop
      if h <@ public.payout_name_tokens(r.n) or public.payout_name_tokens(r.n) <@ h then ok := true; end if;
    end loop;
    if not ok then raise exception 'payout_holder_mismatch' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;

create trigger payout_methods_rules before insert on public.payout_methods
  for each row execute function public.enforce_payout_method_rules();
