-- 050: Payment Chaser (agent #1) data. Additive only; chaser_* tables, keyed by store_id.
-- Browser: SELECT for the store's owner and admins (store_can(store, 'agents')). Writes go through
-- the server routes after they check access. The sender identity is the store's own invoice name
-- (stores.invoice_name, then stores.name); there is no second "business" table.
-- Rules live in agent_instances.settings (drawn from the manifest) and the static fallback wording
-- lives with the agent's code (agents/payment-chaser/templates), so there are no chaser_rules or
-- chaser_templates tables; weekly reports use the platform's agent_reports.

create table if not exists public.chaser_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200)),
  language_pref text check (language_pref in ('english', 'hinglish')),
  is_paused boolean not null default false,
  opted_out_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists chaser_customers_phone on public.chaser_customers (store_id, phone_e164) where phone_e164 is not null;
create index if not exists chaser_customers_name on public.chaser_customers (store_id, lower(name));
create index if not exists chaser_customers_email on public.chaser_customers (store_id, lower(email)) where email is not null;

create table if not exists public.chaser_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  file_name text not null default '' check (char_length(file_name) <= 200),
  source text not null check (source in ('csv', 'xlsx', 'sheet', 'manual')),
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  rows_updated integer not null default 0,
  rows_failed integer not null default 0,
  -- [{row, reason}] for skipped rows, [{row, warning}] for imported ones with a note
  error_report jsonb not null default '[]'::jsonb,
  -- Open invoices that weren't in this full upload (the owner decides whether they're paid)
  missing_invoice_ids uuid[] not null default '{}',
  is_full boolean not null default true,
  status text not null default 'open' check (status in ('open', 'done')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chaser_imports_store on public.chaser_imports (store_id, created_at desc);

create table if not exists public.chaser_invoices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.chaser_customers(id) on delete cascade,
  invoice_no text not null check (char_length(invoice_no) between 1 and 60),
  invoice_date date,
  due_date date not null,
  amount_total_minor bigint not null check (amount_total_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'open' check (status in ('open', 'paid', 'paused', 'disputed', 'written_off')),
  paid_at timestamptz,
  source text not null default 'manual' check (source in ('csv', 'xlsx', 'manual', 'sheet')),
  source_ref text,
  import_id uuid references public.chaser_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_paid_minor <= amount_total_minor),
  unique (store_id, invoice_no)
);
create index if not exists chaser_invoices_due on public.chaser_invoices (store_id, status, due_date);
create index if not exists chaser_invoices_customer on public.chaser_invoices (customer_id);

create table if not exists public.chaser_reminders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.chaser_customers(id) on delete cascade,
  invoice_ids uuid[] not null default '{}',
  stage smallint not null check (stage between 1 and 8),
  -- The chase's start (the oldest overdue due date); with customer and stage it makes the key
  anchor date not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  tone text not null check (tone in ('friendly', 'firm')),
  language text not null check (language in ('english', 'hinglish')),
  template_subject text,
  template_body text not null,
  subject text,
  body text not null check (char_length(body) <= 4000),
  facts jsonb not null default '{}'::jsonb,
  source text not null default 'fallback' check (source in ('llm', 'cache', 'fallback', 'owner')),
  edited boolean not null default false,
  status text not null default 'drafted' check (status in ('drafted', 'queued', 'approved', 'sent', 'failed', 'skipped', 'snoozed')),
  scheduled_for timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  idempotency_key text not null unique,
  run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chaser_reminders_schedule on public.chaser_reminders (store_id, scheduled_for, status);
create index if not exists chaser_reminders_customer on public.chaser_reminders (store_id, customer_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['chaser_customers', 'chaser_imports', 'chaser_invoices', 'chaser_reminders']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_store_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.store_can(store_id, ''agents'')) or (select public.is_admin()))', t || '_store_read', t);
  end loop;
end $$;
