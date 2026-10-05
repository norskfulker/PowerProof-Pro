import { db } from "../mock/db";
import type { StoreScope } from "../mock/base";
import type { Order } from "../types";
import { notFound } from "./client";

/** Internal helpers: every public store, the creator's own one first. Not exported from the api index. */
export function allScopes(): StoreScope[] {
  const d = db();
  return [d, ...(d.ownedStores ?? []), ...d.otherStores];
}

/** The signed-in creator's stores: the active one first */
export function ownedScopes(): StoreScope[] {
  const d = db();
  return [d, ...(d.ownedStores ?? [])];
}

export function scopeBySlug(slug: string): StoreScope {
  return allScopes().find((s) => s.store.slug === slug) ?? notFound("Store");
}

export function scopeById(storeId: string): StoreScope {
  return allScopes().find((s) => s.store.id === storeId) ?? notFound("Store");
}

export function findOrder(match: (o: Order) => boolean): { scope: StoreScope; order: Order } {
  for (const scope of allScopes()) {
    const order = scope.orders.find(match);
    if (order) return { scope, order };
  }
  return notFound("Order");
}

export function isPrimary(scope: StoreScope): boolean {
  return scope === db();
}
