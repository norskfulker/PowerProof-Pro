import type { StoreScope } from "./base";
import { baseStore, freshScope } from "./base";
import { productsFromRows } from "./other-stores";
import { DAY } from "./random";
import { buildCollections } from "./storefront-seed";
import type { ProductRow } from "./catalog-stores";

const COLORS = [
  { bg: "#8A3B1E", fg: "#F5F6F4", accent: "#F3E4DC" },
  { bg: "#F3E4DC", fg: "#0C1F1B", accent: "#8A3B1E" },
  { bg: "#3F7A66", fg: "#F5F6F4", accent: "#F3E4DC" },
];

const ROWS: ProductRow[] = [
  ["Golden Hour: 10 Lightroom Presets", "preset", 599, 0, "frame", "Lightroom presets", "golden-hour-presets.zip", 42, "Warm, filmic presets tuned on Indian skin tones in late afternoon light."],
  ["Wedding Film LUT Pack", "preset", 1299, 1599, "split", "Video LUTs", "wedding-luts.zip", 120, "Twelve LUTs for Indian weddings: haldi, sangeet, pheras and the night after."],
  ["Phone Photography Field Guide", "ebook", 349, 0, "block", "Ebook · 46 pages", "phone-photo-guide.pdf", 12, "Shoot better pictures on the phone you already have."],
];

/**
 * Ananya's second store (Part 6C): a separate brand with its own products, About, FAQ and policies,
 * so switching stores visibly changes everything that belongs to a store.
 */
export function buildSecondStore(now: number): StoreScope {
  const store = baseStore(now, {
    id: "store_ananya_photo",
    name: "Ananya Photo Presets",
    slug: "ananya-photo",
    tagline: "Presets and LUTs for warm, honest photographs.",
    brandColor: "#8A3B1E",
    logoText: "AP",
    supportEmail: "presets@ananyamakes.in",
    refundDays: 3,
    refundPolicy: "Presets are instant downloads. If one doesn't install, write within 3 days and we'll fix it or refund you.",
    createdAt: new Date(now - 20 * DAY).toISOString(),
    onboarded: true,
  });
  const scope = freshScope(now, store);
  const products = productsFromRows(ROWS, "ap", COLORS, now, 0, 41).map((p) => ({ ...p, sku: `AP-${p.id.slice(-2)}` }));
  scope.products = products;
  scope.collections = buildCollections(products, [["Presets", "Everything for Lightroom and video.", [0, 1]]], COLORS);
  scope.design = {
    ...scope.design,
    theme: { palette: "terracotta", fonts: "editorial", heroStyle: "left" },
    hero: { ...scope.design.hero, headline: "Warm light, every time.", subtext: "Presets and LUTs made on real Indian shoots.", imageProductIds: products.slice(0, 2).map((p) => p.id) },
    about: { name: "Ananya Rao", initials: "AR", location: "Mumbai, India", story: "Ananya Photo Presets is my photography side. Eight years of weddings and travel taught me which colours flatter skin in harsh Indian sun. These presets are the ones I actually use on paid shoots." },
  };
  scope.storePages = {
    ...scope.storePages,
    faq: [
      { id: "pf1", q: "Do these work in Lightroom Mobile?", a: "Yes. Every pack includes DNG files for Lightroom Mobile and XMP files for desktop." },
      { id: "pf2", q: "Will they look like the samples on my photos?", a: "Presets are a starting point. Adjust exposure and white balance first, then apply." },
      { id: "pf3", q: "Can I use them for client work?", a: "Yes, for your own photography work, including paid shoots. You can't resell the presets themselves." },
    ],
    refund: "Presets are instant downloads, so refunds are for files that won't install. Write to presets@ananyamakes.in within 3 days and we'll fix it or refund you in full.",
    terms: "You may use these presets and LUTs on your own photos and videos, including client work. Reselling, sharing or bundling the files themselves isn't allowed.",
    privacy: "Ananya Photo Presets uses your email only to deliver your files and receipts. Payment details go straight to the payment gateway.",
    contactNote: "Replies within two working days. Wedding season can be slower.",
    edited: { about: true, faq: true, refund: true, terms: true },
  };
  return scope;
}
