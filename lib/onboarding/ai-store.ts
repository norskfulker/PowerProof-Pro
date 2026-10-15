import { z } from "zod";
import { PALETTES } from "../palettes";
import { STORE_NAME_MAX } from "../slug";
import type { ProductKind } from "../types";

/**
 * Setting a store up with AI: what the creator tells us, and the draft store AI answers with.
 * Nothing in a draft is saved until the creator reviews it and creates the store. Prices are never
 * made up: a product brought from the creator's own link keeps the price it had there, and any
 * other price is only a suggestion the creator must accept or type over.
 */

export const AI_STORE_KINDS = ["ebook", "template", "preset", "notion", "course", "audio", "other"] as const satisfies readonly ProductKind[];
export const AI_STORE_MAX_PRODUCTS = 8;

export const aiStoreRequestSchema = z.strictObject({
  /** The business in the creator's own words */
  description: z.string().trim().min(10, "Say a little more about what you sell.").max(2000),
  /** Optional: their existing shop, product page or website, to bring real products across */
  link: z.string().trim().max(2000).default(""),
  /** They own the products at the link or may sell them */
  rights: z.boolean().default(false),
  country: z.string().trim().length(2),
  language: z.string().trim().min(2).max(40).default("English"),
});
export type AiStoreRequest = z.infer<typeof aiStoreRequestSchema>;

const text = (max: number) => z.string().trim().max(max * 2).transform((s) => s.slice(0, max));

export const aiStoreProductSchema = z.object({
  title: text(160).pipe(z.string().min(2)),
  description: text(2000).default(""),
  kind: z.enum(AI_STORE_KINDS).catch("other"),
  /** Which of the draft's collections it belongs to (by name), if any */
  collection: text(80).default(""),
  /** A price in minor units from the creator's own link. Real, so it is filled in. */
  price: z.number().int().min(0).optional(),
  /** AI's idea of a price, in minor units. Never filled in on its own. */
  suggestedPrice: z.number().int().min(0).optional(),
  sourceUrl: z.string().url().optional(),
});
export type AiStoreProduct = z.infer<typeof aiStoreProductSchema>;

export const aiStoreDraftSchema = z.object({
  /** Up to three names to pick from, best first */
  names: z.array(text(STORE_NAME_MAX).pipe(z.string().min(2))).min(1).max(3),
  tagline: text(140).default(""),
  /** One of PALETTES, by name */
  palette: z.string().transform((p) => (PALETTES.some((x) => x.name === p) ? p : PALETTES[0].name)),
  sells: z.enum(["digital", "physical"]).catch("digital"),
  about: z.object({ story: text(1200).default(""), location: text(80).default("") }).default({}),
  faq: z.array(z.object({ q: text(200).pipe(z.string().min(3)), a: text(600).pipe(z.string().min(3)) })).max(8).default([]),
  collections: z.array(text(80).pipe(z.string().min(2))).max(5).default([]),
  products: z.array(aiStoreProductSchema).max(AI_STORE_MAX_PRODUCTS).default([]),
  /** Short notes for the creator: what to check or add before opening */
  notes: z.array(text(240)).max(6).default([]),
});
export type AiStoreDraft = z.infer<typeof aiStoreDraftSchema>;

/** What the route answers */
export type AiStoreResponse = { ok: true; draft: AiStoreDraft; warnings: string[] } | { ok: false; code: "signed_out" | "invalid" | "not_connected" | "limit" | "unavailable"; message: string };

export const paletteByName = (name: string) => PALETTES.find((p) => p.name === name) ?? PALETTES[0];

/** The JSON schema the model answers in (prices it may only suggest, in major units) */
export const AI_STORE_JSON_SCHEMA = {
  type: "object",
  properties: {
    names: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", description: `A store name, at most ${STORE_NAME_MAX} characters` } },
    tagline: { type: "string", description: "One short line under the store name, at most 140 characters" },
    palette: { type: "string", enum: PALETTES.map((p) => p.name) },
    sells: { type: "string", enum: ["digital", "physical"] },
    about: { type: "object", properties: { story: { type: "string" }, location: { type: "string" } }, required: ["story", "location"] },
    faq: { type: "array", maxItems: 6, items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] } },
    collections: { type: "array", maxItems: 4, items: { type: "string" } },
    products: {
      type: "array",
      maxItems: AI_STORE_MAX_PRODUCTS,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          kind: { type: "string", enum: [...AI_STORE_KINDS] },
          collection: { type: "string" },
          suggestedPrice: { type: "number", description: "A fair price idea in major units (499, not 49900). 0 when you can't tell." },
        },
        required: ["title", "description", "kind", "collection", "suggestedPrice"],
      },
    },
    notes: { type: "array", maxItems: 6, items: { type: "string" } },
  },
  required: ["names", "tagline", "palette", "sells", "about", "faq", "collections", "products", "notes"],
} as const;
