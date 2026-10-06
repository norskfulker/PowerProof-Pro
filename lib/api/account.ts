import { commit, db, getSessionRaw, setSessionRaw } from "../mock/db";
import { writeProgress } from "../mock/progress";
import { baseStore, basePlan, freshScope, type StoreScope } from "../mock/base";
import { slugify } from "../mock/random";
import { PLAN_LIMITS, PRO_TRIAL_DAYS, withinLimit, type PlanLimits, type PlanTier } from "../plans";
import type { AboutContent, Plan, Store, StorePageKey, StorePages } from "../types";
import { ApiError, call, LimitError, notFound } from "./client";
import { allScopes, ownedScopes } from "./scope";
import { isLive } from "../supabase/env";
import { liveChange } from "./live/notify";
import * as live from "./live/store";

/**
 * Account-level API (Part 6C and 6D): the creator's plan and limits, their stores, and each
 * store's own About, FAQ and policies.
 */

export interface PlanState {
  plan: Plan;
  tier: PlanTier;
  limits: PlanLimits;
  usage: { stores: number; products: number };
}

function usage() {
  const scopes = ownedScopes();
  return { stores: scopes.length, products: scopes.reduce((t, s) => t + s.products.filter((p) => p.status !== "archived").length, 0) };
}

export function getPlanState(): Promise<PlanState> {
  if (isLive()) return live.getPlanState();
  return call(() => {
    const plan = db().plan;
    const tier = plan.tier ?? "pro";
    return { plan, tier, limits: PLAN_LIMITS[tier], usage: usage() };
  }, { fast: true });
}

export { LimitError } from "./client";

/** Checks a limit before creating something. Every create path calls this. */
export function assertWithinLimit(kind: "stores" | "products") {
  const tier = db().plan.tier ?? "pro";
  if (!withinLimit(tier, kind, usage()[kind])) {
    throw new LimitError(kind, kind === "products" ? "The Free plan includes 1 product. Upgrade to Pro to add more." : "The Free plan includes 1 store. Upgrade to Pro to open another.");
  }
}

export function canCreate(kind: "stores" | "products"): Promise<boolean> {
  if (isLive()) return live.canCreate(kind);
  return call(() => withinLimit(db().plan.tier ?? "pro", kind, usage()[kind]), { fast: true });
}

/** Upgrade starts Pro with the first month free. Downgrade is for testing (dev toggle on /design). */
export function setPlanTier(tier: PlanTier): Promise<PlanState> {
  if (isLive()) return liveChange(live.setPlanTier(tier));
  return call(() => {
    commit((d) => {
      const now = Date.now();
      d.plan = tier === "pro" ? { ...basePlan(now, now, "pro"), trialEndsAt: new Date(now + PRO_TRIAL_DAYS * 86_400_000).toISOString(), status: "trial", cardLast4: undefined } : basePlan(now, now, "free");
    });
    const plan = db().plan;
    return { plan, tier: plan.tier, limits: PLAN_LIMITS[plan.tier], usage: usage() };
  }, { fast: true });
}

/* ------------------------------------------------------------------ */
/* Stores                                                               */
/* ------------------------------------------------------------------ */

export interface OwnedStore {
  id: string;
  name: string;
  slug: string;
  logoText: string;
  brandColor: string;
  active: boolean;
  products: number;
}

export function getOwnedStores(): Promise<OwnedStore[]> {
  if (isLive()) return live.getOwnedStores();
  return call(() =>
    ownedScopes().map((s, i) => ({ id: s.store.id, name: s.store.name, slug: s.store.slug, logoText: s.store.logoText, brandColor: s.store.brandColor, active: i === 0, products: s.products.length }))
  , { fast: true });
}

const SCOPE_KEYS: (keyof StoreScope)[] = ["store", "company", "invoice", "products", "orders", "customers", "taxCodes", "design", "storePages", "collections", "coupons", "bundles", "deals", "dealRules", "visualPages", "reviews", "questions", "subscribers", "domains"];

/** Makes another of the creator's stores the active one. */
export function switchStore(storeId: string): Promise<Store> {
  if (isLive()) return liveChange(live.switchStore(storeId));
  return call(() => {
    const d = db();
    if (d.store.id === storeId) return d.store;
    const target = d.ownedStores.find((s) => s.store.id === storeId) ?? notFound("Store");
    commit((x) => {
      const current = Object.fromEntries(SCOPE_KEYS.map((k) => [k, x[k]])) as unknown as StoreScope;
      x.ownedStores = [current, ...x.ownedStores.filter((s) => s.store.id !== storeId)];
      for (const k of SCOPE_KEYS) (x as unknown as Record<string, unknown>)[k] = target[k];
    });
    const session = getSessionRaw();
    if (session) setSessionRaw({ ...session, storeId });
    return db().store;
  });
}

export function createOwnedStore(input: { name: string; slug?: string }): Promise<Store> {
  if (isLive()) return liveChange(live.createOwnedStore(input));
  return call(() => {
    assertWithinLimit("stores");
    const name = input.name.trim();
    if (name.length < 2) throw new ApiError("Give your store a name.", "validation");
    const slug = slugify(input.slug?.trim() || name);
    if (!slug) throw new ApiError("Use letters or numbers for the store link.", "validation");
    if (allScopes().some((s) => s.store.slug === slug)) throw new ApiError("That link is taken. Try another.", "conflict");
    const d = db();
    const now = Date.now();
    const store = baseStore(now, {
      id: `store_${slug.replace(/-/g, "_")}_${now.toString(36)}`,
      name,
      slug,
      tagline: `Digital downloads by ${d.store.ownerName}.`,
      ownerName: d.store.ownerName,
      ownerEmail: d.store.ownerEmail,
      supportEmail: d.store.ownerEmail,
      logoText: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "PP",
      createdAt: new Date(now).toISOString(),
      onboarded: false,
    });
    commit((x) => x.ownedStores.push(freshScope(now, store)));
    return store;
  });
}

/* ------------------------------------------------------------------ */
/* Per-store About, FAQ and policies                                    */
/* ------------------------------------------------------------------ */

function ownedScope(storeId: string): StoreScope {
  return ownedScopes().find((s) => s.store.id === storeId) ?? notFound("Store");
}

export interface StoreInfo {
  store: Store;
  about: AboutContent;
  pages: StorePages;
}

export function getStoreInfo(storeId: string): Promise<StoreInfo> {
  if (isLive()) return live.getStoreInfo(storeId);
  return call(() => {
    const s = ownedScope(storeId);
    return { store: s.store, about: s.design.about, pages: s.storePages };
  });
}

export type StorePageUpdate =
  | { key: "about"; about: AboutContent }
  | { key: "faq"; faq: StorePages["faq"] }
  | { key: "refund" | "terms" | "privacy"; text: string };

export function updateStorePage(storeId: string, change: StorePageUpdate): Promise<StoreInfo> {
  if (isLive()) return liveChange(live.updateStorePage(storeId, change));
  return call(() => {
    const s = ownedScope(storeId);
    if (change.key === "faq" && change.faq.some((f) => !f.q.trim() || !f.a.trim())) throw new ApiError("Every question needs an answer, and every answer a question.", "validation");
    if ((change.key === "refund" || change.key === "terms" || change.key === "privacy") && change.text.trim().length < 20) throw new ApiError("That's very short. Say what buyers can expect in a sentence or two.", "validation");
    commit(() => {
      if (change.key === "about") {
        s.design.about = change.about;
        writeProgress((p) => ({ customized: { ...p.customized, about: true } }));
      }
      else if (change.key === "faq") s.storePages.faq = change.faq;
      else s.storePages[change.key] = change.text.trim();
      s.storePages.edited = { ...s.storePages.edited, [change.key]: true };
    });
    return { store: s.store, about: s.design.about, pages: s.storePages };
  });
}

export const STORE_PAGE_LABELS: Record<StorePageKey, string> = { about: "About", faq: "FAQ", refund: "Refund policy", terms: "Terms", privacy: "Privacy" };

/** The default FAQ and policy text every new store starts with. */
export { defaultPages as defaultStorePages } from "../mock/storefront-seed";
