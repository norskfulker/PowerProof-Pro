import { fromMajor } from "../money";
import { DEFAULT_SECTIONS } from "../store-themes";
import type { Bundle, Collection, Coupon, Deal, FontPairId, HeroStyle, PaletteId, Product, Question, Review, Store, StoreDesign, StorePages } from "../types";
import { DAY, rng, slugify } from "./random";

const iso = (t: number) => new Date(t).toISOString();

export function defaultPages(store: Pick<Store, "name" | "refundDays" | "supportEmail">): StorePages {
  return {
    faq: [
      { id: "f1", q: "How do I get my files?", a: "Right after paying you land on a download page, and the same link is emailed to you. No account needed." },
      { id: "f2", q: "Can I pay from outside India?", a: "Yes. You'll see prices in your currency and can pay by card." },
      { id: "f3", q: "Do I get updates?", a: "Yes. When a product is updated, your download link gets the new version." },
      { id: "f4", q: "What if it isn't right for me?", a: `Write within ${store.refundDays} days and we'll sort it out, usually with a refund.` },
      { id: "f5", q: "Can I get a GST invoice?", a: "Every order comes with an invoice. Open it from your order page." },
    ],
    refund: `If a file doesn't open, or the product isn't what the page described, write to ${store.supportEmail} within ${store.refundDays} days of buying. We'll fix it or refund you in full. Refunds go back to the original payment method in 5 to 7 working days, and the download link stops working once a refund is made.`,
    terms: `When you buy from ${store.name} you get a personal licence to use the files for yourself or your own projects. You can't resell, share or redistribute them. Prices include any GST that applies. Payments are handled by a licensed payment gateway through PowerProof.`,
    privacy: `${store.name} uses your name, email and phone only to deliver your order, send your receipt and answer your questions. Payment details go straight to the payment gateway and are never stored by us. We don't sell your data. Ask ${store.supportEmail} to see or delete what we hold.`,
    contactNote: "We reply within one working day, usually faster.",
  };
}

export function buildDesign(o: {
  store: Store;
  palette: PaletteId;
  fonts: FontPairId;
  heroStyle: HeroStyle;
  hero: { headline: string; subtext: string; cta: string };
  heroProductIds: string[];
  story: string;
  city: string;
  dealEndsAt: string;
  bumpProduct?: Product;
}): StoreDesign {
  const { store } = o;
  return {
    sections: DEFAULT_SECTIONS.map((id) => ({ id, enabled: true })),
    theme: { palette: o.palette, fonts: o.fonts, heroStyle: o.heroStyle },
    hero: { headline: o.hero.headline, subtext: o.hero.subtext, ctaLabel: o.hero.cta, ctaTarget: "products", imageProductIds: o.heroProductIds },
    announcement: { text: "Festive sale: 20% off everything", code: "FESTIVE20", endsAt: o.dealEndsAt },
    about: { name: store.ownerName, initials: store.ownerName.split(" ").map((w) => w[0]).join("").slice(0, 2), story: o.story, location: o.city },
    socials: { instagram: `https://instagram.com/${store.slug}`, youtube: `https://youtube.com/@${store.slug}`, x: `https://x.com/${store.slug}`, website: "" },
    seo: { title: `${store.name} · ${store.tagline.split(".")[0]}`, description: store.tagline },
    newsletter: { heading: "New drops, first.", body: "One short email when something new lands. No spam, unsubscribe any time." },
    orderBump: o.bumpProduct
      ? { productId: o.bumpProduct.id, price: fromMajor(Math.max(99, Math.round((o.bumpProduct.price.amount / 100) * 0.4))), label: `Add ${o.bumpProduct.title}` }
      : undefined,
    showPoweredBy: true,
  };
}

export function buildCollections(products: Product[], rows: [string, string, number[]][], colors: { bg: string; fg: string; accent: string }[]): Collection[] {
  return rows.map(([name, description, idx], i) => ({
    id: `col_${slugify(name)}_${products[0]?.id.slice(-4) ?? i}`,
    slug: slugify(name),
    name,
    description,
    productIds: idx.map((n) => products[n]?.id).filter(Boolean) as string[],
    cover: { template: (["block", "split", "frame", "grid", "stack", "badge"] as const)[i % 6], title: name, subtitle: `${idx.length} products`, ...colors[i % colors.length] },
  }));
}

export function buildOffers(products: Product[], now: number, key: string): { coupons: Coupon[]; bundles: Bundle[]; deals: Deal[] } {
  const ids = products.map((p) => p.id);
  return {
    coupons: [
      { id: `cp_${key}_1`, code: "FESTIVE20", kind: "percent", value: 20, expiresAt: iso(now + 6 * DAY), usageLimit: 500, used: 41, scope: "store", productIds: [], active: true },
      { id: `cp_${key}_2`, code: "WELCOME100", kind: "fixed", value: 100_00, usageLimit: 200, used: 88, scope: "store", productIds: [], minSpend: fromMajor(499), active: true },
      { id: `cp_${key}_3`, code: "FIRSTBOOK", kind: "percent", value: 15, scope: "products", productIds: ids.slice(0, 3), used: 12, active: true },
      { id: `cp_${key}_4`, code: "SUMMER10", kind: "percent", value: 10, expiresAt: iso(now - 20 * DAY), used: 230, scope: "store", productIds: [], active: true },
    ],
    bundles: [
      { id: `bd_${key}_1`, name: "Starter bundle", productIds: [ids[0], ids[1], ids[2]], pricing: { kind: "percent", percent: 30 }, active: true },
      { id: `bd_${key}_2`, name: "Everything pro", productIds: [ids[3], ids[6], ids[8], ids[11]].filter(Boolean), pricing: { kind: "percent", percent: 40 }, active: true },
    ],
    deals: [{ id: `dl_${key}_1`, name: "48-hour deal", productIds: [ids[4], ids[7]].filter(Boolean), percentOff: 30, startsAt: iso(now - 6 * 3600 * 1000), endsAt: iso(now + 42 * 3600 * 1000) }],
  };
}

const NAMES = ["Priya S.", "Rahul V.", "Sneha I.", "Arjun M.", "Kavya N.", "Rohan G.", "Ishita B.", "Vikram S.", "Emily C.", "Jordan L.", "Oliver B.", "Aisha K.", "Fatima A.", "Wei Lin T.", "Lucas M.", "Chloe W.", "Lena F.", "Tanvi S.", "Meera P.", "Aditya K."];

const GOOD: [string, string][] = [
  ["Worth every rupee", "I expected the usual fluff. It isn't. I used it the same evening and it saved me hours."],
  ["Exactly what it says", "Clear, well made and easy to use. The download worked straight away on my phone."],
  ["Better than the paid course I took", "Short, practical and no filler. I've recommended it to three friends already."],
  ["Clean and thoughtful", "You can tell a real person made this. Small details are done right."],
  ["Instant results", "Opened it, followed along, done. My clients noticed the difference."],
  ["Solid", "Does the job well. Would buy from this creator again."],
];
const MID: [string, string][] = [
  ["Good, a bit short", "Useful, but I wanted a few more examples. Still glad I bought it."],
  ["Nice but not for beginners", "Assumes you know the basics. Once I caught up, it was helpful."],
];
const LOW: [string, string][] = [
  ["Not for me", "Well made, but it didn't fit how I work. The creator offered a refund quickly, which I appreciated."],
];

export function buildReviews(products: Product[], now: number, seed: number, key: string, colors: { bg: string; fg: string; accent: string }[]): Review[] {
  const r = rng(seed);
  return Array.from({ length: 20 }, (_, i) => {
    const product = products[i % Math.min(products.length, 9)];
    const rating = r.weighted([[5, 11], [4, 5], [3, 2], [2, 1], [1, 1]] as [Review["rating"], number][]);
    const [title, body] = rating >= 4 ? GOOD[i % GOOD.length] : rating === 3 ? MID[i % MID.length] : LOW[0];
    const withPhoto = i % 5 === 1;
    return {
      id: `rv_${key}_${i + 1}`,
      productId: product.id,
      orderId: undefined,
      rating,
      title,
      body,
      photos: withPhoto ? [{ id: `ph_${key}_${i}`, alt: `Buyer photo of ${product.title}`, cover: { template: "frame" as const, title: product.title, subtitle: "Buyer photo", ...colors[i % colors.length] } }] : [],
      author: NAMES[(i * 7 + seed) % NAMES.length],
      createdAt: iso(now - r.int(1, 80) * DAY),
      helpful: r.int(0, 24),
      verified: true,
      imported: false,
      reply: i % 4 === 0 ? { body: rating >= 4 ? "Thank you, this made my day. Tell me what you build with it!" : "Sorry it wasn't a fit. I've refunded you and noted the feedback.", createdAt: iso(now - r.int(0, 10) * DAY) } : undefined,
      pinned: i < 2,
      hidden: false,
      reported: false,
    };
  });
}

const QS: [string, string, "creator" | "buyer"][] = [
  ["Does this work on an iPad?", "Yes. Everything opens in the Files app or any PDF reader.", "creator"],
  ["Is there a refund if it isn't useful?", "Yes, within the refund window. Just reply to your receipt.", "creator"],
  ["Do I get future updates for free?", "Yes, your download link always serves the latest version.", "creator"],
  ["Can I use this for client work?", "Yes for your own clients. You can't resell the files themselves.", "creator"],
  ["How long does it take to go through?", "I finished it in a weekend, doing a little each evening.", "buyer"],
  ["Is it beginner friendly?", "Mostly. The first section covers the basics.", "creator"],
  ["Can I pay with UPI?", "Yes, UPI, cards and netbanking all work at checkout.", "creator"],
];

export function buildQuestions(products: Product[], now: number, count: number, key: string, ownerFirst: string): Question[] {
  return Array.from({ length: count }, (_, i) => {
    const [body, answer, role] = QS[i % QS.length];
    const askers = ["Neha", "Sam", "Karan", "Divya", "Alex", "Zoya", "Imran"];
    return {
      id: `qn_${key}_${i + 1}`,
      productId: products[i % 6].id,
      asker: askers[i % askers.length],
      askerEmail: `${askers[i % askers.length].toLowerCase()}@example.com`,
      body,
      createdAt: iso(now - (i * 3 + 2) * DAY),
      answers: i === count - 1 ? [] : [{ id: `an_${key}_${i}`, author: role === "creator" ? ownerFirst : "Verified buyer", role, body: answer, createdAt: iso(now - (i * 3 + 1) * DAY) }],
      hidden: false,
      reported: false,
    };
  });
}
