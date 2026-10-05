/**
 * The only door pages use to reach data. Today every function reads and writes the
 * in-browser mock db; later each body becomes a fetch to the real backend.
 */
export * from "./client";
export * from "./auth";
export * from "./products";
export * from "./orders";
export * from "./buyer";
export * from "./payouts";
export * from "./analytics";
export * from "./store";
export * from "./admin";
export * from "./demo";
