-- 049: reviews before buying
--
-- Anyone can review a live product with their name and email (submit_open_review). The review is
-- verified when that email has a paid order for the product: it is linked to the order and shows
-- "Verified buyer". If not, it shows as not verified yet, and is linked the moment that email pays
-- for the product (orders_verify_reviews). Reviews from the order link (submit_review) stay as they
-- were: always verified.
--
-- The reviewer's email is never public: reviews are readable by anyone, so the email sits in
-- review_emails, which has RLS on and no policies (only these definer functions read it).

alter table public.reviews alter column order_id drop not null;

-- Whether a review is tied to a paid order, readable by anyone (order_id itself stays private)
alter table public.reviews add column if not exists verified boolean generated always as (order_id is not null) stored;
grant select (verified) on public.reviews to anon, authenticated;

create table if not exists public.review_emails (
  review_id uuid primary key references public.reviews (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  email extensions.citext not null,
  created_at timestamptz not null default now()
);
alter table public.review_emails enable row level security;
create unique index if not exists review_emails_product_email_key on public.review_emails (product_id, email);
create index if not exists review_emails_email_idx on public.review_emails (email, created_at desc);
create index if not exists review_emails_store_idx on public.review_emails (store_id);

-- A review from anyone; returns true when it is verified by a paid order
create or replace function public.submit_open_review(
  p_store_slug text, p_product uuid, p_name text, p_email text, p_rating integer, p_title text, p_body text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare p public.products%rowtype; em extensions.citext; oid uuid; rid uuid;
begin
  select pr.* into p from public.products pr join public.stores s on s.id = pr.store_id
    where pr.id = p_product and pr.status = 'live' and s.slug = p_store_slug and s.status = 'published';
  if not found then raise exception 'review_product_not_found'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60
    or coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or p_rating is null or p_rating not between 1 and 5 then
    raise exception 'review_invalid';
  end if;
  em := lower(trim(p_email))::extensions.citext;
  if (select count(*) from public.review_emails e where e.email = em and e.created_at > now() - interval '1 day') >= 5 then
    raise exception 'review_rate_limited';
  end if;
  if exists (select 1 from public.review_emails e where e.product_id = p.id and e.email = em) then
    raise exception 'review_exists';
  end if;
  -- A paid order from this email for this product that hasn't been reviewed yet
  select o.id into oid from public.orders o
    join public.order_items i on i.order_id = o.id and i.product_id = p.id and not coalesce(i.is_gift, false)
    where o.store_id = p.store_id and o.buyer_email = em and o.status = 'paid'
      and not exists (select 1 from public.reviews r where r.order_id = o.id and r.product_id = p.id)
    order by o.paid_at desc nulls last limit 1;
  -- Already reviewed through their order link
  if oid is null and exists (
    select 1 from public.reviews r join public.orders o on o.id = r.order_id
    where r.product_id = p.id and o.buyer_email = em
  ) then
    raise exception 'review_exists';
  end if;
  insert into public.reviews (store_id, product_id, order_id, reviewer_name, rating, title, body)
  values (p.store_id, p.id, oid, left(trim(p_name), 60), p_rating::smallint, nullif(left(trim(coalesce(p_title, '')), 120), ''), nullif(left(trim(coalesce(p_body, '')), 2000), ''))
  returning id into rid;
  insert into public.review_emails (review_id, store_id, product_id, email) values (rid, p.store_id, p.id, em);
  return oid is not null;
end $$;

revoke all on function public.submit_open_review(text, uuid, text, text, integer, text, text) from public;
grant execute on function public.submit_open_review(text, uuid, text, text, integer, text, text) to anon, authenticated;

-- When an order is paid, reviews its buyer left before buying become verified
create or replace function public.verify_reviews_for_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;
  update public.reviews r set order_id = new.id, updated_at = now()
    from public.review_emails e
    where e.review_id = r.id and r.order_id is null and r.store_id = new.store_id and e.email = new.buyer_email
      and exists (select 1 from public.order_items i where i.order_id = new.id and i.product_id = r.product_id and not coalesce(i.is_gift, false))
      and not exists (select 1 from public.reviews r2 where r2.order_id = new.id and r2.product_id = r.product_id);
  return new;
end $$;
revoke all on function public.verify_reviews_for_order() from public, anon, authenticated;

drop trigger if exists orders_verify_reviews on public.orders;
create trigger orders_verify_reviews after insert or update of status on public.orders
  for each row execute function public.verify_reviews_for_order();
