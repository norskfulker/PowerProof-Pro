-- 032: AI page builder. Creators can ask AI to build a page of one of the page types; each run is
-- recorded in ai_generations (kind 'page') and limited per day by plan: Free 1, Pro 10.
--   * plan_limits.ai_pages_daily
--   * ai_generations.kind ('image' for the AI image maker, 'page' for pages)
--   * start_ai_page(store, prompt): checks the store is the caller's and the day's limit, then
--     records the run, in one step (so two tabs can't both take the last one)
--   * finish_ai_page(id, status): marks the caller's run done or failed (a failed run gives the day's
--     allowance back)

alter table public.plan_limits add column ai_pages_daily integer not null default 1 check (ai_pages_daily >= 0);
update public.plan_limits set ai_pages_daily = 1 where plan = 'free';
update public.plan_limits set ai_pages_daily = 10 where plan = 'pro';

alter table public.ai_generations add column kind text not null default 'image' check (kind in ('image', 'page'));
create index ai_generations_owner_kind_day_idx on public.ai_generations (owner_id, kind, created_at);

-- The day is India's (the app's home time zone)
create or replace function public.ai_pages_used_today(p_owner uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.ai_generations g
   where g.owner_id = p_owner and g.kind = 'page' and g.status <> 'failed'
     and g.created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
$$;
revoke all on function public.ai_pages_used_today(uuid) from public, anon, authenticated;

create or replace function public.ai_page_allowance() returns table (used integer, daily integer)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  return query
    select public.ai_pages_used_today(uid), coalesce(l.ai_pages_daily, 0)
      from public.profiles p left join public.plan_limits l on l.plan = p.plan
     where p.id = uid;
end $$;
revoke all on function public.ai_page_allowance() from public, anon;
grant execute on function public.ai_page_allowance() to authenticated;

create or replace function public.start_ai_page(p_store uuid, p_prompt text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); lim int; used int; gid uuid;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = uid) then
    raise exception 'not_your_store' using errcode = '42501';
  end if;
  -- One at a time per person, so the limit holds
  perform pg_advisory_xact_lock(hashtext('ai_page:' || uid::text));
  select coalesce(l.ai_pages_daily, 0) into lim from public.profiles p left join public.plan_limits l on l.plan = p.plan where p.id = uid;
  used := public.ai_pages_used_today(uid);
  if used >= lim then raise exception 'ai_daily_limit' using errcode = 'P0001'; end if;
  insert into public.ai_generations (owner_id, store_id, prompt, status, credits_used, kind)
  values (uid, p_store, left(coalesce(p_prompt, ''), 4000), 'running', 1, 'page')
  returning id into gid;
  return gid;
end $$;
revoke all on function public.start_ai_page(uuid, text) from public, anon;
grant execute on function public.start_ai_page(uuid, text) to authenticated;

create or replace function public.finish_ai_page(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('done', 'failed') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.ai_generations set status = p_status where id = p_id and owner_id = auth.uid() and kind = 'page';
end $$;
revoke all on function public.finish_ai_page(uuid, text) from public, anon;
grant execute on function public.finish_ai_page(uuid, text) to authenticated;
