import { fromMajor, money } from "../money";
import type { Customer, Order, Product } from "../types";
import type { Coupon, Review } from "../types/storefront";
import type { Db } from "./base";
import { DAY } from "./random";
import { seedDb } from "./seed";

/**
 * Stress dataset (QA Part 5 F). Same shape as the seeded store, pushed to the edges:
 * very long and unbroken text, Indic scripts, 500 products and orders, missing images,
 * tiny and huge prices, a 100%-off coupon, and 0 / 1 / 5000 review counts.
 * Switched on with localStorage `pp:seed` = "stress" (Demo menu → Stress data).
 */

export const STRESS = {
  longTitle: "The Complete Ultimate Notion Second Brain Operating System for Busy Founders, Freelancers, Students and Teams (2026 Edition, Lifetime Updates)",
  unbroken: "Supercalifragilisticexpialidociousproductivitysystemwithnospacesanywhereatall",
  url: "https://example.com/a-very-long-url-with-no-spaces-that-has-to-wrap-instead-of-pushing-the-card-wider/and/keeps/going",
  hindi: "नोशन में दूसरा दिमाग़: संस्थापकों और फ्रीलांसरों के लिए पूरी किट",
  tamil: "நிறுவனர்களுக்கான முழுமையான நோஷன் இரண்டாவது மூளை கிட்",
  telugu: "వ్యవస్థాపకుల కోసం పూర్తి నోషన్ సెకండ్ బ్రెయిన్ కిట్",
  kannada: "ಸಂಸ್ಥಾಪಕರಿಗಾಗಿ ಸಂಪೂರ್ಣ ನೋಷನ್ ಸೆಕೆಂಡ್ ಬ್ರೈನ್ ಕಿಟ್",
  creator: "Ananyalakshmi Venkatanarasimharajuvaripeta Raghunathan-Subramaniam",
  email: "support.refunds.and.everything.else.for.creators@ananyamakesthingsforpeople.co.in",
  coupon: "DIWALIMEGAFESTIVESALE2026EXTRA100PERCENTOFF",
  longReview:
    "I bought this on a whim during a sale and ended up rebuilding my entire week around it. The templates are thoughtful, the setup video is short, and the examples actually look like real work rather than lorem ipsum. Two small notes: the mobile layout of the weekly review page is cramped, and I wish there were a darker theme. Otherwise it's the best ₹1,499 I've spent this year. ".repeat(3).trim(),
} as const;

/** Product ids with fixed roles, so tests can open them directly */
export const STRESS_IDS = {
  longTitle: "prod_01",
  noImage: "prod_02",
  huge: "prod_03",
  tiny: "prod_04",
  manyReviews: "prod_01",
  oneReview: "prod_05",
  zeroReviews: "prod_06",
} as const;

const iso = (t: number) => new Date(t).toISOString();

export function stressDb(now: number = Date.now()): Db {
  const d = seedDb(now);
  d.mode = "stress";

  /* Store and creator */
  d.store.name = "Ananya Makes Notion Kits, Lightroom Presets and Very Long Playbooks Studio";
  d.store.ownerName = STRESS.creator;
  d.store.ownerEmail = STRESS.email;
  d.store.supportEmail = STRESS.email;
  d.store.tagline = `${STRESS.hindi}. Notion kits, presets and playbooks for people who make things, ship things and keep shipping.`;

  /* Products: edge cases first, then copies up to 500 */
  const published = d.products.filter((p) => p.status === "published");
  const titles = [STRESS.longTitle, STRESS.unbroken, STRESS.hindi, STRESS.tamil, STRESS.telugu, STRESS.kannada, STRESS.url];
  titles.forEach((t, i) => {
    const p = d.products[i];
    p.title = t;
    p.status = "published";
    p.images = p.images.map((img) => ({ ...img, alt: `${t} cover`, cover: img.cover ? { ...img.cover, title: t } : img.cover }));
  });
  d.products[1].images = [];
  d.products[2].price = fromMajor(9_999_999);
  d.products[2].compareAt = fromMajor(19_999_999);
  d.products[3].price = { amount: 100, currency: "INR" };
  d.products[3].compareAt = undefined;

  const copies: Product[] = [];
  for (let i = d.products.length; i < 500; i++) {
    const src = published[i % published.length];
    const id = `prod_s${i}`;
    copies.push({
      ...src,
      id,
      slug: `${src.slug}-${i}`,
      title: `${src.title} — volume ${i}`,
      sku: `ST-${String(i).padStart(4, "0")}`,
      images: src.images.map((img, j) => ({ ...img, id: `${id}_img${j}` })),
      files: src.files.map((f, j) => ({ ...f, id: `${id}_f${j}` })),
      salesCount: i % 7,
      revenue: money(0),
    });
  }
  d.products.push(...copies);

  /* Customers: long names and emails, some in Indic scripts */
  const names = [STRESS.creator, "प्रियंका शर्मा-वर्मा", "கார்த்திகேயன் சுப்பிரமணியன்", "వెంకట లక్ష్మీ నరసింహారావు", "ಶ್ರೀನಿವಾಸ ಮೂರ್ತಿ"];
  names.forEach((n, i) => {
    const c = d.customers[i];
    if (!c) return;
    c.name = n;
    if (i === 0) c.email = STRESS.email;
  });
  const byId = new Map<string, Customer>(d.customers.map((c) => [c.id, c]));
  const productTitle = new Map(d.products.map((p) => [p.id, p.title]));
  for (const o of d.orders) {
    const c = byId.get(o.customerId);
    if (c) {
      o.buyerName = c.name;
      o.buyerEmail = c.email;
    }
    o.productTitle = productTitle.get(o.productId) ?? o.productTitle;
  }

  /* Orders up to 500 (paid, older than the seeded month) */
  const extra: Order[] = [];
  const template = d.orders.find((o) => o.status === "paid")!;
  for (let i = d.orders.length; i < 500; i++) {
    const n = 5000 + i;
    const p = d.products[i % d.products.length];
    const c = d.customers[i % d.customers.length];
    extra.push({
      ...template,
      id: `ord_s${n}`,
      token: `tok_${n}_${(n * 7919).toString(36)}`,
      number: `PP-${n}`,
      productId: p.id,
      productTitle: p.title,
      customerId: c.id,
      buyerName: c.name,
      buyerEmail: c.email,
      invoiceNumber: `INV-${String(n).padStart(4, "0")}`,
      createdAt: iso(now - (31 + (i % 300)) * DAY),
    });
  }
  d.orders.push(...extra);

  /* Coupons: an unbroken code and a 100%-off one (zero total at checkout) */
  const free: Coupon = {
    id: "cp_stress_free",
    code: STRESS.coupon,
    kind: "percent",
    value: 100,
    used: 0,
    scope: "store",
    productIds: [],
    active: true,
  };
  d.coupons = [free, ...d.coupons];

  /* Reviews: 5000 on one product, exactly 1 on another, none on a third */
  const keep = d.reviews.filter((r) => r.productId !== STRESS_IDS.oneReview && r.productId !== STRESS_IDS.zeroReviews && r.productId !== STRESS_IDS.manyReviews);
  const photo = (i: number) => ({ id: `ph_stress_${i}`, alt: `Buyer photo ${i}`, cover: { template: "frame" as const, title: "Buyer photo", subtitle: `Photo ${i}`, bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" } });
  const base: Omit<Review, "id" | "productId" | "rating" | "createdAt"> = {
    title: "Good",
    body: "Worked as described.",
    photos: [],
    author: "Priya S.",
    helpful: 0,
    verified: true,
    imported: false,
    pinned: false,
    hidden: false,
    reported: false,
  };
  const many: Review[] = Array.from({ length: 5000 }, (_, i) => ({
    ...base,
    id: `rv_stress_${i}`,
    productId: STRESS_IDS.manyReviews,
    rating: ([5, 5, 5, 4, 4, 3, 5, 2, 5, 1] as const)[i % 10],
    createdAt: iso(now - (i % 400) * DAY),
  }));
  many[0] = { ...many[0], title: STRESS.longTitle, body: STRESS.longReview, photos: [photo(1), photo(2), photo(3)], author: STRESS.creator, pinned: true, helpful: 4210 };
  const one: Review = { ...base, id: "rv_stress_one", productId: STRESS_IDS.oneReview, rating: 4, title: STRESS.unbroken, body: STRESS.url, createdAt: iso(now - 3 * DAY) };
  d.reviews = [...many, one, ...keep];
  d.questions = d.questions.filter((q) => q.productId !== STRESS_IDS.zeroReviews);

  return d;
}
