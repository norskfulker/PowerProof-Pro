-- 027: emails are case-insensitive (citext), but inside a function with an empty search_path the
-- comparison quietly became a case-sensitive text one, so "Ada@Example.com" was never found by
-- "ada@example.com". Compare lowercase text on both sides. Found by testing.
create or replace function public.lookup_order(p_email text, p_ref text) returns text
language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin
  select o.id into oid from public.orders o where o.ref = upper(trim(p_ref)) and lower(o.buyer_email::text) = lower(trim(p_email)) and o.status = 'paid';
  if oid is null then return null; end if;
  if (select count(*) from public.download_tokens d where d.order_id = oid and d.created_at > now() - interval '1 hour') >= 5 then raise exception 'lookup_rate_limited'; end if;
  return public.issue_download_token(oid);
end $$;

create or replace function public.ask_question(p_store_slug text, p_product uuid, p_name text, p_email text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.products%rowtype; q public.questions%rowtype;
begin
  select pr.* into p from public.products pr join public.stores s on s.id = pr.store_id where pr.id = p_product and pr.status = 'live' and s.slug = p_store_slug and s.status = 'published';
  if not found then raise exception 'question_product_not_found'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 or char_length(trim(coalesce(p_body, ''))) not between 5 and 600 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'question_invalid'; end if;
  if (select count(*) from public.questions x where lower(x.asker_email::text) = lower(trim(p_email)) and x.created_at > now() - interval '1 day') >= 10 then raise exception 'question_rate_limited'; end if;
  insert into public.questions (store_id, product_id, asker_name, asker_email, body) values (p.store_id, p.id, trim(p_name), lower(trim(p_email)), trim(p_body)) returning * into q;
  return jsonb_build_object('id', q.id, 'product_id', q.product_id, 'asker_name', q.asker_name, 'body', q.body, 'answer', q.answer, 'answered_at', q.answered_at, 'status', q.status, 'created_at', q.created_at);
end $$;
