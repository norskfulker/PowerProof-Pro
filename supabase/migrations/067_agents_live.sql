-- 067: Agents run on their own and show it. Additive only.
--   * agent_instances: when it runs (schedule), what a customer's reply does (reply_rule) and how
--     often the owner gets a report (report_frequency)
--   * agent_run_logs: every line a run writes, streamed to the agent's terminal (Realtime)
--   * agent_replies: customer replies, from inbound email or marked by the owner
--   * agent_ratings: stars and a short comment from stores that ran the agent
--   * chaser_customers.snoozed_until: no reminders before this day (a reply asked for time)
--   * agent_reports.period: daily reports beside the weekly ones

-- When it runs, what replies do, how often it reports ------------------------------------------
alter table public.agent_instances
  -- null: the manifest's interval. {"mode":"interval","everyMinutes":60} or
  -- {"mode":"times","times":["09:00","17:00"],"days":[1,2,3,4,5]} (India time, 1 = Monday)
  add column if not exists schedule jsonb,
  add column if not exists reply_rule text not null default 'auto' check (reply_rule in ('auto', 'stop', 'pause', 'keep')),
  add column if not exists reply_pause_days integer not null default 7 check (reply_pause_days between 1 and 60),
  add column if not exists report_frequency text not null default 'weekly' check (report_frequency in ('daily', 'weekly', 'off'));

-- The terminal -----------------------------------------------------------------------------------
create table if not exists public.agent_run_logs (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete cascade,
  at timestamptz not null default now(),
  level text not null check (level in ('info', 'ok', 'warn', 'error')),
  step text check (char_length(step) <= 60),
  -- Plain words, counts and ids only: never a customer's name, email or phone
  message text not null check (char_length(message) between 1 and 300)
);
create index if not exists agent_run_logs_instance on public.agent_run_logs (instance_id, id desc);
create index if not exists agent_run_logs_run on public.agent_run_logs (run_id);
create index if not exists agent_run_logs_store on public.agent_run_logs (store_id);

-- Replies ----------------------------------------------------------------------------------------
create table if not exists public.agent_replies (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  outbox_id uuid references public.agent_messages_outbox(id) on delete set null,
  contact_key text not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  source text not null check (source in ('inbound', 'owner')),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  intent text not null check (intent in ('paid', 'promise', 'dispute', 'stop', 'other')),
  promised_on date,
  -- What the reply rule did: 'stopped', 'snoozed_until:2026-11-02', 'kept', 'review'
  applied text not null default '' check (char_length(applied) <= 80),
  provider_message_id text,
  received_at timestamptz not null default now()
);
create unique index if not exists agent_replies_provider on public.agent_replies (provider_message_id) where provider_message_id is not null;
create index if not exists agent_replies_instance on public.agent_replies (instance_id, received_at desc);
create index if not exists agent_replies_contact on public.agent_replies (store_id, contact_key, received_at desc);
create index if not exists agent_replies_outbox on public.agent_replies (outbox_id);

-- Ratings ----------------------------------------------------------------------------------------
create table if not exists public.agent_ratings (
  agent_id text not null references public.agent_catalog(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agent_id, store_id)
);
create index if not exists agent_ratings_recent on public.agent_ratings (agent_id, updated_at desc);
create index if not exists agent_ratings_store on public.agent_ratings (store_id);
create index if not exists agent_ratings_user on public.agent_ratings (user_id);

-- A reply the owner should look at sits in their queue
alter table public.agent_action_items drop constraint if exists agent_action_items_kind_check;
alter table public.agent_action_items add constraint agent_action_items_kind_check check (kind in ('whatsapp_send', 'needs_personal_call', 'approve_draft', 'review_reply'));

-- Payment Chaser: a reply can ask for time ---------------------------------------------------------
alter table public.chaser_customers add column if not exists snoozed_until date;

-- Daily reports beside weekly ones ---------------------------------------------------------------
alter table public.agent_reports add column if not exists period text not null default 'week' check (period in ('day', 'week'));
alter table public.agent_reports drop constraint if exists agent_reports_instance_id_period_start_key;
create unique index if not exists agent_reports_instance_period on public.agent_reports (instance_id, period, period_start);

-- Access: the browser reads; the server writes after checking access -----------------------------
do $$
declare t text;
begin
  foreach t in array array['agent_run_logs', 'agent_replies']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_store_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.store_can(store_id, ''agents'')) or (select public.is_admin()))', t || '_store_read', t);
  end loop;
end $$;

-- Ratings are public: the agent's page shows them to everyone (no names or emails in the row)
alter table public.agent_ratings enable row level security;
revoke all on public.agent_ratings from anon, authenticated;
grant select (agent_id, stars, comment, created_at, updated_at) on public.agent_ratings to anon, authenticated;
drop policy if exists agent_ratings_read on public.agent_ratings;
create policy agent_ratings_read on public.agent_ratings for select to anon, authenticated using (true);

-- Average and count per agent, for the catalog and the agent's page
create or replace view public.agent_rating_summary with (security_invoker = true) as
  select agent_id, round(avg(stars)::numeric, 1) as average, count(*)::integer as count
  from public.agent_ratings group by agent_id;
grant select on public.agent_rating_summary to anon, authenticated;

-- The terminal and the replies list update live
do $$
declare t text;
begin
  foreach t in array array['agent_run_logs', 'agent_replies', 'agent_runs']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
