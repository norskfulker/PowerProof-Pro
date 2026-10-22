import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { sb } from "@/lib/supabase/browser";

/** Public pages: marketing, the blog and every live store. Refreshed hourly, not on every crawl. */
export const revalidate = 3600;

const STATIC_PAGES = ["", "/pricing", "/how-it-works", "/blog", "/login", "/signup", "/lookup"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  let stores: { slug: string; updated_at: string }[] = [];
  try {
    const r = await sb().from("stores").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(1000);
    if (!r.error) stores = (r.data ?? []) as typeof stores;
  } catch {
    /* database unreachable at build: marketing pages still list */
  }
  let posts: { slug: string; updated_at: string }[] = [];
  try {
    const r = await sb().from("blog_posts").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(1000);
    if (!r.error) posts = (r.data ?? []) as typeof posts;
  } catch {
    /* blog table not live yet: the index still lists */
  }
  return [
    ...STATIC_PAGES.map((p) => ({ url: `${base}${p || "/"}`, lastModified: now })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.updated_at) })),
    ...stores.map((s) => ({ url: `${base}/s/${s.slug}`, lastModified: new Date(s.updated_at) })),
  ];
}
