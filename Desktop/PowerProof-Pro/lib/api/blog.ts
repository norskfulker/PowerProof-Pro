import { sb } from "../supabase/browser";
import type { BlogPost } from "../types";
import { ApiError } from "./client";
import { must } from "./live/errors";

/**
 * The platform blog. Everyone reads published posts; only staff write, through the
 * admin_blog_* database functions (see lib/api/admin.ts).
 */

const COLS = "id, slug, title, excerpt, body, cover_src, cover_kind, cover_alt, status, author, published_at, created_at, updated_at";

interface Row {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_src: string | null;
  cover_kind: string | null;
  cover_alt: string | null;
  status: string;
  author: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function blogFrom(r: Row): BlogPost {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? "",
    body: r.body ?? "",
    coverSrc: r.cover_src ?? "",
    coverKind: r.cover_kind === "video" ? "video" : "image",
    coverAlt: r.cover_alt ?? "",
    status: r.status === "published" ? "published" : "draft",
    author: r.author || "PowerProof",
    publishedAt: r.published_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Published posts, newest first. An empty list means none yet (or the blog table isn't live). */
export async function getBlogPosts(limit = 50): Promise<BlogPost[]> {
  try {
    const rows = must(
      await sb().from("blog_posts").select(COLS).eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(limit)
    ) as Row[];
    return rows.map(blogFrom);
  } catch {
    return [];
  }
}

/** One published post by its slug. Throws not_found for drafts and misses. */
export async function getBlogPost(slug: string): Promise<BlogPost> {
  const rows = must(await sb().from("blog_posts").select(COLS).eq("slug", slug).eq("status", "published").limit(1), { notFound: "Post" }) as Row[];
  if (!rows[0]) throw new ApiError("That post isn't here.", "not_found");
  return blogFrom(rows[0]);
}

/** Every slug in use, so a new title gets a link that doesn't clash. */
export async function getBlogSlugs(): Promise<string[]> {
  try {
    const rows = must(await sb().from("blog_posts").select("slug").limit(2000)) as { slug: string }[];
    return rows.map((r) => r.slug);
  } catch {
    return [];
  }
}
