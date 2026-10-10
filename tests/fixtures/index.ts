/**
 * Test-only fixtures. Made-up records for unit and component tests that need data of a certain
 * shape. Production code must never import from here (an ESLint rule and a test both enforce it),
 * and the app never reads from it: the app only ever shows what is in the database.
 */
import { defaultDesign, defaultPages } from "@/lib/defaults/store";
import { fromMajor, money } from "@/lib/money";
import { priceInfo, ratingSummary } from "@/lib/pricing";
import type { CardProduct } from "@/components/pp/store-product-card";
import type { Collection, Coupon, Deal, DealRule, Order, PayoutMethod, Product, Question, Review, Store } from "@/lib/types";

export const NOW = Date.parse("2026-10-05T05:30:00Z");
const iso = (offsetDays: number) => new Date(NOW + offsetDays * 86_400_000).toISOString();

const palettes = [
  { bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" },
  { bg: "#1D5C7A", fg: "#F5F6F4", accent: "#C9A24F" },
  { bg: "#F6EFDF", fg: "#0C1F1B", accent: "#A9823A" },
];

function product(n: number, over: Partial<Product> = {}): Product {
  const title = `Fixture product ${n}`;
  const pal = palettes[n % palettes.length];
  return {
    id: `prod_fx_${n}`,
    slug: `fixture-product-${n}`,
    title,
    description: `${title}. A made-up product for tests.`,
    kind: "ebook",
    fulfilment: "digital",
    price: fromMajor(500 + n * 100),
    images: [
      { id: `img_fx_${n}_1`, alt: `${title} cover`, cover: { template: "split", title, subtitle: "Fixture", ...pal } },
      { id: `img_fx_${n}_2`, alt: `${title} preview`, cover: { template: "frame", title, subtitle: "Preview", ...pal } },
    ],
    files: [{ id: `file_fx_${n}`, name: `fixture-${n}.pdf`, size: 2_400_000, mime: "application/pdf" }],
    sku: `FX-${String(n).padStart(3, "0")}`,
    taxCode: "998433",
    status: "published",
    createdAt: iso(-30 + n),
    updatedAt: iso(-20 + n),
    salesCount: 0,
    revenue: money(0),
    ...over,
  };
}

const products: Product[] = Array.from({ length: 8 }, (_, i) => product(i + 1));
products[7] = { ...products[7], status: "draft" };

const store: Store = {
  id: "store_fx",
  name: "Fixture Store",
  slug: "fixture-store",
  tagline: "A made-up store for tests.",
  country: "IN",
  ownerName: "Test Owner",
  ownerEmail: "owner@test.invalid",
  brandColor: "#0F3D33",
  logoText: "FS",
  currency: "INR",
  supportEmail: "support@test.invalid",
  refundPolicy: "Fixture refund policy for tests.",
  refundDays: 7,
  createdAt: iso(-60),
  onboarded: true,
};

const design = { ...defaultDesign(store), announcement: { text: "Fixture announcement" } };

const collections: Collection[] = [
  { id: "col_fx_1", slug: "fixture-collection", name: "Fixture collection", productIds: [products[0].id, products[1].id], cover: { template: "block", title: "Fixture collection", subtitle: "2 products", ...palettes[0] } },
];

const coupons: Coupon[] = [{ id: "cp_fx_1", code: "TESTCODE", kind: "percent", value: 20, used: 0, scope: "store", productIds: [], active: true }];

const deals: Deal[] = [{ id: "dl_fx_1", name: "Fixture deal", productIds: [products[3].id], percentOff: 30, startsAt: iso(-1), endsAt: iso(2) }];

const rule = (id: string, spec: Partial<DealRule> & Pick<DealRule, "kind">): DealRule => ({ id: `dr_fx_${id}`, name: `Fixture rule ${id}`, active: true, stackable: false, createdAt: iso(-10), ...spec }) as DealRule;
const dealRules: DealRule[] = [
  rule("bundle", { kind: "bundle_discount", productIds: [products[0].id, products[2].id], percent: 25 }),
  rule("gift", { kind: "choose_gift", triggerIds: [], minSpend: fromMajor(1500), giftIds: [products[4].id, products[5].id], stackable: true }),
  rule("tiers", { kind: "tiers", productIds: [], tiers: [{ minItems: 2, percent: 10 }, { minItems: 3, percent: 20 }] }),
  rule("spend", { kind: "spend_threshold", minSpend: fromMajor(999), percent: 15 }),
  rule("cheapest", { kind: "buy_x_get_cheapest", productIds: [], buy: 3 }),
  rule("free", { kind: "free_gift", triggerIds: [products[0].id, products[1].id], giftId: products[4].id, stackable: true }),
];

const reviews: Review[] = Array.from({ length: 6 }, (_, i) => ({
  id: `rv_fx_${i + 1}`,
  productId: products[i % 3].id,
  rating: ([5, 5, 4, 4, 3, 1] as const)[i],
  title: `Fixture review ${i + 1}`,
  body: `A made-up review body number ${i + 1}.`,
  photos: [],
  author: `Reviewer ${i + 1}`,
  createdAt: iso(-i - 1),
  helpful: 0,
  verified: true,
  imported: false,
  reply: i === 0 ? { body: "Fixture reply from the creator.", createdAt: iso(0) } : undefined,
  pinned: i === 0,
  hidden: false,
  reported: false,
}));

const questions: Question[] = [
  { id: "qn_fx_1", productId: products[0].id, asker: "Asker", askerEmail: "asker@test.invalid", body: "Does this work on a tablet?", createdAt: iso(-3), answers: [{ id: "an_fx_1", author: "Test", role: "creator", body: "Yes it does.", createdAt: iso(-2) }], hidden: false, reported: false },
  { id: "qn_fx_2", productId: products[1].id, asker: "Asker", askerEmail: "asker@test.invalid", body: "Is there a refund window?", createdAt: iso(-1), answers: [], hidden: false, reported: false },
];

const orders: Order[] = Array.from({ length: 4 }, (_, i) => ({
  id: `ord_fx_${i + 1}`,
  token: `tok_fx_${i + 1}`,
  storeId: store.id,
  number: `PP-${2001 + i}`,
  productId: products[i].id,
  productTitle: products[i].title,
  customerId: `cus_fx_${i + 1}`,
  buyerName: `Buyer ${i + 1}`,
  buyerEmail: `buyer${i + 1}@test.invalid`,
  country: "India",
  countryCode: "IN",
  buyerTotal: products[i].price,
  total: products[i].price,
  fees: { gateway: money(0), platform: money(0) },
  net: products[i].price,
  status: "paid" as const,
  createdAt: iso(-i),
  paidAt: iso(-i),
  items: [{ productId: products[i].id, title: products[i].title, price: products[i].price, kind: "product" as const }],
}));

const payoutMethods: PayoutMethod[] = [{ id: "pm_fx_1", kind: "bank", label: "Fixture Bank", last4: "0000", holderName: "Test Owner", verified: true, primary: true }];

/** One test store with the things the component tests render. */
export const DB = {
  store,
  design,
  storePages: defaultPages(store),
  products,
  collections,
  coupons,
  deals,
  dealRules,
  reviews,
  questions,
  orders,
  payoutMethods,
  otherStores: [{ dealRules: [rule("other", { kind: "spend_threshold", minSpend: fromMajor(500), percent: 10 })] }],
};

export const PRODUCT = products[0];
export const ORDER = orders[0];
export const REVIEW = reviews[0];
export const QUESTION = questions[0];
export const COUPON = coupons[0];
export const COLLECTION = collections[0];

export const card = (over: Partial<CardProduct> = {}): CardProduct => ({
  ...PRODUCT,
  info: priceInfo(PRODUCT, deals, NOW),
  rating: ratingSummary(reviews.filter((r) => r.productId === PRODUCT.id)),
  ...over,
});

/** Edge-case text for layout and truncation tests. */
export const LONG = {
  longTitle: "The Complete Ultimate Second Brain Operating System for Busy Founders, Freelancers, Students and Teams (2026 Edition, Lifetime Updates)",
  unbroken: "Supercalifragilisticexpialidociousproductivitysystemwithnospacesanywhereatall",
  hindi: "नोशन में दूसरा दिमाग़: संस्थापकों और फ्रीलांसरों के लिए पूरी किट",
  tamil: "நிறுவனர்களுக்கான முழுமையான நோஷன் இரண்டாவது மூளை கிட்",
  telugu: "వ్యవస్థాపకుల కోసం పూర్తి నోషన్ సెకండ్ బ్రెయిన్ కిట్",
  kannada: "ಸಂಸ್ಥಾಪಕರಿಗಾಗಿ ಸಂಪೂರ್ಣ ನೋಷನ್ ಸೆಕೆಂಡ್ ಬ್ರೈನ್ ಕಿಟ್",
  coupon: "DIWALIMEGAFESTIVESALE2026EXTRA100PERCENTOFF",
  longReview: "A long made-up review that keeps going so the layout has to wrap it properly. ".repeat(8).trim(),
} as const;

export const INR = (n: number) => fromMajor(n);

/** Plan limits as the plan_limits table would return them. */
export const TEST_PLAN_LIMITS = {
  free: { stores: 1, products: 10, pages: 3, aiCredits: 10, aiPagesDaily: 1, customDomain: false },
  pro: { stores: null, products: null, pages: null, aiCredits: 200, aiPagesDaily: 10, customDomain: true },
};
