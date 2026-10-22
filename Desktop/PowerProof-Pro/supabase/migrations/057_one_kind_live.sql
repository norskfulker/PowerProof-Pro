-- 057: a store may hold digital and physical products (056), but only one kind can be live at a time.
--   * A product can't go live while the store has live products of the other kind
--     ('live_other_kind_<kind already live>'). Move those to drafts first.
--   * Scheduled publishing skips such a product and notifies the store instead of failing.

-- The kind that's live in the store other than `p_kind` (ignoring one product), or null
create or replace function public.other_kind_live(p_store uuid, p_kind text, p_except uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.fulfilment from public.products p
   where p.store_id = p_store and p.status = 'live' and p.fulfilment <> p_kind and p.id is distinct from p_except
   limit 1
$$;
revoke all on function public.other_kind_live(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.guard_product_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_sells text; v_live text;
begin
  if new.status = 'archived' then return new; end if;
  -- Going live (or a live product changing kind or store): no live products of the other kind
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live' or new.fulfilment <> old.fulfilment or new.store_id <> old.store_id) then
    -- One at a time per store, so two products of different kinds can't go live together
    perform 1 from public.stores where id = new.store_id for update;
    v_live := public.other_kind_live(new.store_id, new.fulfilment, new.id);
    if v_live is not null then
      raise exception 'live_other_kind_%', v_live using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.fulfilment = old.fulfilment and new.status = old.status and new.store_id = old.store_id then return new; end if;
  select sells into v_sells from public.stores where id = new.store_id;
  if v_sells = 'both' then return new; end if;
  if v_sells is distinct from new.fulfilment then
    raise exception 'store_sells_%', coalesce(v_sells, 'digital') using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.run_product_schedule() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; v_live int := 0; v_draft int := 0; v_blocked int := 0; v_ready boolean; v_other text;
begin
  -- Going back to drafts first, so a product leaving can make room for one of the other kind
  with gone as (
    update public.products set status = 'draft', unpublish_at = null where unpublish_at is not null and unpublish_at <= now() and status = 'live' returning id
  ) select count(*) into v_draft from gone;
  update public.products set unpublish_at = null where unpublish_at is not null and unpublish_at <= now();

  for r in select p.* from public.products p where p.publish_at is not null and p.publish_at <= now() and p.status = 'draft' for update skip locked loop
    v_ready := case when r.fulfilment = 'physical'
      then exists (select 1 from public.collection_items c where c.product_id = r.id)
      else exists (select 1 from public.product_files f where f.product_id = r.id) end;
    v_other := public.other_kind_live(r.store_id, r.fulfilment, r.id);
    if v_ready and v_other is null then
      update public.products set status = 'live', publish_at = null where id = r.id;
      v_live := v_live + 1;
    else
      update public.products set publish_at = null where id = r.id;
      perform public.notify(r.store_id, 'scheduled', 'Didn''t go live: ' || r.title,
        case when v_other is not null then 'Your ' || v_other || ' products are live, and only one kind can be live at a time. Move them to drafts, then publish it.'
             when r.fulfilment = 'physical' then 'Put it in a collection, then publish it.'
             else 'Add the file buyers download, then publish it.' end,
        '/catalog/products/' || r.id, 'catalog', 'schedule:' || r.id || ':' || extract(epoch from now())::bigint);
      v_blocked := v_blocked + 1;
    end if;
  end loop;
  update public.products set publish_at = null where publish_at is not null and publish_at <= now() and status <> 'draft';
  return jsonb_build_object('published', v_live, 'unpublished', v_draft, 'blocked', v_blocked);
end $$;
