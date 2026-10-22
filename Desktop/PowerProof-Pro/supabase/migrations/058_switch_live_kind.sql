-- 058: switch a store between digital and physical in one step (only one kind is live at a time, 057).
--   switch_live_kind(store, to): every live product of the other kind goes to drafts (marked
--   paused_by_switch), then the products of `to` that an earlier switch paused go live again. When
--   none were paused, every ready draft of `to` goes live (a file for downloads, a collection for
--   things that ship). The kind is switched on for the store if it was off. All or nothing.

alter table public.products add column if not exists paused_by_switch boolean not null default false;

create or replace function public.switch_live_kind(p_store uuid, p_to text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_from text; v_paused int := 0; v_live int := 0; v_waiting int := 0; v_sells text;
begin
  if p_to not in ('digital', 'physical') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if not public.store_can(p_store, 'catalog') then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_from := case p_to when 'digital' then 'physical' else 'digital' end;
  select sells into v_sells from public.stores where id = p_store for update;
  if v_sells is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_sells <> 'both' and v_sells <> p_to then
    update public.stores set sells = 'both' where id = p_store;
  end if;

  -- The kind going away: to drafts, remembered so switching back brings exactly these back
  with paused as (
    update public.products set status = 'draft', paused_by_switch = true
     where store_id = p_store and fulfilment = v_from and status = 'live'
    returning id
  ) select count(*) into v_paused from paused;

  -- The kind coming in: what the last switch paused, else every ready draft
  if exists (select 1 from public.products where store_id = p_store and fulfilment = p_to and status = 'draft' and paused_by_switch) then
    with back as (
      update public.products p set status = 'live', paused_by_switch = false
       where p.store_id = p_store and p.fulfilment = p_to and p.status = 'draft' and p.paused_by_switch
      returning p.id
    ) select count(*) into v_live from back;
  else
    with ready as (
      update public.products p set status = 'live'
       where p.store_id = p_store and p.fulfilment = p_to and p.status = 'draft'
         and case when p_to = 'physical'
               then exists (select 1 from public.collection_items c where c.product_id = p.id)
               else exists (select 1 from public.product_files f where f.product_id = p.id) end
      returning p.id
    ) select count(*) into v_live from ready;
  end if;

  select count(*) into v_waiting from public.products where store_id = p_store and fulfilment = p_to and status = 'draft';
  return jsonb_build_object('from', v_from, 'to', p_to, 'paused', v_paused, 'live', v_live, 'drafts', v_waiting);
end $$;

revoke all on function public.switch_live_kind(uuid, text) from public, anon;
grant execute on function public.switch_live_kind(uuid, text) to authenticated;
