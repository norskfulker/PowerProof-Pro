-- 062: covering indexes for the agent tables' foreign keys (performance advisor: unindexed_foreign_keys).
-- Additive only. Store deletes cascade through these, and the who-did-it columns are joined in Admin.

create index if not exists agent_action_items_done_by on public.agent_action_items (done_by);
create index if not exists agent_action_items_instance on public.agent_action_items (instance_id);
create index if not exists agent_audit_log_actor on public.agent_audit_log (actor_id);
create index if not exists agent_connections_created_by on public.agent_connections (created_by);
create index if not exists agent_consents_instance on public.agent_consents (instance_id);
create index if not exists agent_consents_store on public.agent_consents (store_id);
create index if not exists agent_consents_user on public.agent_consents (user_id);
create index if not exists agent_credit_ledger_created_by on public.agent_credit_ledger (created_by);
create index if not exists agent_demand_requests_store on public.agent_demand_requests (store_id);
create index if not exists agent_demand_requests_user on public.agent_demand_requests (user_id);
create index if not exists agent_instance_connections_store on public.agent_instance_connections (store_id);
create index if not exists agent_instances_agent on public.agent_instances (agent_id);
create index if not exists agent_instances_consent_by on public.agent_instances (consent_by);
create index if not exists agent_instances_created_by on public.agent_instances (created_by);
create index if not exists agent_jobs_run on public.agent_jobs (run_id);
create index if not exists agent_jobs_store on public.agent_jobs (store_id);
create index if not exists agent_plans_agent on public.agent_plans (agent_id);
create index if not exists agent_platform_settings_updated_by on public.agent_platform_settings (updated_by);
create index if not exists agent_reports_store on public.agent_reports (store_id);
create index if not exists agent_run_steps_store on public.agent_run_steps (store_id);
create index if not exists agent_runs_store on public.agent_runs (store_id);
create index if not exists agent_subscriptions_agent on public.agent_subscriptions (agent_id);
create index if not exists agent_subscriptions_plan on public.agent_subscriptions (plan_id);
create index if not exists agent_support_items_closed_by on public.agent_support_items (closed_by);
create index if not exists agent_support_items_instance on public.agent_support_items (instance_id);
create index if not exists agent_support_items_store on public.agent_support_items (store_id);
create index if not exists agent_support_items_user on public.agent_support_items (user_id);
create index if not exists chaser_imports_created_by on public.chaser_imports (created_by);
create index if not exists chaser_invoices_import on public.chaser_invoices (import_id);
create index if not exists chaser_reminders_customer_id on public.chaser_reminders (customer_id);
