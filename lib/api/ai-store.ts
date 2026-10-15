import { currencyFor } from "../countries";
import { money } from "../money";
import { paletteByName, type AiStoreDraft, type AiStoreRequest, type AiStoreResponse } from "../onboarding/ai-store";
import { initialsOf } from "../slug";
import { uid } from "../uid";
import type { ProductInput, ProductKind } from "../types";
import { updateStorePage } from "./account";
import { ApiError } from "./client";
import { createProduct } from "./products";
import { createStore, getStore, setSetupMode, updateStore } from "./store";
import { saveCollection } from "./store-admin";

/**
 * Setting a store up with AI (onboarding). The server drafts it; the creator reviews it; then it is
 * created here with the usual calls, so plan limits and every database check apply as they do by hand.
 */

export type { AiStoreDraft, AiStoreProduct, AiStoreRequest } from "../onboarding/ai-store";

export async function draftStoreWithAi(input: AiStoreRequest, signal?: AbortSignal): Promise<{ draft: AiStoreDraft; warnings: string[] }> {
  const res = await fetch("/api/ai/store", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal });
  const out = (await res.json().catch(() => ({ ok: false, code: "unavailable", message: "Something went wrong. Try again." }))) as AiStoreResponse;
  if (!out.ok) throw new ApiError(out.message, out.code === "limit" ? "limit" : "validation");
  return { draft: out.draft, warnings: out.warnings };
}

/** A product as the creator left it on the review screen */
export interface ReviewedProduct {
  title: string;
  description: string;
  kind: ProductKind;
  collection: string;
  /** Minor units, confirmed by the creator */
  price: number;
  sourceUrl?: string;
}

export interface AiStoreChoices {
  name: string;
  slug: string;
  country: string;
  tagline: string;
  palette: string;
  sells: "digital" | "physical";
  about: AiStoreDraft["about"];
  faq: AiStoreDraft["faq"];
  products: ReviewedProduct[];
  /** The link products came from, to record what the creator confirmed */
  link?: string;
  /** The store already made by hand during this setup, when switching to AI before it opens */
  existingStoreId?: string;
}

/**
 * Creates (or, when switching from the manual setup, fills in) the store from the reviewed draft.
 * Every product starts as a draft: a digital product needs its file before it can go live. Keeps
 * going past a product that fails, and says which ones didn't save.
 */
export async function createStoreFromDraft(c: AiStoreChoices, onStep?: (text: string) => void): Promise<{ storeId: string; failed: string[] }> {
  const color = paletteByName(c.palette).bg;
  onStep?.("Creating your store");
  let storeId: string;
  if (c.existingStoreId) {
    storeId = c.existingStoreId;
    await setSetupMode("ai", storeId);
    await updateStore({ name: c.name, tagline: c.tagline, brandColor: color, sells: c.sells });
  } else {
    storeId = (await createStore({ name: c.name, slug: c.slug, country: c.country, brandColor: color, setupMode: "ai", tagline: c.tagline, sells: c.sells })).id;
  }
  const store = await getStore();
  const currency = currencyFor(c.country);

  onStep?.("Writing your About page and FAQ");
  if (c.about.story.trim()) {
    const name = store.ownerName || c.name;
    await updateStorePage(storeId, { key: "about", about: { name, initials: initialsOf(name), story: c.about.story.trim(), location: c.about.location.trim() } });
  }
  const faq = c.faq.filter((f) => f.q.trim() && f.a.trim()).map((f) => ({ id: uid("faq"), q: f.q.trim(), a: f.a.trim() }));
  if (faq.length) await updateStorePage(storeId, { key: "faq", faq });

  const failed: string[] = [];
  const made: { id: string; collection: string }[] = [];
  for (const [i, p] of c.products.entries()) {
    onStep?.(`Adding products (${i + 1} of ${c.products.length})`);
    const digital = c.sells === "digital";
    const input: ProductInput = {
      title: p.title,
      description: p.description,
      kind: digital ? p.kind : "other",
      fulfilment: c.sells,
      price: money(p.price, currency),
      images: [],
      files: [],
      sku: "",
      taxCode: digital ? "998433" : "",
      taxRate: digital ? 18 : undefined,
      status: "draft",
      options: [],
      variants: [],
      trackStock: false,
      sourceUrl: p.sourceUrl,
    };
    try {
      made.push({ id: (await createProduct(input)).id, collection: p.collection.trim() });
    } catch {
      failed.push(p.title);
    }
  }

  const groups = new Map<string, { name: string; ids: string[] }>();
  for (const m of made) {
    if (!m.collection) continue;
    const key = m.collection.toLowerCase();
    groups.set(key, { name: groups.get(key)?.name ?? m.collection, ids: [...(groups.get(key)?.ids ?? []), m.id] });
  }
  if (groups.size) onStep?.("Grouping them into collections");
  const pal = paletteByName(c.palette);
  for (const g of groups.values()) {
    try {
      await saveCollection({ name: g.name, productIds: g.ids, cover: { template: "block", title: g.name, subtitle: "", bg: pal.bg, fg: pal.fg, accent: pal.accent } });
    } catch {
      /* a collection is optional; the products are saved */
    }
  }

  if (c.link) await fetch("/api/ai/store", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ record: { storeId, link: c.link } }) }).catch(() => undefined);
  return { storeId, failed };
}
