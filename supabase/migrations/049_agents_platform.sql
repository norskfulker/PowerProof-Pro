-- 049: the agent marketplace platform (PowerProof Agents).
--
-- Additive only: new agent_* tables, functions and policies; nothing existing is changed.
-- Tenant = the store. Reads from the browser go through RLS with store_can(store_id, 'agents')
-- (owners and team admins; Limited members can't be given this area in v1). Every write goes
-- through the server (service role) after it has checked access, so authenticated users get
-- SELECT only. Credits are a ledger (append-only): the balance is always summed, never stored.
-- Agent revenue and credits never touch creators' ledger_entries, payouts, AI credits or profiles.plan.

-- ---------------------------------------------------------------------------------------------
-- Platform switches (one row): global kill switches and the default model provider
create table if not exists public.agent_platform_settings (
  id boolean primary key default true check (id),
  runs_enabled boolean not null default true,
  sending_enabled boolean not null default true,
  llm_provider text not null default 'gemini' check (llm_provider in ('gemini', 'anthropic')),
  -- Costs for the margin view: {"usd_inr": 84, "llm": {"gemini": {"in": 0.3, "out": 2.5}}, "email_usd": 0.0009, "credit_usd": 0.0833}
  cost_rates jsonb not null default '{"usd_inr": 84, "llm": {"gemini": {"in": 0.3, "out": 2.5}, "anthropic": {"in": 1, "out": 5}}, "email_usd": 0.0009, "credit_usd": 0.0833}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.agent_platform_settings (id) values (true) on conflict (id) do nothing;

-- The catalog: live agents (code in agents/) and coming-soon ones (rows only, added from Admin)
create table if not exists public.agent_catalog (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  tagline text not null default '' check (char_length(tagline) <= 160),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'Other' check (char_length(category) between 1 and 40),
  status text not null default 'coming_soon' check (status in ('live', 'coming_soon', 'hidden')),
  -- Per-agent kill switch (Admin): off stops runs and sends for every store
  enabled boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_plans (
  id text primary key,
  agent_id text not null references public.agent_catalog(id) on delete cascade,
  name text not null default 'Monthly',
  price_minor integer not null check (price_minor >= 0),
  launch_price_minor integer check (launch_price_minor >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  included_credits integer not null default 0 check (included_credits >= 0),
  -- Razorpay plan for agents (its own, never RAZORPAY_PRO_PLAN_ID); set once billing opens
  razorpay_plan_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One agent switched on for one store
create table if not exists public.agent_instances (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  agent_id text not null references public.agent_catalog(id),
  status text not null default 'setup' check (status in ('setup', 'trial', 'active', 'paused', 'trial_ended', 'suspended')),
  settings jsonb not null default '{}'::jsonb,
  consent_at timestamptz,
  consent_by uuid references auth.users(id) on delete set null,
  paused_reason text,
  run_every_minutes integer check (run_every_minutes >= 10),
  next_run_at timestamptz,
  last_run_at timestamptz,
  -- Only one run per instance at a time (set by agent_claim_jobs)
  run_lock_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, agent_id)
);
create index if not exists agent_instances_due on public.agent_instances (next_run_at) where status in ('trial', 'active');

-- A store's connections, reusable by every agent. Secrets are sealed by the server (AES-256-GCM)
-- and the column is never granted to the browser.
create table if not exists public.agent_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  type text not null check (type in ('verified_email', 'invoice_source', 'google_sheets', 'sms_provider')),
  label text not null default '' check (char_length(label) <= 120),
  config jsonb not null default '{}'::jsonb,
  secret_enc text,
  status text not null default 'connected' check (status in ('connected', 'needs_reauth', 'error')),
  last_checked_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_connections_store on public.agent_connections (store_id, type);

-- Which agent uses which connection (a broken connection pauses only these)
create table if not exists public.agent_instance_connections (
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  connector_key text not null,
  connection_id uuid not null references public.agent_connections(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  primary key (instance_id, connector_key)
);
create index if not exists agent_instance_connections_conn on public.agent_instance_connections (connection_id);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  agent_id text not null,
  trigger text not null check (trigger in ('cron', 'manual', 'dry_run')),
  dry_run boolean not null default false,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'dead')),
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_instance on public.agent_runs (instance_id, started_at desc);
create index if not exists agent_runs_failed on public.agent_runs (status, started_at desc) where status in ('failed', 'dead');

-- Step checkpoints: a run cut short resumes at the step it was on
create table if not exists public.agent_run_steps (
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  step text not null,
  status text not null check (status in ('done', 'failed')),
  output jsonb,
  error text,
  attempts integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (run_id, step)
);

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid references public.agent_instances(id) on delete cascade,
  kind text not null check (kind in ('run', 'dry_run', 'report', 'sheet_refresh', 'connection_alert')),
  run_id uuid references public.agent_runs(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_until timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_jobs_due on public.agent_jobs (status, run_at);
create index if not exists agent_jobs_instance on public.agent_jobs (instance_id, created_at desc);

-- Things that need the owner: WhatsApp to send, a call to make, a draft to approve
create table if not exists public.agent_action_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  kind text not null check (kind in ('whatsapp_send', 'needs_personal_call', 'approve_draft')),
  status text not null default 'open' check (status in ('open', 'done', 'skipped', 'snoozed')),
  snooze_until timestamptz,
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 4000),
  payload jsonb not null default '{}'::jsonb,
  ref_type text,
  ref_id uuid,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null
);
create index if not exists agent_action_items_open on public.agent_action_items (store_id, status, created_at);

-- Every message, once (idempotency_key). Credits for it are charged in the same transaction.
create table if not exists public.agent_messages_outbox (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  agent_id text not null,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  to_address text not null,
  contact_key text not null,
  subject text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'queued', 'failed')),
  credits integer not null default 0,
  credit_reason text,
  provider_message_id text,
  error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists agent_outbox_contact on public.agent_messages_outbox (store_id, contact_key, created_at desc);
create index if not exists agent_outbox_instance_day on public.agent_messages_outbox (instance_id, created_at desc);

-- Opt-outs per store and channel, by a hash of the address (lowercase email or E.164 phone)
create table if not exists public.agent_optouts (
  store_id uuid not null references public.stores(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  address_hash text not null check (address_hash ~ '^[0-9a-f]{64}$'),
  source text not null default 'link' check (source in ('link', 'owner', 'reply')),
  created_at timestamptz not null default now(),
  primary key (store_id, channel, address_hash)
);

create table if not exists public.agent_consents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  text text not null,
  accepted_at timestamptz not null default now()
);

-- Credits: one credit = one request. Append-only (a trigger refuses changes); balance = sum(delta)
create table if not exists public.agent_credit_ledger (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  agent_id text,
  delta integer not null check (delta <> 0),
  kind text not null check (kind in ('trial_grant', 'plan_grant', 'topup', 'charge', 'release', 'admin_grant', 'admin_debit')),
  reason text,
  idempotency_key text not null unique,
  ref text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists agent_credit_ledger_store on public.agent_credit_ledger (store_id, created_at desc);

create or replace function public.agent_ledger_append_only()
 returns trigger language plpgsql set search_path to '' as $$
begin
  -- A store being deleted takes its rows with it; nothing else may change or remove a row
  if tg_op = 'DELETE' and not exists (select 1 from public.stores where id = old.store_id) then return old; end if;
  raise exception 'agent_credit_ledger is append-only' using errcode = '42501';
end $$;
drop trigger if exists agent_credit_ledger_append_only on public.agent_credit_ledger;
create trigger agent_credit_ledger_append_only before update or delete on public.agent_credit_ledger
  for each row execute function public.agent_ledger_append_only();

create or replace view public.agent_credit_balances with (security_invoker = true) as
  select store_id, coalesce(sum(delta), 0)::integer as balance from public.agent_credit_ledger group by store_id;

-- Billing (routes come once the founder sets up the agents' Razorpay account)
create table if not exists public.agent_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  agent_id text not null references public.agent_catalog(id),
  plan_id text references public.agent_plans(id),
  status text not null default 'created' check (status in ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')),
  razorpay_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, agent_id)
);

create table if not exists public.agent_payment_events (
  id bigint generated always as identity primary key,
  gateway text not null default 'razorpay',
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (gateway, event_id)
);

-- "I need this" on a coming-soon agent
create table if not exists public.agent_demand_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agent_catalog(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  mobile text check (mobile is null or mobile ~ '^\+[1-9][0-9]{7,14}$'),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create unique index if not exists agent_demand_one_per_email on public.agent_demand_requests (agent_id, lower(email));

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid not null references public.agent_instances(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (instance_id, period_start)
);

create table if not exists public.agent_support_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  instance_id uuid references public.agent_instances(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('wrong_message', 'help', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.agent_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_audit_log_recent on public.agent_audit_log (created_at desc);

-- Model use per store and agent, for cost per reminder and the margin view
create table if not exists public.agent_llm_usage (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  agent_id text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists agent_llm_usage_store on public.agent_llm_usage (store_id, created_at desc);

-- Checked model wording per store (placeholders only, no customer data)
create table if not exists public.agent_llm_cache (
  store_id uuid not null references public.stores(id) on delete cascade,
  cache_key text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  primary key (store_id, cache_key)
);

-- ---------------------------------------------------------------------------------------------
-- Access. Everything on: RLS. Browser: SELECT only, for the store's owner and admins.
do $$
declare t text;
begin
  foreach t in array array['agent_platform_settings', 'agent_catalog', 'agent_plans', 'agent_instances', 'agent_connections', 'agent_instance_connections',
    'agent_runs', 'agent_run_steps', 'agent_jobs', 'agent_action_items', 'agent_messages_outbox', 'agent_optouts', 'agent_consents',
    'agent_credit_ledger', 'agent_subscriptions', 'agent_payment_events', 'agent_demand_requests', 'agent_reports', 'agent_support_items',
    'agent_audit_log', 'agent_llm_usage', 'agent_llm_cache']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on public.agent_credit_balances from anon, authenticated;

grant select on public.agent_catalog, public.agent_plans to anon, authenticated;
grant select on public.agent_instances, public.agent_instance_connections, public.agent_runs, public.agent_run_steps, public.agent_jobs,
  public.agent_action_items, public.agent_messages_outbox, public.agent_optouts, public.agent_consents, public.agent_credit_ledger,
  public.agent_subscriptions, public.agent_reports, public.agent_support_items, public.agent_llm_usage, public.agent_credit_balances to authenticated;
-- Connections: everything but the sealed secret
grant select (id, store_id, type, label, config, status, last_checked_at, last_error, created_at, updated_at) on public.agent_connections to authenticated;
-- Admin screens read these too (policies below limit them to staff)
grant select on public.agent_platform_settings, public.agent_demand_requests, public.agent_audit_log, public.agent_payment_events to authenticated;

create policy agent_catalog_read on public.agent_catalog for select to anon, authenticated using (status <> 'hidden' or (select public.is_admin()));
create policy agent_plans_read on public.agent_plans for select to anon, authenticated using (active or (select public.is_admin()));
create policy agent_platform_settings_admin on public.agent_platform_settings for select to authenticated using ((select public.is_admin()));
create policy agent_demand_admin on public.agent_demand_requests for select to authenticated using ((select public.is_admin()));
create policy agent_audit_admin on public.agent_audit_log for select to authenticated using ((select public.is_admin()));
create policy agent_payment_events_admin on public.agent_payment_events for select to authenticated using ((select public.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['agent_instances', 'agent_connections', 'agent_instance_connections', 'agent_runs', 'agent_run_steps', 'agent_jobs',
    'agent_action_items', 'agent_messages_outbox', 'agent_optouts', 'agent_consents', 'agent_credit_ledger', 'agent_subscriptions',
    'agent_reports', 'agent_support_items', 'agent_llm_usage']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_store_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.store_can(store_id, ''agents'')) or (select public.is_admin()))', t || '_store_read', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Server functions (service role only)

create or replace function public.agent_credit_balance(p_store uuid)
 returns integer language sql stable security definer set search_path to '' as $$
  select coalesce(sum(delta), 0)::integer from public.agent_credit_ledger where store_id = p_store
$$;

/** Adds credits once per key (trial, plan cycle, top-up, admin). True when added now. */
create or replace function public.agent_grant_credits(p_store uuid, p_agent text, p_n integer, p_kind text, p_key text, p_reason text default null, p_by uuid default null)
 returns boolean language plpgsql security definer set search_path to '' as $$
begin
  if p_n = 0 then return false; end if;
  insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key, created_by)
  values (p_store, p_agent, p_n, p_kind, p_reason, p_key, p_by)
  on conflict (idempotency_key) do nothing;
  return found;
end $$;

/** Takes credits once per key; never below zero. 'charged', 'duplicate' or 'no_credits'. */
create or replace function public.agent_charge_credits(p_store uuid, p_agent text, p_n integer, p_reason text, p_key text)
 returns text language plpgsql security definer set search_path to '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('agent_credits:' || p_store::text, 0));
  if exists (select 1 from public.agent_credit_ledger where idempotency_key = p_key) then return 'duplicate'; end if;
  if public.agent_credit_balance(p_store) < p_n then return 'no_credits'; end if;
  insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key) values (p_store, p_agent, -p_n, 'charge', p_reason, p_key);
  return 'charged';
end $$;

/**
 * Reserves one message: in one transaction it checks the key (duplicates are impossible), the
 * opt-out list, the per-contact cap, the daily cap and the balance, then writes the outbox row and
 * charges its credits. The caller sends, then calls agent_outbox_finish.
 */
create or replace function public.agent_outbox_reserve(
  p_store uuid, p_instance uuid, p_agent text, p_channel text, p_to text, p_contact_key text, p_subject text, p_body text,
  p_key text, p_credits integer, p_reason text, p_cap_messages integer, p_cap_days integer, p_daily_cap integer)
 returns table (result text, outbox_id uuid, outbox_status text)
 language plpgsql security definer set search_path to '' as $$
declare v_id uuid; v_status text; v_addr text;
begin
  perform pg_advisory_xact_lock(hashtextextended('agent_credits:' || p_store::text, 0));
  select o.id, o.status into v_id, v_status from public.agent_messages_outbox o where o.idempotency_key = p_key;
  if found then return query select 'duplicate'::text, v_id, v_status; return; end if;

  v_addr := case when p_channel = 'email' then lower(trim(p_to)) else trim(p_to) end;
  if exists (select 1 from public.agent_optouts where store_id = p_store and channel in (p_channel, case when p_channel = 'sms' then 'whatsapp' when p_channel = 'whatsapp' then 'sms' else p_channel end)
             and address_hash = encode(sha256(convert_to(v_addr, 'UTF8')), 'hex')) then
    return query select 'opted_out'::text, null::uuid, null::text; return;
  end if;
  if (select count(*) from public.agent_messages_outbox where store_id = p_store and contact_key = p_contact_key and status <> 'failed'
        and created_at > now() - make_interval(days => p_cap_days)) >= p_cap_messages then
    return query select 'frequency_cap'::text, null::uuid, null::text; return;
  end if;
  -- The India day (UTC+5:30)
  if (select count(*) from public.agent_messages_outbox where instance_id = p_instance and status <> 'failed'
        and created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')) >= p_daily_cap then
    return query select 'daily_cap'::text, null::uuid, null::text; return;
  end if;
  if p_credits > 0 and public.agent_credit_balance(p_store) < p_credits then
    return query select 'no_credits'::text, null::uuid, null::text; return;
  end if;

  insert into public.agent_messages_outbox (store_id, instance_id, agent_id, channel, to_address, contact_key, subject, body, credits, credit_reason, idempotency_key)
  values (p_store, p_instance, p_agent, p_channel, v_addr, p_contact_key, p_subject, p_body, p_credits, p_reason, p_key)
  returning id into v_id;
  if p_credits > 0 then
    insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key, ref)
    values (p_store, p_agent, -p_credits, 'charge', p_reason, 'charge:' || p_key, v_id::text);
  end if;
  return query select 'reserved'::text, v_id, 'pending'::text;
end $$;

/** Records how a reserved message went. A failure gives its credits back (once). */
create or replace function public.agent_outbox_finish(p_id uuid, p_status text, p_provider_id text default null, p_error text default null)
 returns void language plpgsql security definer set search_path to '' as $$
declare o public.agent_messages_outbox%rowtype;
begin
  update public.agent_messages_outbox
     set status = p_status, provider_message_id = coalesce(p_provider_id, provider_message_id), error = left(p_error, 500),
         sent_at = case when p_status in ('sent', 'queued') then now() else sent_at end
   where id = p_id returning * into o;
  if not found then return; end if;
  if p_status = 'failed' and o.credits > 0 then
    insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key, ref)
    values (o.store_id, o.agent_id, o.credits, 'release', 'Message failed', 'release:' || o.idempotency_key, o.id::text)
    on conflict (idempotency_key) do nothing;
  end if;
end $$;

/**
 * Claims up to p_limit due jobs (FOR UPDATE SKIP LOCKED, so two cron ticks never take the same
 * job) and takes each one's instance lock, so runs of one agent instance never overlap. Jobs whose
 * lease ran out (a Worker that died mid-run) are claimed again.
 */
create or replace function public.agent_claim_jobs(p_limit integer, p_lease_seconds integer)
 returns setof public.agent_jobs language plpgsql security definer set search_path to '' as $$
declare j public.agent_jobs%rowtype; v_taken integer := 0;
begin
  if not (select runs_enabled from public.agent_platform_settings where id) then return; end if;
  for j in
    select * from public.agent_jobs
     where (status = 'queued' and run_at <= now()) or (status = 'running' and locked_until < now())
     order by run_at
     for update skip locked
     limit p_limit * 4
  loop
    exit when v_taken >= p_limit;
    if j.instance_id is not null then
      update public.agent_instances set run_lock_until = now() + make_interval(secs => p_lease_seconds)
       where id = j.instance_id and (run_lock_until is null or run_lock_until < now() or exists (select 1 from public.agent_jobs x where x.id = j.id and x.status = 'running'));
      if not found then continue; end if;
    end if;
    update public.agent_jobs set status = 'running', attempts = attempts + 1, locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
     where id = j.id returning * into j;
    v_taken := v_taken + 1;
    return next j;
  end loop;
end $$;

/** Claims one job by id (a "Run now" or dry run started from the app), with the same instance lock */
create or replace function public.agent_claim_job(p_id uuid, p_lease_seconds integer)
 returns setof public.agent_jobs language plpgsql security definer set search_path to '' as $$
declare j public.agent_jobs%rowtype;
begin
  if not (select runs_enabled from public.agent_platform_settings where id) then return; end if;
  select * into j from public.agent_jobs where id = p_id and status = 'queued' for update skip locked;
  if not found then return; end if;
  if j.instance_id is not null then
    update public.agent_instances set run_lock_until = now() + make_interval(secs => p_lease_seconds)
     where id = j.instance_id and (run_lock_until is null or run_lock_until < now());
    if not found then return; end if;
  end if;
  update public.agent_jobs set status = 'running', attempts = attempts + 1, locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
   where id = j.id returning * into j;
  return next j;
end $$;

/** Ends a job: done, or retried with backoff, or dead after max_attempts (Admin's dead-letter list). */
create or replace function public.agent_finish_job(p_id uuid, p_ok boolean, p_error text default null, p_retry_seconds integer default null)
 returns text language plpgsql security definer set search_path to '' as $$
declare j public.agent_jobs%rowtype; v_status text;
begin
  select * into j from public.agent_jobs where id = p_id for update;
  if not found then return 'missing'; end if;
  v_status := case when p_ok then 'done' when j.attempts >= j.max_attempts then 'dead' else 'queued' end;
  update public.agent_jobs
     set status = v_status, last_error = left(p_error, 500), locked_until = null, updated_at = now(),
         run_at = case when v_status = 'queued' then now() + make_interval(secs => coalesce(p_retry_seconds, least(3600, 60 * power(2, j.attempts)::integer))) else run_at end
   where id = p_id;
  if j.instance_id is not null then update public.agent_instances set run_lock_until = null where id = j.instance_id; end if;
  return v_status;
end $$;

/** "I need this": anyone (signed in or not) may ask once per agent and email */
create or replace function public.agent_request_demand(p_agent text, p_email text, p_mobile text default null, p_note text default null, p_store uuid default null)
 returns void language plpgsql security definer set search_path to '' as $$
declare v_store uuid;
begin
  if not exists (select 1 from public.agent_catalog where id = p_agent and status in ('live', 'coming_soon')) then
    raise exception 'agent_not_found' using errcode = 'P0002';
  end if;
  -- A store is recorded only when the caller can open it
  if p_store is not null and (select auth.uid()) is not null and public.store_can(p_store, 'any') then v_store := p_store; end if;
  insert into public.agent_demand_requests (agent_id, store_id, user_id, email, mobile, note)
  values (p_agent, v_store, (select auth.uid()), lower(trim(p_email)), nullif(trim(coalesce(p_mobile, '')), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (agent_id, lower(email)) do update set note = coalesce(excluded.note, public.agent_demand_requests.note), mobile = coalesce(excluded.mobile, public.agent_demand_requests.mobile);
end $$;

revoke all on function public.agent_credit_balance(uuid), public.agent_grant_credits(uuid, text, integer, text, text, text, uuid),
  public.agent_charge_credits(uuid, text, integer, text, text),
  public.agent_outbox_reserve(uuid, uuid, text, text, text, text, text, text, text, integer, text, integer, integer, integer),
  public.agent_outbox_finish(uuid, text, text, text), public.agent_claim_jobs(integer, integer), public.agent_claim_job(uuid, integer), public.agent_finish_job(uuid, boolean, text, integer),
  public.agent_ledger_append_only() from public, anon, authenticated;
grant execute on function public.agent_credit_balance(uuid), public.agent_grant_credits(uuid, text, integer, text, text, text, uuid),
  public.agent_charge_credits(uuid, text, integer, text, text),
  public.agent_outbox_reserve(uuid, uuid, text, text, text, text, text, text, text, integer, text, integer, integer, integer),
  public.agent_outbox_finish(uuid, text, text, text), public.agent_claim_jobs(integer, integer), public.agent_claim_job(uuid, integer), public.agent_finish_job(uuid, boolean, text, integer) to service_role;
revoke all on function public.agent_request_demand(text, text, text, text, uuid) from public;
grant execute on function public.agent_request_demand(text, text, text, text, uuid) to anon, authenticated;
