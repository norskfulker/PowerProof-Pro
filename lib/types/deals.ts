import type { DealResult } from "../pricing/deals";
import type { ISODate, Money } from "./money";
import type { Product } from "./product";
import type { PriceInfo, RatingSummary } from "./storefront";

/**
 * Deal paths (Part 4B): rules that reward buyers for adding to their order at checkout.
 * Distinct from store-wide sales (`Deal`), which change a product's list price.
 */
export type DealRuleSpec =
  /** All of these products together: percent off each of them */
  | { kind: "bundle_discount"; productIds: string[]; percent: number }
  /** Any trigger product (or none = anything) and an optional minimum spend: this product free */
  | { kind: "free_gift"; triggerIds: string[]; minSpend?: Money; giftId: string }
  /** Same as free_gift, but the buyer picks one of several gifts */
  | { kind: "choose_gift"; triggerIds: string[]; minSpend?: Money; giftIds: string[] }
  /** Item-count tiers over a pool (empty = every product): 2 items 10%, 3 items 20% … */
  | { kind: "tiers"; productIds: string[]; tiers: { minItems: number; percent: number }[] }
  /** Spend at least this much (before deals): percent off the whole order */
  | { kind: "spend_threshold"; minSpend: Money; percent: number }
  /** Buy this many from the pool (empty = every product): the cheapest one is free */
  | { kind: "buy_x_get_cheapest"; productIds: string[]; buy: number }
  /** These products are percent off until endsAt, when bought together with anything */
  | { kind: "limited_time"; productIds: string[]; percent: number };

export type DealRuleKind = DealRuleSpec["kind"];

export interface DealRuleStats {
  /** Times the panel showed this rule */
  views: number;
  /** Paid orders that used it */
  uses: number;
  /** Extra revenue from items buyers added because of it */
  revenueLift: Money;
}

export type DealRule = DealRuleSpec & {
  id: string;
  name: string;
  active: boolean;
  /** Combine with other stackable rules. Off by default: buyers get the single best deal. */
  stackable: boolean;
  startsAt?: ISODate;
  endsAt?: ISODate;
  createdAt: ISODate;
  /** Not tracked yet: screens show "No data yet" */
  stats?: DealRuleStats;
};

/** A product shown in the checkout deal panel, with its buyer-facing price and rating. */
export interface DealCardProduct extends Product {
  info: PriceInfo;
  rating: RatingSummary;
}

/** What the checkout deal panel shows: offers, pending gift choices and the products they mention. */
export interface CheckoutDeals {
  /** Offers, best first. The panel shows three and a "See more". */
  offers: DealResult["offers"];
  pendingChoices: string[];
  saving: Money;
  rules: DealRule[];
  /** Every product an offer, gift picker or buyer add mentions, with buyer-facing price info */
  products: DealCardProduct[];
  skipped: boolean;
}
