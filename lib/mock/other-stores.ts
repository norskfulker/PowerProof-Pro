import { fromMajor, money } from "../money";
import type { Product, Store } from "../types";
import { baseCompany, type StoreScope } from "./base";
import { TAX_CODES } from "./catalog";
import type { ProductRow, StoreSeed } from "./catalog-stores";
import { DAY, rng, slugify } from "./random";
import { buildCollections, buildDesign, buildOffers, buildQuestions, buildReviews, defaultPages, buildDealRules, buildVisualPages } from "./storefront-seed";

const iso = (t: number) => new Date(t).toISOString();

export function productsFromRows(rows: ProductRow[], key: string, colors: StoreSeed["colors"], now: number, startIndex = 0, seed = 7): Product[] {
  const r = rng(seed);
  return rows.map(([title, kind, price, compareAt, template, subtitle, file, mb, description], i) => {
    const n = startIndex + i + 1;
    const id = `${key}_p${String(n).padStart(2, "0")}`;
    const c = colors[i % colors.length];
    const created = now - (90 - i * 5) * DAY;
    const sales = r.int(4, 160);
    return {
      id,
      slug: slugify(title),
      title,
      description,
      kind,
      price: fromMajor(price),
      compareAt: compareAt ? fromMajor(compareAt) : undefined,
      images: [
        { id: `${id}_i1`, alt: `${title} cover`, cover: { template, title, subtitle, ...c } },
        { id: `${id}_i2`, alt: `${title} inside`, cover: { template: "grid", title: "Inside", subtitle, ...colors[(i + 1) % colors.length] } },
        { id: `${id}_i3`, alt: `${title} sample`, cover: { template: "frame", title: "Sample page", subtitle, ...colors[(i + 2) % colors.length] } },
      ],
      files: [{ id: `${id}_f1`, name: file, size: Math.round(mb * 1024 * 1024), mime: file.endsWith(".pdf") ? "application/pdf" : "application/zip" }],
      sku: `${key.toUpperCase().slice(0, 2)}-${String(n).padStart(3, "0")}`,
      taxCode: kind === "ebook" ? "998431" : "998433",
      status: "published",
      createdAt: iso(created),
      updatedAt: iso(created + DAY),
      salesCount: sales,
      revenue: money(sales * price * 100),
    };
  });
}

/** A complete public demo store (read-only for the creator app, buyable on the storefront). */
export function buildOtherStore(seed: StoreSeed, now: number, seedNum: number): StoreScope {
  const store: Store = {
    id: seed.id,
    name: seed.name,
    slug: seed.slug,
    tagline: seed.tagline,
    ownerName: seed.owner,
    ownerEmail: seed.email,
    brandColor: seed.colors[0].bg,
    logoText: seed.logoText,
    currency: "INR",
    supportEmail: seed.email,
    refundPolicy: "Not happy? Write within 7 days for a full refund.",
    refundDays: 7,
    createdAt: iso(now - 200 * DAY),
    onboarded: true,
  };
  const products = productsFromRows(seed.products, seed.slug, seed.colors, now, 0, seedNum);
  const offers = buildOffers(products, now, seed.slug);
  const dealRules = buildDealRules(products, now, seed.slug);
  const collections = buildCollections(products, seed.collections, seed.colors);
  const visualPages = buildVisualPages(store, products, collections, now, seed.slug === "inkwell"
    ? [["launch", "New: The Quiet Freelancer", "quiet-freelancer", true], ["link_in_bio", "Links", "links", true], ["about", "About Inkwell", "about-inkwell", false]]
    : [["portfolio", "Selected work", "work", true], ["sale", "Template sale", "sale", true], ["waitlist", "Free starter grid", "free-grid", false]]);
  return {
    store,
    company: { ...baseCompany(), legalName: seed.owner, city: seed.city, state: seed.city === "Pune" ? "Maharashtra" : "Karnataka", gstin: undefined, pan: undefined },
    invoice: { prefix: seed.logoText, nextNumber: 400, showGstin: false, footerNote: "Thank you for buying from an independent creator.", defaultTaxCode: "998433", pricesIncludeTax: true },
    products,
    dealRules,
    orders: [],
    customers: [],
    taxCodes: TAX_CODES,
    design: buildDesign({
      store,
      palette: seed.palette,
      fonts: seed.fonts,
      heroStyle: seed.heroStyle,
      mode: seed.mode,
      hero: seed.hero,
      heroProductIds: products.slice(0, 3).map((p) => p.id),
      story: seed.story,
      city: seed.city,
      dealEndsAt: offers.deals[0].endsAt,
      bumpProduct: products[products.length - 1],
    }),
    storePages: defaultPages(store),
    collections,
    visualPages,
    ...offers,
    reviews: buildReviews(products, now, seedNum, seed.slug, seed.colors),
    questions: buildQuestions(products, now, seed.slug === "inkwell" ? 7 : 6, seed.slug, seed.owner.split(" ")[0]),
    subscribers: [],
  };
}
