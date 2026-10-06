import type { BadgeKey } from "../nav/config";
import { db } from "../mock/db";
import { adminDb } from "../mock/admin";
import { call } from "./client";

export interface NavCounts {
  storeId: string;
  counts: Partial<Record<BadgeKey, number>>;
  collections: { id: string; name: string; products: { id: string; title: string }[] }[];
}

const OPEN = new Set(["open", "under_review"]);

/** Live numbers and collections for the menu (Part 7C). Store-scoped counts follow the active store. */
export function getNavCounts(area: "creator" | "admin"): Promise<NavCounts> {
  return call(() => {
    if (area === "admin") {
      return { storeId: "", counts: { disputes_open: adminDb().disputes.filter((d) => OPEN.has(d.status)).length }, collections: [] };
    }
    const d = db();
    const ps = d.products;
    const title = new Map(ps.map((p) => [p.id, p.title]));
    const orderNumbers = new Set(d.orders.map((o) => o.number));
    return {
      storeId: d.store.id,
      counts: {
        products_all: ps.length,
        products_live: ps.filter((p) => p.status === "published").length,
        products_draft: ps.filter((p) => p.status === "draft").length,
        products_archived: ps.filter((p) => p.status === "archived").length,
        reviews_pending: d.reviews.filter((r) => !r.reply && !r.hidden).length,
        questions_open: d.questions.filter((q) => q.answers.length === 0).length,
        orders_disputed: adminDb().disputes.filter((x) => OPEN.has(x.status) && orderNumbers.has(x.orderNumber)).length,
      },
      collections: d.collections.map((c) => ({ id: c.id, name: c.name, products: c.productIds.filter((id) => title.has(id)).map((id) => ({ id, title: title.get(id)! })) })),
    };
  }, { fast: true });
}

/** The store the switcher has chosen; store-scoped links use it. */
export function getActiveStoreId(): Promise<string> {
  return call(() => db().store.id, { fast: true });
}
