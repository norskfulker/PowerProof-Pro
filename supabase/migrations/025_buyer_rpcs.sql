-- 025: what buyers and visitors do goes straight to the database, through functions that check
-- everything themselves, instead of through custom web routes. Only work that needs a secret key
-- (taking the payment, sending email, private download links, attaching a domain) stays on the server.
--   get_order      the order page's data, for a link token
--   lookup_order   email + order number -> a fresh link token
--   submit_review  a verified buyer's review
--   ask_question   a question on a product
--   submit_lead    (replaced) also takes the store's contact form as kind 'contact'

alter table public.leads drop constraint if exists leads_kind_check;
alter table public.leads add constraint leads_kind_check check (kind in ('lead', 'booking', 'newsletter', 'contact'));

create or replace function public.submit_lead(
  p_store_slug text, p_page_slug text, p_kind text, p_name text, p_email text, p_phone text, p_data jsonb,
  p_slot timestamptz default null, p_minutes integer default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid; pid uuid;
begin
  if p_kind not in ('lead', 'booking', 'newsletter', 'contact') then raise exception 'lead_invalid'; end if;
  select s.id into sid from public.stores s where s.slug = p_store_slug and s.status = 'published';
  if sid is null then raise exception 'lead_store_not_found'; end if;
  if p_page_slug is not null then
    select c.id into pid from public.custom_pages c where c.store_id = sid and c.slug = p_page_slug and c.status = 'published';
    if pid is null then raise exception 'lead_page_not_found'; end if;
  end if;
  if p_kind in ('lead', 'booking') and pid is null then raise exception 'lead_page_not_found'; end if;
  if p_kind = 'contact' and (p_email is null or char_length(coalesce(p_data->>'Message', '')) < 10) then raise exception 'lead_invalid'; end if;
  if p_kind = 'booking' and (p_slot is null or p_slot < now() or p_slot > now() + interval '90 days' or extract(minute from p_slot)::int % 5 <> 0 or p_minutes is null) then
    raise exception 'booking_invalid';
  end if;
  if p_email is not null and exists (select 1 from public.leads l where l.store_id = sid and l.page_id is not distinct from pid and l.kind = p_kind and lower(l.email) = lower(p_email) and l.created_at > now() - interval '1 minute') then
    return;
  end if;
  if p_email is not null and (select count(*) from public.leads l where l.store_id = sid and lower(l.email) = lower(p_email) and l.created_at > now() - interval '1 day') >= 20 then
    raise exception 'lead_rate_limited';
  end if;
  begin
    insert into public.leads (store_id, page_id, kind, name, email, phone, data, slot_at, slot_minutes)
    values (sid, pid, p_kind, nullif(trim(p_name), ''), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), coalesce(p_data, '{}'::jsonb), case when p_kind = 'booking' then p_slot end, case when p_kind = 'booking' then p_minutes end);
  exception when unique_violation then
    if p_kind = 'booking' then raise exception 'booking_taken'; end if;
  end;
end $$;

-- The order page, for the secret link token
create or replace function public.get_order(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare oid uuid; o public.orders%rowtype; s public.stores%rowtype;
begin
  oid := public.order_for_token(p_token);
  if oid is null then return null; end if;
  select * into o from public.orders where id = oid;
  select * into s from public.stores where id = o.store_id;
  return jsonb_build_object(
    'id', o.id, 'storeId', o.store_id, 'analytics', coalesce(s.theme->'analytics', '{}'::jsonb), 'ref', o.ref, 'status', o.status,
    'storeName', s.name, 'storeSlug', s.slug, 'supportEmail', s.support_email,
    'buyerName', o.buyer_name, 'buyerEmail', o.buyer_email::text, 'buyerCountry', coalesce(o.buyer_country, 'IN'), 'currency', o.currency,
    'subtotal', o.subtotal_minor, 'discount', o.discount_minor, 'tax', o.tax_minor, 'total', o.total_minor,
    'invoiceNo', o.invoice_no, 'paidAt', o.paid_at,
    'reviewed', coalesce((select jsonb_agg(r.product_id) from public.reviews r where r.order_id = o.id), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('productId', i.product_id, 'title', i.title, 'unit', i.unit_price_minor, 'discount', coalesce(i.discount_minor, 0),
        'total', i.line_total_minor, 'gift', coalesce(i.is_gift, false), 'hsn', i.hsn_sac, 'rateBps', i.tax_rate_bps)) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.file_name, 'size', f.size_bytes, 'product', (select i.title from public.order_items i where i.order_id = o.id and i.product_id = f.product_id limit 1)))
        from public.product_files f where f.product_id in (select i.product_id from public.order_items i where i.order_id = o.id)), '[]'::jsonb),
    'store', jsonb_build_object('legalName', s.legal_name, 'gstin', s.gstin, 'pan', s.pan, 'address', s.company_address, 'invoicePrefix', s.invoice_prefix, 'invoiceFooter', s.invoice_footer)
  );
end $$;

-- Lost the link: the email on the order plus its number gives a fresh one. A miss and a wrong guess look the same.
create or replace function public.lookup_order(p_email text, p_ref text) returns text
language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin
  select o.id into oid from public.orders o where o.ref = upper(trim(p_ref)) and o.buyer_email = lower(trim(p_email))::extensions.citext and o.status = 'paid';
  if oid is null then return null; end if;
  if (select count(*) from public.download_tokens d where d.order_id = oid and d.created_at > now() - interval '1 hour') >= 5 then raise exception 'lookup_rate_limited'; end if;
  return public.issue_download_token(oid);
end $$;

-- A verified buyer's review: the link token proves the purchase
create or replace function public.submit_review(p_token text, p_product uuid, p_rating integer, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare oid uuid; o public.orders%rowtype;
begin
  oid := public.order_for_token(p_token);
  if oid is null then raise exception 'review_link_invalid'; end if;
  select * into o from public.orders where id = oid;
  if not exists (select 1 from public.order_items i where i.order_id = oid and i.product_id = p_product and not coalesce(i.is_gift, false)) then raise exception 'review_not_in_order'; end if;
  if p_rating not between 1 and 5 then raise exception 'review_invalid'; end if;
  insert into public.reviews (store_id, product_id, order_id, reviewer_name, rating, title, body)
  values (o.store_id, p_product, oid, left(trim(o.buyer_name), 60), p_rating::smallint, nullif(left(trim(coalesce(p_title, '')), 120), ''), nullif(left(trim(coalesce(p_body, '')), 2000), ''));
exception when unique_violation then raise exception 'review_exists';
end $$;

-- A question about a live product, from anyone; shows at once, the seller can answer or hide it
create or replace function public.ask_question(p_store_slug text, p_product uuid, p_name text, p_email text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.products%rowtype; q public.questions%rowtype;
begin
  select pr.* into p from public.products pr join public.stores s on s.id = pr.store_id where pr.id = p_product and pr.status = 'live' and s.slug = p_store_slug and s.status = 'published';
  if not found then raise exception 'question_product_not_found'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 or char_length(trim(coalesce(p_body, ''))) not between 5 and 600 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'question_invalid'; end if;
  if (select count(*) from public.questions x where x.asker_email = lower(trim(p_email))::extensions.citext and x.created_at > now() - interval '1 day') >= 10 then raise exception 'question_rate_limited'; end if;
  insert into public.questions (store_id, product_id, asker_name, asker_email, body) values (p.store_id, p.id, trim(p_name), lower(trim(p_email)), trim(p_body)) returning * into q;
  return jsonb_build_object('id', q.id, 'product_id', q.product_id, 'asker_name', q.asker_name, 'body', q.body, 'answer', q.answer, 'answered_at', q.answered_at, 'status', q.status, 'created_at', q.created_at);
end $$;

revoke all on function public.get_order(text), public.lookup_order(text, text), public.submit_review(text, uuid, integer, text, text), public.ask_question(text, uuid, text, text, text) from public;
grant execute on function public.get_order(text), public.lookup_order(text, text), public.submit_review(text, uuid, integer, text, text), public.ask_question(text, uuid, text, text, text) to anon, authenticated;
