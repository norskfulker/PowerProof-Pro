import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { convertPrices, type ImportPreview } from "@/lib/import/map";
import { fail, ownStore } from "@/lib/server/import/auth";
import { previewLink } from "@/lib/server/import/link";
import { ImportError } from "@/lib/server/import/sources";
import { allow, clientKey } from "@/lib/server/limit";
import { sbAdmin } from "@/lib/supabase/admin";

/**
 * Reads a pasted link (a product page or a shop's address) and shows what would come across:
 * titles, descriptions and prices, and pictures and a video if asked, after the creator confirms
 * they may sell those products. Nothing is created here.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const body = z.object({
  storeId: z.string(),
  source: z.literal("link"),
  url: z.string().trim().min(1).max(2000),
  /** The creator confirms they own these products or may sell them */
  rights: z.boolean().default(false),
  /** Bring its pictures and video too (the creator confirms they may use them) */
  media: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!allow(`import:${clientKey(request)}`, 20, 10 * 60_000)) return fail("Too many imports in a row. Wait a few minutes.", 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Paste a link to a product or a shop.");
  const b = parsed.data;
  const own = await ownStore(b.storeId);
  if ("error" in own) return own.error;
  const store = own.store;
  if (!b.rights) return fail("Confirm you own these products or have permission to sell them.");
  const db = sbAdmin();

  let preview: ImportPreview;
  try {
    preview = await previewLink(b.url, store.currency_base, { media: b.media });
  } catch (e) {
    if (e instanceof ImportError) return fail(e.message, 400);
    console.error("[import/preview]", e instanceof Error ? e.message : e);
    return fail("We couldn't read that link. Try again in a minute.", 502);
  }
  const proof = { method: "rights_confirmed", detail: b.media ? "You confirmed you may sell these and use their pictures" : "You confirmed you may sell these" };

  // Prices in the store's own currency
  const { data: fx } = await db.from("fx_rates").select("currency, per_usd");
  const rates = Object.fromEntries((fx ?? []).map((r) => [r.currency, Number(r.per_usd)]));
  const converted = convertPrices(preview.products, store.currency_base, rates);
  preview = { ...preview, products: converted.products, warnings: [...preview.warnings, ...(converted.warning ? [converted.warning] : [])] };

  // Products brought across before (same address at the source) start unticked
  const urls = preview.products.map((p) => p.sourceUrl).filter((u): u is string => !!u);
  const { data: have } = urls.length ? await db.from("products").select("source_url").eq("store_id", store.id).in("source_url", urls.slice(0, 1000)) : { data: [] };
  const existing = new Set((have ?? []).map((r) => r.source_url));

  // The record of who brought what from where, and what they confirmed
  const { data: row } = await db
    .from("store_imports")
    .insert({ store_id: store.id, source: preview.source, source_label: preview.label.slice(0, 300), proof, counts: { products: preview.products.length } })
    .select("id")
    .single();

  return NextResponse.json({ ok: true, importId: row?.id, preview, existing: preview.products.filter((p) => p.sourceUrl && existing.has(p.sourceUrl)).map((p) => p.key), proof }, { headers: { "cache-control": "no-store" } });
}
