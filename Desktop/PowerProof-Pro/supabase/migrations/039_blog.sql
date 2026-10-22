-- 039: Platform blog. PowerProof staff write posts in Admin › Content › Blog; the marketing
-- site (/blog) reads them. One row per post:
--   * slug (unique, from the title), title, excerpt, body (the safe **bold** / _italic_ / [link]
--     rich text, no HTML), an optional cover photo or video (https URL), status, author and the
--     display date (published_at).
-- Reads: everyone sees published posts only. Writes go through the admin_blog_* functions below,
-- each checking is_admin() first and writing an audit_log row for anything it changes (the
-- founder console pattern from 028). No direct-write policy on purpose.

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 300),
  body text not null default '' check (char_length(body) <= 20000),
  cover_src text not null default '',
  cover_kind text not null default 'image' check (cover_kind in ('image', 'video')),
  cover_alt text not null default '' check (char_length(cover_alt) <= 200),
  status text not null default 'draft' check (status in ('draft', 'published')),
  author text not null default 'PowerProof' check (char_length(author) between 1 and 80),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_status_published_idx on public.blog_posts (status, published_at desc);

alter table public.blog_posts enable row level security;

-- Everyone reads published posts; staff read drafts through admin_blog_list below
create policy blog_posts_public_read on public.blog_posts for select to anon, authenticated
  using (status = 'published');

-- Table privileges (policies alone don't grant them): reads for everyone, writes only
-- through the SECURITY DEFINER functions below, which run with the owner's rights
grant select on public.blog_posts to anon, authenticated;

-- The console list: drafts and published, newest edited first (with the full text for editing)
create or replace function public.admin_blog_list()
returns table (id uuid, slug text, title text, excerpt text, body text, cover_src text, cover_kind text, cover_alt text, status text, author text, published_at timestamptz, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select b.id, b.slug, b.title, b.excerpt, b.body, b.cover_src, b.cover_kind, b.cover_alt, b.status, b.author, b.published_at, b.created_at, b.updated_at
      from public.blog_posts b
     order by b.updated_at desc limit 300;
end $$;

-- Creates or updates a post (p_id null for a new one). The slug must be unique; the cover, if
-- any, must be an https address. Returns the post id.
create or replace function public.admin_blog_save(
  p_id uuid, p_title text, p_slug text, p_excerpt text, p_body text,
  p_cover_src text, p_cover_kind text, p_cover_alt text,
  p_status text, p_author text, p_published_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 160 then raise exception 'title_required'; end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'slug_invalid'; end if;
  if p_status not in ('draft', 'published') then raise exception 'status_invalid'; end if;
  if p_cover_kind not in ('image', 'video') then raise exception 'cover_invalid'; end if;
  if trim(coalesce(p_cover_src, '')) <> '' and trim(p_cover_src) !~ '^https://' then raise exception 'cover_invalid'; end if;
  if char_length(coalesce(p_excerpt, '')) > 300 then raise exception 'excerpt_long'; end if;
  if char_length(coalesce(p_body, '')) > 20000 then raise exception 'body_long'; end if;
  if exists (select 1 from public.blog_posts b where b.slug = trim(p_slug) and (p_id is null or b.id <> p_id)) then
    raise exception 'slug_taken';
  end if;
  if p_id is null then
    insert into public.blog_posts (slug, title, excerpt, body, cover_src, cover_kind, cover_alt, status, author, published_at)
    values (trim(p_slug), trim(p_title), trim(coalesce(p_excerpt, '')), coalesce(p_body, ''), trim(coalesce(p_cover_src, '')), p_cover_kind,
      trim(coalesce(p_cover_alt, '')), p_status,
      case when nullif(trim(coalesce(p_author, '')), '') is null then 'PowerProof' else trim(p_author) end,
      p_published_at)
    returning id into gid;
  else
    update public.blog_posts set
      slug = trim(p_slug), title = trim(p_title), excerpt = trim(coalesce(p_excerpt, '')), body = coalesce(p_body, ''),
      cover_src = trim(coalesce(p_cover_src, '')), cover_kind = p_cover_kind, cover_alt = trim(coalesce(p_cover_alt, '')),
      status = p_status, author = case when nullif(trim(coalesce(p_author, '')), '') is null then 'PowerProof' else trim(p_author) end,
      published_at = p_published_at, updated_at = now()
    where id = p_id returning id into gid;
    if not found then raise exception 'not_found'; end if;
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_id is null then 'create_blog_post' else 'save_blog_post' end, 'blog_post', gid::text,
    jsonb_build_object('slug', trim(p_slug), 'status', p_status));
  return gid;
end $$;

-- Deletes a post entirely
create or replace function public.admin_blog_delete(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare old public.blog_posts%rowtype;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into old from public.blog_posts where id = p_id;
  if not found then raise exception 'not_found'; end if;
  delete from public.blog_posts where id = p_id;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), 'delete_blog_post', 'blog_post', p_id::text, jsonb_build_object('slug', old.slug, 'title', old.title));
end $$;

revoke all on function public.admin_blog_list() from public, anon;
revoke all on function public.admin_blog_save(uuid, text, text, text, text, text, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.admin_blog_delete(uuid) from public, anon;
grant execute on function
  public.admin_blog_list(),
  public.admin_blog_save(uuid, text, text, text, text, text, text, text, text, text, timestamptz),
  public.admin_blog_delete(uuid)
  to authenticated;
