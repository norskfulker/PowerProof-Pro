import type { AllPlanLimits, PlanLimits, PlanTier } from "../plans";
import { fetchPlanLimits } from "../plan-limits";
import { defaultPages } from "../defaults/store";
import type { AboutContent, Plan, Store, StorePageKey, StorePages } from "../types";
import { liveChange } from "./live/notify";
import * as live from "./live/store";

/**
 * Account-level API: the creator's plan and limits, their stores, and each store's own About,
 * FAQ and policies. All of it is read from and saved to Supabase.
 */

export interface PlanState {
  plan: Plan;
  tier: PlanTier;
  limits: PlanLimits;
  usage: { stores: number; products: number };
}

export { LimitError } from "./client";

export const getPlanState = (): Promise<PlanState> => live.getPlanState();
/** Free and Pro limits as the database enforces them. */
export const getPlanLimits = (): Promise<AllPlanLimits> => fetchPlanLimits();
export const canCreate = (kind: "stores" | "products"): Promise<boolean> => live.canCreate(kind);
/** Plans are changed by PowerProof until billing is connected: this explains that. */
export const setPlanTier = (tier: PlanTier): Promise<PlanState> => liveChange(live.setPlanTier(tier));

export interface OwnedStore {
  id: string;
  name: string;
  slug: string;
  logoText: string;
  brandColor: string;
  active: boolean;
  products: number;
}

export const getOwnedStores = (): Promise<OwnedStore[]> => live.getOwnedStores();
/** Makes another of the creator's stores the active one. */
export const switchStore = (storeId: string): Promise<Store> => liveChange(live.switchStore(storeId));
export const createOwnedStore = (input: { name: string; slug?: string }): Promise<Store> => liveChange(live.createOwnedStore(input));

export interface StoreInfo {
  store: Store;
  about: AboutContent;
  pages: StorePages;
}

export type StorePageUpdate =
  | { key: "about"; about: AboutContent }
  | { key: "faq"; faq: StorePages["faq"] }
  | { key: "refund" | "terms" | "privacy"; text: string };

export const getStoreInfo = (storeId: string): Promise<StoreInfo> => live.getStoreInfo(storeId);
export const updateStorePage = (storeId: string, change: StorePageUpdate): Promise<StoreInfo> => liveChange(live.updateStorePage(storeId, change));

export const STORE_PAGE_LABELS: Record<StorePageKey, string> = { about: "About", faq: "FAQ", refund: "Refund policy", terms: "Terms", privacy: "Privacy" };

/** The default FAQ and policy text every new store starts with. */
export const defaultStorePages = defaultPages;
