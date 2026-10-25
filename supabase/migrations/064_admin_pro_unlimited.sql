-- PowerProof staff (auth app_metadata.role = 'admin') are always on Pro, and workspaces they own
-- never run out of agent credits. Charges are still written to the ledger so usage stays visible.

/* Who is staff, by user id (works without a session, e.g. from the agents' cron) ---------- */

create or replace function public.user_is_platform_admin(p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select u.raw_app_meta_data ->> 'role' = 'admin' from auth.users u where u.id = p_user), false)
$function$;

/** The workspace that holds this store is owned by staff */
create or replace function public.store_unlimited_credits(p_store uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select public.user_is_platform_admin(w.owner_id) from public.stores s join public.workspaces w on w.id = s.workspace_id where s.id = p_store), false)
$function$;

/* 1. Always Pro --------------------------------------------------------------------- */

update public.profiles p set plan = 'pro' where public.user_is_platform_admin(p.id) and p.plan <> 'pro';

create or replace function public.profiles_admin_pro()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if public.user_is_platform_admin(new.id) then new.plan := 'pro'; end if;
  return new;
end $function$;

drop trigger if exists profiles_admin_pro on public.profiles;
create trigger profiles_admin_pro before insert or update of plan on public.profiles
  for each row execute function public.profiles_admin_pro();

/* 2. Unlimited credits ---------------------------------------------------------------- */

-- The top bar shows anything this large as "Unlimited"
create or replace function public.agent_credit_balance(p_store uuid)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when public.store_unlimited_credits(p_store) then 2147483647 else
    (select coalesce(sum(l.delta), 0)::integer from public.agent_credit_ledger l
      where l.store_id in (select s2.id from public.stores s1 join public.stores s2 on s2.workspace_id = s1.workspace_id where s1.id = p_store))
  end
$function$;

create or replace function public.agent_charge_credits(p_store uuid, p_agent text, p_n integer, p_reason text, p_key text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.stores where id = p_store;
  -- One lock per workspace: two stores can't spend the same credits at once
  perform pg_advisory_xact_lock(hashtextextended('agent_credits:' || coalesce(v_ws, p_store)::text, 0));
  if exists (select 1 from public.agent_credit_ledger where idempotency_key = p_key) then return 'duplicate'; end if;
  if public.store_unlimited_credits(p_store) then
    -- Staff: nothing is taken, the use is still recorded
    insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key) values (p_store, p_agent, p_n, 'admin_grant', 'Unlimited (staff)', p_key || ':grant');
    insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key) values (p_store, p_agent, -p_n, 'charge', p_reason, p_key);
    return 'charged';
  end if;
  if public.agent_credit_balance(p_store) < p_n then return 'no_credits'; end if;
  insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key) values (p_store, p_agent, -p_n, 'charge', p_reason, p_key);
  return 'charged';
end $function$;

create or replace function public.workspace_credits(p_workspace uuid)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when public.workspace_can(p_workspace, 'any') then
    case when (select public.user_is_platform_admin(w.owner_id) from public.workspaces w where w.id = p_workspace) then 2147483647 else
      (select coalesce(sum(l.delta), 0)::integer from public.agent_credit_ledger l join public.stores s on s.id = l.store_id where s.workspace_id = p_workspace)
    end
  end
$function$;

revoke execute on function public.user_is_platform_admin(uuid), public.store_unlimited_credits(uuid), public.profiles_admin_pro() from public, anon, authenticated;
