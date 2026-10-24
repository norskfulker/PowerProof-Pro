-- Agents: store isolation and access checks (done-when #9). Run on a Supabase BRANCH or local stack
-- after migrations 049–051, as the postgres role (SQL editor or psql). Everything happens inside one
-- transaction that is rolled back, so it leaves nothing behind. Any failed check raises an error.
--
--   psql "$BRANCH_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/agents_rls.sql
--
-- Fake people and stores only (example.test addresses).

begin;

do $$
declare
  ua uuid := gen_random_uuid();  -- owner of store A
  ub uuid := gen_random_uuid();  -- owner of store B
  um uuid := gen_random_uuid();  -- a Limited team member of store A (no 'agents' area possible)
  sa uuid := gen_random_uuid();
  sb uuid := gen_random_uuid();
  ca uuid; cb uuid; ia uuid; ib uuid;
  n integer;
begin
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (ua, 'owner-a@example.test', 'authenticated', 'authenticated', '{}', '{}', now(), now()),
         (ub, 'owner-b@example.test', 'authenticated', 'authenticated', '{}', '{}', now(), now()),
         (um, 'member-a@example.test', 'authenticated', 'authenticated', '{}', '{}', now(), now());
  insert into public.stores (id, owner_id, name, slug) values (sa, ua, 'Test Store A', 'test-agents-rls-a-' || left(sa::text, 8)), (sb, ub, 'Test Store B', 'test-agents-rls-b-' || left(sb::text, 8));
  insert into public.store_members (store_id, email, user_id, role, areas, status) values (sa, 'member-a@example.test', um, 'member', array['catalog'], 'active');

  insert into public.agent_instances (store_id, agent_id, status) values (sa, 'payment-chaser', 'trial') returning id into ia;
  insert into public.agent_instances (store_id, agent_id, status) values (sb, 'payment-chaser', 'trial') returning id into ib;
  insert into public.chaser_customers (store_id, name, phone_e164) values (sa, 'Customer of A', '+919000000001') returning id into ca;
  insert into public.chaser_customers (store_id, name, phone_e164) values (sb, 'Customer of B', '+919000000002') returning id into cb;
  insert into public.chaser_invoices (store_id, customer_id, invoice_no, due_date, amount_total_minor) values (sa, ca, 'A-1', current_date - 3, 100000), (sb, cb, 'B-1', current_date - 3, 200000);
  insert into public.agent_connections (store_id, type, label, secret_enc) values (sa, 'google_sheets', 'Sheet A', 'v1.sealed.secret.value');
  perform public.agent_grant_credits(sa, 'payment-chaser', 25, 'trial_grant', 'rls-test-trial-a');

  -- Owner A sees A's rows only
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chaser_invoices;               if n <> 1 then raise exception 'A sees % invoices, expected 1', n; end if;
  select count(*) into n from public.chaser_invoices where store_id = sb; if n <> 0 then raise exception 'A can read B''s invoices'; end if;
  select count(*) into n from public.chaser_customers where store_id = sb; if n <> 0 then raise exception 'A can read B''s customers'; end if;
  select count(*) into n from public.agent_instances where store_id = sb; if n <> 0 then raise exception 'A can read B''s agents'; end if;
  select count(*) into n from public.agent_credit_balances where store_id = sa and balance = 25; if n <> 1 then raise exception 'A can''t see its own credit balance'; end if;
  -- The sealed secret is never readable from the browser role
  begin
    perform secret_enc from public.agent_connections limit 1;
    raise exception 'secret_enc is readable by authenticated';
  exception when insufficient_privilege then null;
  end;
  -- Writes from the browser are refused everywhere (server routes only)
  begin
    insert into public.chaser_invoices (store_id, customer_id, invoice_no, due_date, amount_total_minor) values (sa, ca, 'A-2', current_date, 1);
    raise exception 'authenticated could insert an invoice';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.agent_charge_credits(sa, 'payment-chaser', 1, 'x', 'rls-test-charge');
    raise exception 'authenticated could charge credits';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- A Limited member of A without the agents area sees nothing
  perform set_config('request.jwt.claims', json_build_object('sub', um, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chaser_invoices; if n <> 0 then raise exception 'A Limited member can read agent data'; end if;
  select count(*) into n from public.agent_instances; if n <> 0 then raise exception 'A Limited member can read agents'; end if;
  reset role;

  -- Owner B sees B's rows only
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chaser_invoices where store_id = sa; if n <> 0 then raise exception 'B can read A''s invoices'; end if;
  reset role;

  -- Signed out: catalog yes, agent data no; demand requests go through the function only
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.agent_catalog where status = 'coming_soon'; if n < 1 then raise exception 'anon can''t read the catalog'; end if;
  begin
    perform 1 from public.chaser_invoices limit 1;
    raise exception 'anon can read invoices';
  exception when insufficient_privilege then null;
  end;
  perform public.agent_request_demand('loan-file-checker', 'someone@example.test', null, 'test note', null);
  reset role;

  -- Credits: idempotent, never below zero, ledger append-only
  if public.agent_charge_credits(sa, 'payment-chaser', 5, 'test', 'rls-test-k1') <> 'charged' then raise exception 'charge failed'; end if;
  if public.agent_charge_credits(sa, 'payment-chaser', 5, 'test', 'rls-test-k1') <> 'duplicate' then raise exception 'charge not idempotent'; end if;
  if public.agent_charge_credits(sa, 'payment-chaser', 100, 'test', 'rls-test-k2') <> 'no_credits' then raise exception 'overdraft allowed'; end if;
  if public.agent_credit_balance(sa) <> 20 then raise exception 'balance is %, expected 20', public.agent_credit_balance(sa); end if;
  begin
    update public.agent_credit_ledger set delta = 1000 where store_id = sa;
    raise exception 'ledger rows can be edited';
  exception when insufficient_privilege then null;
  end;

  -- Outbox: one message per key, credits charged with it, given back on failure
  perform * from public.agent_outbox_reserve(sa, ia, 'payment-chaser', 'email', 'x@example.test', ca::text, 's', 'b', 'rls-test-msg', 1, 'email_sent', 1, 3, 100);
  if (select result from public.agent_outbox_reserve(sa, ia, 'payment-chaser', 'email', 'x@example.test', ca::text, 's', 'b', 'rls-test-msg', 1, 'email_sent', 1, 3, 100)) <> 'duplicate' then raise exception 'outbox not idempotent'; end if;
  if (select result from public.agent_outbox_reserve(sa, ia, 'payment-chaser', 'email', 'x@example.test', ca::text, 's', 'b', 'rls-test-msg-2', 1, 'email_sent', 1, 3, 100)) <> 'frequency_cap' then raise exception 'frequency cap not enforced'; end if;
  if public.agent_credit_balance(sa) <> 19 then raise exception 'message wasn''t charged once'; end if;
  perform public.agent_outbox_finish((select id from public.agent_messages_outbox where idempotency_key = 'rls-test-msg'), 'failed', null, 'test');
  if public.agent_credit_balance(sa) <> 20 then raise exception 'failed message wasn''t refunded'; end if;

  -- Jobs: one claim per job, one run per instance at a time
  insert into public.agent_jobs (store_id, instance_id, kind, idempotency_key) values (sa, ia, 'run', 'rls-test-job-1'), (sa, ia, 'run', 'rls-test-job-2');
  select count(*) into n from public.agent_claim_jobs(10, 60) j where j.idempotency_key like 'rls-test-job-%';
  if n <> 1 then raise exception 'claimed % jobs of one instance at once, expected 1', n; end if;

  raise notice 'agents RLS and function checks: all passed';
end $$;

rollback;
