-- 063: Workspaces. A person creates a workspace, not a store: the workspace holds its stores (and
-- through them products, marketplace deals and agents), one team and one pool of agent credits.
--
-- * workspaces: one owner each. The owner owns every store in it (stores.owner_id stays the
--   workspace owner, so payouts, billing and plan limits keep following that person).
-- * store_members becomes workspace_members: a member's role and areas apply to every store in
--   the workspace. New areas: agents, marketplace. Seats are unlimited on every plan.
-- * store_can() answers for a store through its workspace; workspace_can() for the workspace.
-- * Agent credits are pooled: a store's balance is its workspace's balance.

/* 1. Workspaces ------------------------------------------------------------------- */

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspaces_owner on public.workspaces (owner_id);
drop trigger if exists workspaces_updated on public.workspaces;
create trigger workspaces_updated before update on public.workspaces for each row execute function public.set_updated_at();

-- Every owner gets one workspace holding the stores they have today
insert into public.workspaces (owner_id, name)
select p.id, left(coalesce(nullif(btrim(p.full_name), ''), split_part(p.email::text, '@', 1)) || '''s workspace', 60)
  from public.profiles p
 where exists (select 1 from public.stores s where s.owner_id = p.id)
   and not exists (select 1 from public.workspaces w where w.owner_id = p.id);

-- No action (checked at the end of the statement): an empty workspace can be deleted, one with
-- stores can't, and deleting an account still takes its workspaces and stores together
alter table public.stores add column if not exists workspace_id uuid references public.workspaces(id);
update public.stores s set workspace_id = (select w.id from public.workspaces w where w.owner_id = s.owner_id order by w.created_at limit 1)
 where s.workspace_id is null;
alter table public.stores alter column workspace_id set not null;
create index if not exists stores_workspace on public.stores (workspace_id);

/**
 * A store always sits in a workspace its owner owns. Without one given, it goes into the owner's
 * first workspace (made on the spot if they have none).
 */
create or replace function public.store_workspace_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  -- A store that changes hands without being placed goes to the new owner's first workspace
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id and new.workspace_id = old.workspace_id then
    new.workspace_id := null;
  end if;
  if new.workspace_id is null then
    select w.id into new.workspace_id from public.workspaces w where w.owner_id = new.owner_id order by w.created_at limit 1;
    if new.workspace_id is null then
      insert into public.workspaces (owner_id, name)
      select new.owner_id, left(coalesce(nullif(btrim(p.full_name), ''), split_part(p.email::text, '@', 1)) || '''s workspace', 60)
        from public.profiles p where p.id = new.owner_id
      returning id into new.workspace_id;
    end if;
  end if;
  if not exists (select 1 from public.workspaces w where w.id = new.workspace_id and w.owner_id = new.owner_id) then
    raise exception 'workspace_not_yours' using errcode = '42501';
  end if;
  return new;
end $function$;
drop trigger if exists trg_store_workspace on public.stores;
create trigger trg_store_workspace before insert or update of workspace_id, owner_id on public.stores
  for each row execute function public.store_workspace_guard();

/* 2. Members move from stores to workspaces --------------------------------------- */

alter table public.store_members rename to workspace_members;
alter table public.workspace_members add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.workspace_members m set workspace_id = s.workspace_id from public.stores s where s.id = m.store_id and m.workspace_id is null;
-- Someone on two stores of one workspace keeps one row: the widest one
delete from public.workspace_members a using public.workspace_members b
 where a.workspace_id = b.workspace_id and a.email = b.email and a.id <> b.id
   and (a.role = 'member' and b.role = 'admin' or (a.role = b.role and (a.status, a.created_at, a.id::text) < (b.status, b.created_at, b.id::text)));
-- Members of the owner's own workspace who are the owner are dropped (the owner isn't a member row)
delete from public.workspace_members m using public.workspaces w where w.id = m.workspace_id and m.user_id = w.owner_id;
alter table public.workspace_members alter column workspace_id set not null;
-- The old policy reads store_id; the new one is added below
drop policy if exists store_members_read on public.workspace_members;
alter table public.workspace_members drop constraint if exists store_members_store_id_email_key;
drop index if exists public.store_members_store_user;
alter table public.workspace_members drop column store_id;
alter table public.workspace_members add constraint workspace_members_workspace_email_key unique (workspace_id, email);
create unique index if not exists workspace_members_workspace_user on public.workspace_members (workspace_id, user_id) where user_id is not null;
alter index if exists public.store_members_user rename to workspace_members_user;
alter index if exists public.store_members_invited_by rename to workspace_members_invited_by;
alter index if exists public.store_members_token rename to workspace_members_token;
alter table public.workspace_members rename constraint store_members_pkey to workspace_members_pkey;
alter table public.workspace_members rename constraint store_members_email_check to workspace_members_email_check;
alter table public.workspace_members rename constraint store_members_role_check to workspace_members_role_check;
alter table public.workspace_members rename constraint store_members_status_check to workspace_members_status_check;
alter table public.workspace_members rename constraint store_members_user_id_fkey to workspace_members_user_id_fkey;
alter table public.workspace_members rename constraint store_members_invited_by_fkey to workspace_members_invited_by_fkey;
alter table public.workspace_members drop constraint if exists store_members_areas_check;
alter table public.workspace_members add constraint workspace_members_areas_check
  check (areas <@ array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business', 'agents', 'marketplace']::text[]);
alter trigger store_members_updated on public.workspace_members rename to workspace_members_updated;

-- Seats: invite as many people as you like, on every plan
update public.plan_limits set team_seats = null;

/* 3. Who may do what -------------------------------------------------------------- */

/**
 * Whether the signed-in person may work on this part of a workspace. The owner may do everything;
 * a joined admin every area plus 'team'; a member the areas they were given. 'any' = any access.
 */
create or replace function public.workspace_can(p_workspace uuid, p_area text default 'any')
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.workspaces w where w.id = p_workspace and w.owner_id = (select auth.uid()))
      or exists (select 1 from public.workspace_members m
                  where m.workspace_id = p_workspace and m.user_id = (select auth.uid()) and m.status = 'active'
                    and (p_area = 'any' or m.role = 'admin' or p_area = any (m.areas)))
$function$;

/** The same question for one store: asked of the workspace it sits in */
create or replace function public.store_can(p_store uuid, p_area text default 'any')
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.stores s where s.id = p_store and s.owner_id = (select auth.uid()))
      or exists (select 1 from public.stores s join public.workspace_members m on m.workspace_id = s.workspace_id
                  where s.id = p_store and m.user_id = (select auth.uid()) and m.status = 'active'
                    and (p_area = 'any' or m.role = 'admin' or p_area = any (m.areas)))
$function$;

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select, insert, delete on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces for select to authenticated
  using (public.workspace_can(id, 'any') or (select public.is_admin()));
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.workspace_can(id, 'team')) with check (public.workspace_can(id, 'team'));
-- Only an empty workspace can go (its stores block the delete)
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.workspace_members from anon, authenticated;
grant select (id, workspace_id, email, user_id, role, areas, status, invited_at, expires_at, accepted_at, created_at) on public.workspace_members to authenticated;
drop policy if exists workspace_members_read on public.workspace_members;
create policy workspace_members_read on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or public.workspace_can(workspace_id, 'team') or (select public.is_admin()));

-- Marketplace deals have their own area now (coupons and deal paths stay under Offers)
drop policy if exists deals_owner_all on public.marketplace_deals;
create policy deals_owner_all on public.marketplace_deals for all to authenticated
  using (public.store_can(store_id, 'marketplace') or public.is_admin())
  with check (public.store_can(store_id, 'marketplace') and exists (select 1 from public.products p where p.id = marketplace_deals.product_id and p.store_id = marketplace_deals.store_id));

/* 4. Lists ------------------------------------------------------------------------ */

/** The workspaces the signed-in person can open: their own, then the ones they joined */
create or replace function public.my_workspaces()
 returns table (id uuid, name text, created_at timestamptz, role text, areas text[], owner_plan text, stores integer)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select t.id, t.name, t.created_at, t.role, t.areas, t.owner_plan, (select count(*)::integer from public.stores s where s.workspace_id = t.id) from (
    select w.id, w.name, w.created_at, 'owner'::text as role,
           array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business', 'agents', 'marketplace']::text[] as areas, p.plan::text as owner_plan
      from public.workspaces w join public.profiles p on p.id = w.owner_id
     where w.owner_id = (select auth.uid())
    union all
    select w.id, w.name, coalesce(m.accepted_at, m.created_at), m.role,
           case when m.role = 'admin' then array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business', 'agents', 'marketplace']::text[] else m.areas end, p.plan::text
      from public.workspace_members m join public.workspaces w on w.id = m.workspace_id join public.profiles p on p.id = w.owner_id
     where m.user_id = (select auth.uid()) and m.status = 'active' and w.owner_id <> m.user_id
  ) t
  order by (t.role = 'owner') desc, t.created_at
$function$;

drop function if exists public.my_stores();
/** The stores the signed-in person can open, with the workspace each sits in and their access there */
create or replace function public.my_stores()
 returns table (id uuid, name text, slug text, brand_color text, created_at timestamptz, role text, areas text[], owner_plan text, workspace_id uuid, workspace_name text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select s.id, s.name, s.slug::text, s.brand_color, s.created_at, w.role, w.areas, w.owner_plan, w.id, w.name
    from public.my_workspaces() w join public.stores s on s.workspace_id = w.id
   order by (w.role = 'owner') desc, w.created_at, s.created_at
$function$;

/* 5. Team ------------------------------------------------------------------------- */

drop function if exists public.team_list(uuid);
drop function if exists public.team_invite(uuid, text, text, text[]);

/** Everyone in a workspace, owner first. For the owner and admins. */
create or replace function public.team_list(p_workspace uuid)
 returns table (id uuid, email text, name text, role text, areas text[], status text, invited_at timestamptz, expires_at timestamptz, accepted_at timestamptz, last_seen_at timestamptz, is_you boolean)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not public.workspace_can(p_workspace, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select t.mid, t.memail, t.mname, t.mrole, t.mareas, t.mstatus, t.minvited, t.mexpires, t.maccepted, t.mseen, t.myou from (
      select null::uuid as mid, p.email::text as memail, p.full_name as mname, 'owner'::text as mrole, '{}'::text[] as mareas, 'active'::text as mstatus,
             w.created_at as minvited, null::timestamptz as mexpires, w.created_at as maccepted, p.last_seen_at as mseen, p.id = (select auth.uid()) as myou
        from public.workspaces w join public.profiles p on p.id = w.owner_id where w.id = p_workspace
      union all
      select m.id, m.email::text, p.full_name, m.role, m.areas, m.status, m.invited_at, m.expires_at, m.accepted_at, p.last_seen_at, coalesce(m.user_id = (select auth.uid()), false)
        from public.workspace_members m left join public.profiles p on p.id = m.user_id
       where m.workspace_id = p_workspace
    ) t
    order by (t.mrole = 'owner') desc, t.mstatus, t.minvited;
end $function$;

/** Invites someone by email (or sends a fresh link to someone already invited). Returns the link's secret once. */
create or replace function public.team_invite(p_workspace uuid, p_email text, p_role text, p_areas text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid(); v_owner uuid; v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text; v_id uuid; v_areas text[]; m public.workspace_members%rowtype;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  if not public.workspace_can(p_workspace, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role' using errcode = '22023'; end if;
  select w.owner_id into v_owner from public.workspaces w where w.id = p_workspace;
  if p_role = 'admin' and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  v_areas := array(select distinct a from unnest(coalesce(p_areas, '{}')) a
                    where a = any (array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business', 'agents', 'marketplace']) order by a);
  if p_role = 'member' and coalesce(array_length(v_areas, 1), 0) = 0 then raise exception 'no_areas' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'bad_email' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles p where p.id = v_owner and lower(p.email::text) = v_email) then raise exception 'is_owner' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('team:' || p_workspace::text, 0));
  select * into m from public.workspace_members where workspace_id = p_workspace and email = v_email::extensions.citext;
  if found then
    if m.status = 'active' then raise exception 'already_member' using errcode = '23505'; end if;
    if m.role = 'admin' and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.workspace_members (workspace_id, email, role, areas, status, token_hash, invited_by, invited_at, expires_at)
  values (p_workspace, v_email, p_role, case when p_role = 'admin' then '{}'::text[] else v_areas end, 'invited',
          encode(extensions.digest(v_token, 'sha256'), 'hex'), uid, now(), now() + interval '7 days')
  on conflict (workspace_id, email) do update
    set role = excluded.role, areas = excluded.areas, token_hash = excluded.token_hash, invited_by = excluded.invited_by,
        invited_at = excluded.invited_at, expires_at = excluded.expires_at
  returning workspace_members.id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email);
end $function$;

/** What an invite link is for, so the page can say it before anyone signs in. No secrets. */
create or replace function public.team_invite_info(p_token text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'workspaceName', w.name, 'inviter', coalesce(nullif(ip.full_name, ''), 'The workspace owner'), 'email', m.email::text,
    'role', m.role, 'areas', to_jsonb(m.areas), 'expired', m.expires_at < now(),
    'stores', (select count(*) from public.stores s where s.workspace_id = w.id))
    from public.workspace_members m join public.workspaces w on w.id = m.workspace_id left join public.profiles ip on ip.id = m.invited_by
   where m.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and m.status = 'invited'
$function$;

/** Joins the workspace. Only the person signed in with the invited email can. Returns its first store. */
create or replace function public.team_accept(p_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); v_email text; m public.workspace_members%rowtype; v_store uuid;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  select * into m from public.workspace_members where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  if m.expires_at < now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  select lower(p.email::text) into v_email from public.profiles p where p.id = uid;
  if v_email is distinct from lower(m.email::text) then raise exception 'wrong_account' using errcode = '42501'; end if;
  if exists (select 1 from public.workspaces w where w.id = m.workspace_id and w.owner_id = uid) then raise exception 'is_owner' using errcode = '22023'; end if;
  update public.workspace_members set user_id = uid, status = 'active', accepted_at = now(), token_hash = null, expires_at = null where id = m.id;
  select s.id into v_store from public.stores s where s.workspace_id = m.workspace_id order by s.created_at limit 1;
  return v_store;
end $function$;

/** Changes what someone can do. Admins can change members; only the owner can make or change admins. */
create or replace function public.team_update(p_member uuid, p_role text, p_areas text[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); m public.workspace_members%rowtype; v_owner uuid; v_areas text[];
begin
  select * into m from public.workspace_members where id = p_member for update;
  if not found or not public.workspace_can(m.workspace_id, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
  select w.owner_id into v_owner from public.workspaces w where w.id = m.workspace_id;
  if p_role not in ('admin', 'member') then raise exception 'bad_role' using errcode = '22023'; end if;
  if (m.role = 'admin' or p_role = 'admin' or m.user_id = uid) and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  v_areas := array(select distinct a from unnest(coalesce(p_areas, '{}')) a
                    where a = any (array['catalog', 'orders', 'design', 'marketing', 'analytics', 'business', 'agents', 'marketplace']) order by a);
  if p_role = 'member' and coalesce(array_length(v_areas, 1), 0) = 0 then raise exception 'no_areas' using errcode = '22023'; end if;
  update public.workspace_members set role = p_role, areas = case when p_role = 'admin' then '{}'::text[] else v_areas end where id = m.id;
end $function$;

/** Removes someone or cancels their invite. Anyone can leave a workspace they joined. */
create or replace function public.team_remove(p_member uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); m public.workspace_members%rowtype; v_owner uuid;
begin
  select * into m from public.workspace_members where id = p_member for update;
  if not found then return; end if;
  if m.user_id is distinct from uid then
    if not public.workspace_can(m.workspace_id, 'team') then raise exception 'not_allowed' using errcode = '42501'; end if;
    select w.owner_id into v_owner from public.workspaces w where w.id = m.workspace_id;
    if m.role = 'admin' and v_owner <> uid then raise exception 'owner_only' using errcode = '42501'; end if;
  end if;
  delete from public.workspace_members where id = m.id;
end $function$;

/* 6. Store hand-over: the store moves into the new owner's workspace -------------- */

create or replace function public.store_claim_accept(p_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid(); v_email text; c public.store_claims%rowtype; v_old uuid; v_old_email text; v_lim int; v_cnt int; v_blocker text; v_ws uuid;
begin
  if uid is null then raise exception 'signed_out' using errcode = '42501'; end if;
  select * into c from public.store_claims where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and status = 'pending' for update;
  if not found then raise exception 'claim_not_found' using errcode = 'P0002'; end if;
  if c.expires_at < now() then raise exception 'claim_expired' using errcode = '22023'; end if;
  select lower(p.email::text) into v_email from public.profiles p where p.id = uid;
  if v_email is distinct from lower(c.email::text) then raise exception 'wrong_account' using errcode = '42501'; end if;
  select owner_id into v_old from public.stores where id = c.store_id for update;
  if v_old = uid then raise exception 'is_owner' using errcode = '22023'; end if;
  v_blocker := public.store_claim_blocker(c.store_id);
  if v_blocker is not null then raise exception '%', v_blocker using errcode = 'P0001'; end if;
  select l.max_stores into v_lim from public.plan_limits l join public.profiles p on p.plan = l.plan where p.id = uid;
  select count(*) into v_cnt from public.stores where owner_id = uid;
  if v_lim is not null and v_cnt >= v_lim then raise exception 'plan_limit_stores' using errcode = 'P0001'; end if;

  -- Into the new owner's first workspace (made for them if they have none)
  select w.id into v_ws from public.workspaces w where w.owner_id = uid order by w.created_at limit 1;
  if v_ws is null then
    insert into public.workspaces (owner_id, name)
    select uid, left(coalesce(nullif(btrim(p.full_name), ''), split_part(p.email::text, '@', 1)) || '''s workspace', 60) from public.profiles p where p.id = uid
    returning id into v_ws;
  end if;

  perform set_config('powerproof.store_claim', c.store_id::text, true);
  update public.stores
     set owner_id = uid, workspace_id = v_ws, legal_name = null, invoice_name = null, company_address = null, gstin = null, pan = null, business_type = null, support_email = null
   where id = c.store_id;
  perform set_config('powerproof.store_claim', '', true);

  -- Keeping the previous owner on means an Admin seat in the new owner's workspace
  if c.kind = 'transfer' and c.keep_previous then
    select p.email::text into v_old_email from public.profiles p where p.id = v_old;
    insert into public.workspace_members (workspace_id, email, user_id, role, areas, status, invited_by, invited_at, accepted_at)
    values (v_ws, v_old_email, v_old, 'admin', '{}', 'active', uid, now(), now())
    on conflict (workspace_id, email) do update set user_id = excluded.user_id, role = 'admin', areas = '{}', status = 'active', token_hash = null, expires_at = null, accepted_at = now();
  end if;
  update public.store_claims set status = 'accepted', token_hash = null, accepted_at = now(), accepted_by = uid where id = c.id;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (uid, 'store_claimed', 'store', c.store_id::text, jsonb_build_object('kind', c.kind, 'from', v_old));
  return c.store_id;
end $function$;

/* 7. One pool of agent credits per workspace -------------------------------------- */

create or replace function public.agent_credit_balance(p_store uuid)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(sum(l.delta), 0)::integer from public.agent_credit_ledger l
   where l.store_id in (select s2.id from public.stores s1 join public.stores s2 on s2.workspace_id = s1.workspace_id where s1.id = p_store)
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
  if public.agent_credit_balance(p_store) < p_n then return 'no_credits'; end if;
  insert into public.agent_credit_ledger (store_id, agent_id, delta, kind, reason, idempotency_key) values (p_store, p_agent, -p_n, 'charge', p_reason, p_key);
  return 'charged';
end $function$;

/** The workspace's credits left, for the top bar. Anyone in the workspace may see it. */
create or replace function public.workspace_credits(p_workspace uuid)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when public.workspace_can(p_workspace, 'any') then
    (select coalesce(sum(l.delta), 0)::integer from public.agent_credit_ledger l join public.stores s on s.id = l.store_id where s.workspace_id = p_workspace)
  end
$function$;

/* Who may call what -------------------------------------------------------------- */

revoke execute on function public.workspace_can(uuid, text), public.my_workspaces(), public.my_stores(), public.team_list(uuid),
  public.team_invite(uuid, text, text, text[]), public.workspace_credits(uuid), public.store_workspace_guard() from public, anon;
grant execute on function public.workspace_can(uuid, text), public.my_workspaces(), public.my_stores(), public.team_list(uuid),
  public.team_invite(uuid, text, text, text[]), public.workspace_credits(uuid) to authenticated;
revoke execute on function public.store_workspace_guard() from authenticated;
