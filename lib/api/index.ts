/**
 * The only door pages use to reach data. Every function reads and writes Supabase; there is no
 * other backend. Things that need a server we don't have yet (payments, emails, DNS checks) are
 * not faked: their screens say "coming soon".
 */
export * from "./client";
export * from "./auth";
export * from "./products";
export * from "./orders";
export * from "./storefront";
export * from "./store-admin";
export * from "./payouts";
export * from "./analytics";
export * from "./store";
export * from "./search";
export * from "./deal-rules";
export * from "./visual-pages";
export * from "./account";
export * from "./media";
export * from "./getting-started";
export * from "./preferences";
export * from "./domains";
export * from "./nav";
export * from "./gst";
export * from "./leads";
export * from "./marketplace";
export * from "./public-orders";
export * from "./checkout";
export * from "./admin";
export { subscribe as onDataChange } from "./live/local";
export * from "./import";
export * from "./team";
