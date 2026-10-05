import { fromMajor, money } from "../money";
import { commit, db } from "../mock/db";
import { slugify, uid } from "../mock/random";
import type { LinkAutofill, Product, ProductInput, ProductKind, ProductStatus } from "../types";
import { assertWithinLimit } from "./account";
import { call, notFound } from "./client";

export interface ProductQuery {
  search?: string;
  status?: ProductStatus | "all";
  kind?: ProductKind | "all";
}

export function getProducts(q: ProductQuery = {}): Promise<Product[]> {
  return call(() => {
    const s = q.search?.trim().toLowerCase();
    return db().products.filter(
      (p) =>
        (!s || p.title.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)) &&
        (!q.status || q.status === "all" || p.status === q.status) &&
        (!q.kind || q.kind === "all" || p.kind === q.kind)
    );
  });
}

export function getProduct(id: string): Promise<Product> {
  return call(() => db().products.find((p) => p.id === id) ?? notFound("Product"));
}

export function createProduct(input: ProductInput): Promise<Product> {
  return call(() => {
    assertWithinLimit("products");
    const now = new Date().toISOString();
    const d = db();
    let slug = slugify(input.title) || "product";
    if (d.products.some((p) => p.slug === slug)) slug = `${slug}-${d.products.length + 1}`;
    const product: Product = {
      ...input,
      id: uid("prod"),
      slug,
      sku: input.sku || `${d.store.logoText}-${String(d.products.length + 1).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
      salesCount: 0,
      revenue: money(0, input.price.currency),
    };
    commit((x) => {
      x.products.unshift(product);
      x.skus.unshift({ id: uid("sku"), code: product.sku, productId: product.id, productTitle: product.title, taxCode: product.taxCode });
    });
    return product;
  });
}

export function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  return call(() => {
    const d = db();
    const p = d.products.find((x) => x.id === id) ?? notFound("Product");
    commit(() => {
      Object.assign(p, patch, { updatedAt: new Date().toISOString() });
      const sku = d.skus.find((s) => s.productId === id);
      if (sku) Object.assign(sku, { code: p.sku, taxCode: p.taxCode, productTitle: p.title });
    });
    return p;
  });
}

export function deleteProduct(id: string): Promise<void> {
  return call(() => {
    commit((d) => {
      d.products = d.products.filter((p) => p.id !== id);
      d.skus = d.skus.filter((s) => s.productId !== id);
    });
  });
}

export function duplicateProduct(id: string): Promise<Product> {
  return call(() => {
    assertWithinLimit("products");
    const src = db().products.find((p) => p.id === id) ?? notFound("Product");
    const copy: Product = {
      ...JSON.parse(JSON.stringify(src)),
      id: uid("prod"),
      slug: `${src.slug}-copy`,
      title: `${src.title} (copy)`,
      status: "draft",
      salesCount: 0,
      revenue: money(0),
      sku: `${src.sku}-C`,
    };
    commit((d) => d.products.unshift(copy));
    return copy;
  });
}

/* ---------------------------------------------------------------- */
/* Link autofill mock                                                */
/* ---------------------------------------------------------------- */

const SOURCES: [RegExp, string, ProductKind][] = [
  [/gumroad/i, "Gumroad", "ebook"],
  [/notion/i, "Notion", "notion"],
  [/etsy/i, "Etsy", "template"],
  [/instamojo/i, "Instamojo", "ebook"],
  [/topmate/i, "Topmate", "course"],
  [/canva/i, "Canva", "template"],
  [/youtube|youtu\.be/i, "YouTube", "course"],
];

const TITLE_BANK: Record<ProductKind, string[]> = {
  ebook: ["The Creator Tax Handbook", "Cold Email Swipe File", "Write Your First Ebook in 30 Days"],
  notion: ["Content Calendar OS", "Notion Habit Tracker", "Client Portal Kit"],
  template: ["Pitch Deck Template Pack", "Canva Brand Kit Starter", "Invoice Templates for Freelancers"],
  preset: ["Golden Hour Presets", "Film Grain Collection"],
  course: ["Reels That Convert: Mini Course", "Excel for Small Business"],
  audio: ["Ambient Study Loops"],
  other: ["Creator Toolkit"],
};

const PALETTES = [
  { bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" },
  { bg: "#C9A24F", fg: "#0C1F1B", accent: "#0F3D33" },
  { bg: "#1D5C7A", fg: "#F5F6F4", accent: "#C9A24F" },
  { bg: "#F6EFDF", fg: "#0C1F1B", accent: "#A9823A" },
];

export function autofillFromLink(url: string): Promise<LinkAutofill> {
  return call(async () => {
    await new Promise((r) => setTimeout(r, 700)); // fetching a page takes a beat
    let host = "";
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      throw new Error("That doesn't look like a link. Paste the full address, starting with https://");
    }
    const [, sourceName, kind] = SOURCES.find(([re]) => re.test(host)) ?? [null, host, "ebook" as ProductKind];
    const seed = [...url].reduce((t, c) => t + c.charCodeAt(0), 0);
    const pathWords = new URL(url).pathname
      .split(/[\/\-_]+/)
      .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !["products", "item", "listing", "l", "p"].includes(w));
    const fromPath = pathWords.slice(0, 5).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    const bank = TITLE_BANK[kind];
    const title = fromPath.length > 6 ? fromPath : bank[seed % bank.length];
    const price = [299, 499, 799, 999, 1499][seed % 5];
    const pal = PALETTES[seed % PALETTES.length];
    return {
      url,
      sourceName,
      title,
      kind,
      description: `${title} — a ready-to-use ${kind === "notion" ? "Notion kit" : kind} you can download right after paying. Imported from ${sourceName}; edit anything before you publish.`,
      price: fromMajor(price),
      images: [
        { id: uid("img"), alt: `${title} cover`, cover: { template: "split", title, subtitle: sourceName, ...pal } },
        { id: uid("img"), alt: `${title} preview`, cover: { template: "frame", title, subtitle: "Preview", ...PALETTES[(seed + 1) % PALETTES.length] } },
        { id: uid("img"), alt: `${title} detail`, cover: { template: "grid", title, subtitle: "Inside", ...PALETTES[(seed + 2) % PALETTES.length] } },
      ],
    };
  });
}
