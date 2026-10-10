import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { formatMoney, money } from "@/lib/money";
import { aiBriefSchema } from "@/lib/pages/ai";
import type { AiEvent } from "@/lib/pages/ai";
import { aiConnected, runAiPage, type AiStoreContext, type AiStoreMedia } from "@/lib/pages/ai-run";
import { designFrom, storeFrom } from "@/lib/api/live/map";
import { sbServer } from "@/lib/supabase/server";
import type { CurrencyCode } from "@/lib/types";

/**
 * Builds a page with AI. POST { pageId, brief }. Answers with a stream of JSON lines (see AiEvent):
 * progress, each finished section, the theme, then done or error.
 *
 *   GEMINI_API_KEY  the Gemini API key (server only); GEMINI_MODEL picks the model
 *                   (default gemini-3.8-flash)
 *
 * Only the page's owner can ask, and each plan has a daily allowance (plan_limits.ai_pages_daily,
 * checked and recorded by start_ai_page). Nothing is saved here: the editor shows the result and
 * the creator keeps it or not.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Fail = { ok: false; code: "signed_out" | "invalid" | "not_found" | "not_connected" | "limit" | "unavailable"; message: string };
const fail = (body: Fail, status: number) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail({ ok: false, code: "signed_out", message: "Log in again to use AI." }, 401);

  const body = (await request.json().catch(() => null)) as { pageId?: unknown; brief?: unknown } | null;
  const parsed = aiBriefSchema.safeParse(body?.brief);
  if (!parsed.success || typeof body?.pageId !== "string") return fail({ ok: false, code: "invalid", message: parsed.success ? "Which page?" : parsed.error.issues[0].message }, 400);
  const brief = parsed.data;
  if (!aiConnected()) return fail({ ok: false, code: "not_connected", message: "AI page building isn't connected yet." }, 501);

  // The page is readable to its owner only (row level security), so this also checks ownership
  const page = (await sb.from("custom_pages").select("id, store_id, title, layout").eq("id", body.pageId).maybeSingle()).data;
  if (!page) return fail({ ok: false, code: "not_found", message: "That page isn't here any more." }, 404);
  const storeId = page.store_id;

  const bucket = sb.storage.from("store-media");
  const [storeRow, products, collections, items, reviews, infoPages, draft, library, aiLibrary] = await Promise.all([
    sb.from("stores").select("*").eq("id", storeId).single(),
    sb.from("products").select("id, slug, title, description, price_minor, currency, status").eq("store_id", storeId).eq("status", "live").order("created_at", { ascending: false }).limit(40),
    sb.from("collections").select("id, name, slug").eq("store_id", storeId).order("sort_order"),
    sb.from("collection_items").select("collection_id"),
    sb.from("reviews").select("rating, status").eq("store_id", storeId).neq("status", "hidden"),
    sb.from("store_pages").select("kind, content").eq("store_id", storeId).in("kind", ["about", "faq"]),
    sb.from("custom_page_drafts").select("data").eq("page_id", page.id).maybeSingle(),
    bucket.list(`${storeId}/media`, { limit: 60, sortBy: { column: "created_at", order: "desc" } }),
    bucket.list(`${storeId}/ai`, { limit: 20, sortBy: { column: "created_at", order: "desc" } }),
  ]);
  if (!storeRow.data) return fail({ ok: false, code: "not_found", message: "That store isn't here any more." }, 404);

  const row = storeRow.data;
  const store = storeFrom(row, { name: row.name, email: row.support_email ?? "" });
  const design = designFrom(store, row.theme, row.theme_mode);
  const ratings = (reviews.data ?? []).map((r) => r.rating);
  const counts = new Map<string, number>();
  for (const it of items.data ?? []) counts.set(it.collection_id, (counts.get(it.collection_id) ?? 0) + 1);
  const content = (kind: string) => ((infoPages.data ?? []).find((p) => p.kind === kind)?.content ?? {}) as Record<string, unknown>;
  const about = content("about");
  const faq = Array.isArray(content("faq").items) ? (content("faq").items as { q?: string; a?: string }[]) : [];
  const draftSections = (draft.data?.data as { sections?: unknown[] } | undefined)?.sections ?? (page.layout as { sections?: unknown[] } | null)?.sections ?? [];
  const live = products.data ?? [];
  const productMedia = live.length ? ((await sb.from("product_media").select("product_id, kind, url, alt, poster_url, sort_order").in("product_id", live.map((p) => p.id)).order("sort_order")).data ?? []) : [];
  const { media, covers } = mediaFrom(live, productMedia, [...(library.data ?? []).map((o) => ({ ...o, folder: "media" })), ...(aiLibrary.data ?? []).map((o) => ({ ...o, folder: "ai" }))], (path) => bucket.getPublicUrl(`${storeId}/${path}`).data.publicUrl);

  const context: AiStoreContext = {
    name: store.name,
    slug: store.slug,
    tagline: store.tagline,
    currency: store.currency,
    refundDays: store.refundDays,
    theme: design.theme,
    products: live.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      price: formatMoney(money(p.price_minor, (p.currency || store.currency) as CurrencyCode)),
      description: (p.description ?? "").replace(/\s+/g, " ").slice(0, 400),
      picture: covers.get(p.id),
    })),
    media,
    existing: brief.mode === "append" ? (draftSections as { type?: string; props?: { label?: string; headline?: string }; children?: { type?: string }[] }[]).slice(0, 20).map((n) => ({ label: String(n.props?.label || n.props?.headline || n.type || "Section").slice(0, 60), blocks: (n.children ?? []).map((c) => String(c.type ?? "")).slice(0, 8) })) : undefined,
    collections: (collections.data ?? []).filter((c) => (counts.get(c.id) ?? 0) > 0).map((c) => ({ slug: c.slug, name: c.name, productCount: counts.get(c.id) ?? 0 })),
    rating: { average: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0, count: ratings.length },
    about: { name: String(about.name ?? store.ownerName ?? ""), story: String(about.story ?? "").slice(0, 1200), location: String(about.location ?? "") },
    faq: faq.filter((f) => f.q && f.a).map((f) => ({ q: String(f.q).slice(0, 200), a: String(f.a).slice(0, 600) })),
    pageTitle: page.title,
  };

  // Checks the day's allowance and records the run, in one step
  const started = await sb.rpc("start_ai_page", { p_store: storeId, p_prompt: JSON.stringify({ pageId: page.id, ...brief }) });
  if (started.error) {
    if (/ai_daily_limit/.test(started.error.message)) return fail({ ok: false, code: "limit", message: "You've used today's AI pages. Your allowance resets at midnight (India time)." }, 429);
    console.error("[ai/page] start failed", started.error.code, started.error.message);
    return fail({ ok: false, code: "unavailable", message: "AI page building isn't available right now." }, 503);
  }
  const runId = randomUUID().slice(0, 8);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AiEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          /* the editor went away */
        }
      };
      const result = await runAiPage({ brief, store: context, existingSections: brief.mode === "append" ? draftSections.length : 0, runId, emit, signal: request.signal });
      // A run that made nothing doesn't use up the day's allowance
      await sb.rpc("finish_ai_page", { p_id: started.data, p_status: result.ok ? "done" : "failed" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

const MEDIA_IMAGES = 40;
const MEDIA_VIDEOS = 10;

/**
 * The pictures and videos the AI may use, each with a short ref: every live product's pictures
 * (the cover as "product:<id>", so it follows the product) and video, then the media library.
 */
function mediaFrom(
  products: { id: string; title: string }[],
  rows: { product_id: string; kind: string; url: string; alt: string | null; poster_url: string | null }[],
  files: { name: string; folder: string; metadata: Record<string, unknown> | null }[],
  publicUrl: (path: string) => string
): { media: AiStoreMedia[]; covers: Map<string, string> } {
  const images: Omit<AiStoreMedia, "ref">[] = [];
  const videos: Omit<AiStoreMedia, "ref">[] = [];
  const coverOf = new Map<string, number>();
  for (const p of products) {
    const mine = rows.filter((r) => r.product_id === p.id);
    mine.filter((r) => r.kind === "image").slice(0, 3).forEach((r, i) => {
      const real = r.url.startsWith("https://");
      if (i === 0) {
        coverOf.set(p.id, images.length);
        images.push({ kind: "image", src: `product:${p.id}`, what: `Cover of the product "${p.title}"${real ? "" : " (drawn cover art with its title)"}${r.alt ? `: ${r.alt}` : ""}`, url: real ? r.url : undefined });
      } else if (real) images.push({ kind: "image", src: r.url, what: `Another picture of "${p.title}"${r.alt ? `: ${r.alt}` : ""}`, url: r.url });
    });
    const v = mine.find((r) => r.kind === "video" && r.url.startsWith("https://"));
    if (v) videos.push({ kind: "video", src: v.url, poster: v.poster_url?.startsWith("https://") ? v.poster_url : `product:${p.id}`, what: `Video of "${p.title}"${v.alt ? `: ${v.alt}` : ""}` });
  }
  for (const f of files) {
    if (!f.name || f.name === ".emptyFolderPlaceholder") continue;
    const mime = String(f.metadata?.mimetype ?? "");
    const url = publicUrl(`${f.folder}/${f.name}`);
    const what = `${f.folder === "ai" ? "AI-made picture" : "Uploaded"}: ${f.name.replace(/^[0-9a-f-]{36}-/i, "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")}`;
    if (mime.startsWith("image/") && mime !== "image/svg+xml") images.push({ kind: "image", src: url, what, url });
    else if (mime.startsWith("video/")) videos.push({ kind: "video", src: url, what });
  }
  const media = [...images.slice(0, MEDIA_IMAGES).map((m, i) => ({ ...m, ref: `pic:${i + 1}` })), ...videos.slice(0, MEDIA_VIDEOS).map((m, i) => ({ ...m, ref: `vid:${i + 1}` }))];
  const covers = new Map([...coverOf].filter(([, i]) => i < MEDIA_IMAGES).map(([id, i]) => [id, `pic:${i + 1}`]));
  return { media, covers };
}

/** The day's allowance, for the brief dialog */
export async function GET() {
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail({ ok: false, code: "signed_out", message: "Log in again to use AI." }, 401);
  const r = await sb.rpc("ai_page_allowance");
  const row = r.data?.[0];
  return NextResponse.json({ ok: true, connected: aiConnected(), used: row?.used ?? 0, daily: row?.daily ?? 0 }, { headers: { "cache-control": "no-store" } });
}
