import { feeBreakdown, fromMajor, localPrice, money, sum } from "../money";
import type { BillingInvoice, Customer, Notification, Order, OrderStatus, Page, Payout, PayoutMethod, Product, Sku, TeamMember } from "../types";
import { baseCompany, baseIntegrations, basePlan, baseStore, DB_VERSION, SETTLE_MS, type Db } from "./base";
import { CUSTOMER_SEEDS, PRODUCT_SEEDS, SOURCE_WEIGHTS, TAX_CODES } from "./catalog";
import { DAY, rng, slugify } from "./random";

export { DB_VERSION, SETTLE_MS, freshDb, type Db } from "./base";

const iso = (t: number) => new Date(t).toISOString();

export function seedDb(now: number = Date.now()): Db {
  const r = rng(20261005);
  const store = baseStore(now);

  /* Products */
  const products: Product[] = PRODUCT_SEEDS.map((p, i) => {
    const id = `prod_${String(i + 1).padStart(2, "0")}`;
    const created = now - (60 - i * 4) * DAY;
    return {
      id,
      slug: slugify(p.title),
      title: p.title,
      description: p.description,
      kind: p.kind,
      price: fromMajor(p.price),
      compareAt: p.compareAt ? fromMajor(p.compareAt) : undefined,
      images: [
        { id: `${id}_img1`, alt: `${p.title} cover`, cover: { ...p.cover, title: p.title } },
        { id: `${id}_img2`, alt: `${p.title} preview`, cover: { ...p.cover, template: "badge", title: p.cover.subtitle ?? p.title } },
      ],
      files: p.files.map(([name, size, mime], j) => ({ id: `${id}_f${j}`, name, size, mime })),
      sku: `AM-${p.kind.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      taxCode: p.taxCode,
      status: p.status,
      createdAt: iso(created),
      updatedAt: iso(created + 2 * DAY),
      salesCount: 0,
      revenue: money(0),
    };
  });

  /* Customers (stats filled after orders) */
  const customers: Customer[] = CUSTOMER_SEEDS.map(([name, country, cc, currency], i) => ({
    id: `cus_${String(i + 1).padStart(2, "0")}`,
    name,
    email: `${name.toLowerCase().split(" ")[0]}.${name.toLowerCase().split(" ").slice(-1)[0]}@${r.pick(["gmail.com", "outlook.com", "yahoo.in", "proton.me", "icloud.com"])}`.replace(/\s/g, ""),
    country,
    countryCode: cc,
    currency,
    ordersCount: 0,
    totalSpent: money(0),
    firstOrderAt: iso(now),
    lastOrderAt: iso(0),
  }));

  /* Orders: 40, spread over 30 days, 5 of them today */
  const sellable = products.filter((p) => PRODUCT_SEEDS[products.indexOf(p)].weight > 0);
  const weights = sellable.map((p) => [p, PRODUCT_SEEDS[products.indexOf(p)].weight] as [Product, number]);
  const statusFor = (i: number): OrderStatus =>
    i === 3 ? "refund_requested" : i === 17 ? "refund_requested" : i === 11 || i === 29 ? "refunded" : i === 22 ? "failed" : i === 1 ? "pending" : "paid";

  const orders: Order[] = Array.from({ length: 40 }, (_, i) => {
    const product = r.weighted(weights);
    const customer = i < 25 ? customers[(i * 7) % 25] : r.pick(customers);
    const ageMs = i < 5 ? r.int(5, 60 * 9) * 60 * 1000 : r.int(1, 30) * DAY - r.int(0, 20) * 3600 * 1000;
    const created = now - ageMs;
    const status = statusFor(i);
    const fees = feeBreakdown(product.price);
    const n = 1041 + (40 - i);
    return {
      id: `ord_${n}`,
      number: `PP-${n}`,
      productId: product.id,
      productTitle: product.title,
      customerId: customer.id,
      buyerName: customer.name,
      buyerEmail: customer.email,
      country: customer.country,
      countryCode: customer.countryCode,
      buyerTotal: localPrice(product.price, customer.currency),
      total: product.price,
      fees: { gateway: fees.gateway, platform: fees.platform },
      net: fees.keep,
      status,
      source: r.weighted(SOURCE_WEIGHTS),
      downloads: status === "paid" ? r.int(1, 4) : 0,
      invoiceNumber: status === "paid" || status === "refunded" || status === "refund_requested" ? `INV-${String(n - 1000).padStart(4, "0")}` : undefined,
      paymentMethod: customer.currency === "INR" ? r.pick(["upi", "upi", "upi", "card", "netbanking"] as const) : "card",
      createdAt: iso(created),
      paidAt: status === "pending" || status === "failed" ? undefined : iso(created + 20 * 1000),
      refundedAt: status === "refunded" ? iso(created + DAY) : undefined,
      refundReason: status === "refunded" ? "File didn't open on my iPad" : status === "refund_requested" ? "Bought it twice by mistake" : undefined,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /* Denormalize product and customer stats */
  const counted = orders.filter((o) => o.status === "paid" || o.status === "refund_requested");
  for (const p of products) {
    const mine = counted.filter((o) => o.productId === p.id);
    p.salesCount = mine.length;
    p.revenue = sum(mine.map((o) => o.total));
  }
  for (const c of customers) {
    const mine = orders.filter((o) => o.customerId === c.id && o.status !== "failed" && o.status !== "pending");
    c.ordersCount = mine.length;
    c.totalSpent = sum(mine.map((o) => o.total));
    if (mine.length) {
      c.firstOrderAt = mine[mine.length - 1].createdAt;
      c.lastOrderAt = mine[0].createdAt;
    } else {
      c.firstOrderAt = c.lastOrderAt = iso(now - 40 * DAY);
    }
  }

  /* Payouts: weekly, most of the settled money already paid out */
  const payoutMethods: PayoutMethod[] = [
    { id: "pm_bank", kind: "bank", label: "HDFC Bank", last4: "4821", holderName: "Ananya Rao", ifsc: "HDFC0000123", bankName: "HDFC Bank", verified: true, primary: true },
    { id: "pm_usdt", kind: "usdt", label: "USDT (TRC-20)", last4: "", holderName: "", verified: false, primary: false, comingSoon: true },
  ];
  const payoutAmounts = [8420_00, 6215_50, 9980_00, 4310_25, 7120_00, 5604_75];
  const payouts: Payout[] = payoutAmounts.map((amt, i) => {
    const created = now - (i * 7 + 3) * DAY;
    const status = i === 0 ? "processing" : "paid";
    return {
      id: `po_${i + 1}`,
      amount: money(amt),
      status,
      methodId: "pm_bank",
      methodLabel: "HDFC Bank ····4821",
      reference: status === "paid" ? `UTR${(402917331 + i * 1371).toString()}` : undefined,
      createdAt: iso(created),
      arrivedAt: status === "paid" ? iso(created + DAY) : undefined,
    };
  });

  const skus: Sku[] = products.map((p) => ({ id: `sku_${p.id}`, code: p.sku, productId: p.id, productTitle: p.title, taxCode: p.taxCode }));

  const pages: Page[] = [
    {
      id: "page_launch",
      title: "Second Brain launch page",
      slug: "second-brain",
      template: "launch",
      mode: "visual",
      blocks: [
        { id: "b1", type: "hero", heading: "Stop losing ideas.", body: "A Notion workspace for founders who think in voice notes." },
        { id: "b2", type: "features", heading: "What's inside", body: "Goals board\nProject tracker\nWeekly review\nReading notes" },
        { id: "b3", type: "testimonial", heading: "“I finally know where things are.”", body: "Rohit, runs a D2C brand in Jaipur" },
        { id: "b4", type: "buy", heading: "Get the kit", body: "Instant access. Lifetime updates." },
      ],
      html: "",
      productIds: ["prod_01"],
      status: "live",
      views: 4812,
      updatedAt: iso(now - 2 * DAY),
    },
    {
      id: "page_presets",
      title: "Monsoon presets",
      slug: "monsoon",
      template: "minimal",
      mode: "visual",
      blocks: [
        { id: "b1", type: "hero", heading: "Rain, but make it cinematic.", body: "Twelve presets shot on Mumbai streets." },
        { id: "b2", type: "buy", heading: "Download the pack", body: "Lightroom mobile and desktop." },
      ],
      html: "",
      productIds: ["prod_02"],
      status: "live",
      views: 2290,
      updatedAt: iso(now - 9 * DAY),
    },
    {
      id: "page_html",
      title: "Pricing playbook (custom HTML)",
      slug: "pricing-playbook",
      template: "blank",
      mode: "html",
      blocks: [],
      html: `<section style="max-width:560px;margin:48px auto;font-family:system-ui;padding:0 16px">\n  <p style="letter-spacing:.08em;text-transform:uppercase;font-size:12px">Ebook</p>\n  <h1 style="font-size:40px;margin:8px 0">Quote with a straight face.</h1>\n  <p>Scripts, rate cards and the reply for “too expensive”.</p>\n  <button data-pp-buy="prod_03">Buy for ₹599</button>\n</section>`,
      productIds: ["prod_03"],
      status: "draft",
      views: 0,
      updatedAt: iso(now - 1 * DAY),
    },
  ];

  const team: TeamMember[] = [
    { id: "tm_owner", name: "Ananya Rao", email: "ananya@example.com", role: "owner", status: "active" },
    { id: "tm_2", name: "Kabir Rao", email: "kabir@example.com", role: "support", status: "active" },
    { id: "tm_3", name: "Devika S", email: "devika.design@example.com", role: "admin", status: "invited" },
  ];

  const billing: BillingInvoice[] = [
    { id: "bill_3", period: "September 2026", amount: money(2000, "USD"), platformFees: fromMajor(2148.6), status: "due", issuedAt: iso(now - 4 * DAY) },
    { id: "bill_2", period: "August 2026", amount: money(2000, "USD"), platformFees: fromMajor(1874.25), status: "paid", issuedAt: iso(now - 35 * DAY) },
    { id: "bill_1", period: "July 2026", amount: money(0, "USD"), platformFees: fromMajor(612.4), status: "free", issuedAt: iso(now - 64 * DAY) },
  ];

  const latest = orders.find((o) => o.status === "paid");
  const notifications: Notification[] = [
    latest && { id: "n1", kind: "sale" as const, title: "New sale", body: `${latest.buyerName} bought ${latest.productTitle}`, createdAt: latest.createdAt, read: false, href: `/orders/${latest.id}` },
    { id: "n2", kind: "refund" as const, title: "Refund asked", body: "Order PP-1078 · Bought it twice by mistake", createdAt: iso(now - 3 * 3600 * 1000), read: false, href: "/orders?status=refund_requested" },
    { id: "n3", kind: "payout" as const, title: "Payout on its way", body: "₹8,420.00 to HDFC Bank ····4821", createdAt: iso(now - 3 * DAY), read: true, href: "/payouts" },
  ].filter(Boolean) as Notification[];

  // Make the seeded balance land on a believable number: ₹12,480.50 available today.
  const settledNet = orders
    .filter((o) => o.status === "paid" && o.paidAt && now - Date.parse(o.paidAt) >= SETTLE_MS)
    .reduce((t, o) => t + o.net.amount, 0);

  return {
    version: DB_VERSION,
    mode: "seeded",
    ledger: { opening: 12480_50 - settledNet, since: iso(now) },
    store,
    company: baseCompany(),
    invoice: { prefix: "INV", nextNumber: 82, showGstin: true, footerNote: "Thanks for supporting an independent creator.", defaultTaxCode: "998433", pricesIncludeTax: true },
    products,
    orders,
    customers,
    payouts,
    payoutMethods,
    pages,
    skus,
    taxCodes: TAX_CODES,
    integrations: baseIntegrations(true),
    team,
    plan: basePlan(now, now - 64 * DAY),
    billing,
    notifications,
  };
}
