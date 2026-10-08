import { hasTags } from "../../analytics-tags";
import { sb } from "../../supabase/browser";
import type { AnalyticsTags } from "../../types";
import { getPlanState } from "./store";
import { activeStoreId, currentUser } from "./session";

/** What the getting-started checklist can read from the database itself. */
export async function liveFacts() {
  const [me, storeId, plan] = await Promise.all([currentUser(), activeStoreId(), getPlanState()]);
  const client = sb();
  const { data: stores } = await client.from("stores").select("id, name, status, legal_name, company_address, theme").eq("owner_id", me.id);
  const ids = (stores ?? []).map((s) => s.id);
  const active = stores?.find((s) => s.id === storeId);
  const [products, collections, methods, paid] = await Promise.all([
    ids.length ? client.from("products").select("status").in("store_id", ids) : Promise.resolve({ data: [] as { status: string }[] }),
    ids.length ? client.from("collections").select("id", { count: "exact", head: true }).in("store_id", ids) : Promise.resolve({ count: 0 }),
    client.from("payout_methods").select("id", { count: "exact", head: true }).eq("owner_id", me.id),
    ids.length ? client.from("creator_orders").select("id", { count: "exact", head: true }).in("store_id", ids).in("status", ["paid", "refunded"]) : Promise.resolve({ count: 0 }),
  ]);
  const ps = products.data ?? [];
  const address = (active?.company_address ?? "").split("\n");
  const max = plan.limits.products;
  return {
    storeName: active?.name ?? "",
    onboarded: active?.status === "published",
    anyProduct: ps.length > 0,
    anyCollection: (collections.count ?? 0) > 0,
    draftOnly: ps.length > 0 && !ps.some((p) => p.status === "live"),
    paid: (paid.count ?? 0) > 0,
    analytics: hasTags((active?.theme as { analytics?: AnalyticsTags } | null)?.analytics),
    // legal name, address line 1, city, PIN code (the address is stored as lines)
    businessFields: [active?.legal_name ?? "", address[0] ?? "", address[2] ?? "", address[4] ?? ""].filter((v) => v.trim()).length,
    payout: (methods.count ?? 0) > 0,
    productsFull: max !== null && plan.usage.products >= max,
    email: me.email.toLowerCase(),
  };
}
