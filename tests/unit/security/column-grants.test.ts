import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Creators and visitors may only read a safe list of columns on orders, reviews, questions,
 * profiles and stores (buyer phone and similar are deliberately hidden), so `select *` on those
 * tables fails with "permission denied". Code uses the creator_* views (where `select *` is safe)
 * or names columns that are granted. This keeps both true.
 *
 * The lists mirror the column grants in the database (supabase migrations 008, 009 and 012).
 */
const AUTHENTICATED: Record<string, string[]> = {
  orders: "available_at buyer_country buyer_email buyer_name consent_at created_at currency deals_applied discount_minor gateway gateway_order_id gateway_payment_id id invoice_no invoice_path paid_at ref status store_id subtotal_minor tax_minor total_minor updated_at".split(" "),
  reviews: "body created_at creator_reply id photos pinned product_id rating replied_at reviewer_name status store_id title".split(" "),
  questions: "answer answered_at asker_name body created_at id product_id status store_id".split(" "),
  profiles: "avatar_url country created_at email full_name id onboarding plan updated_at".split(" "),
  stores: "brand_color business_type company_address created_at currency_base gstin id invoice_footer invoice_prefix legal_name logo_url name owner_id pan refund_days slug status support_email tagline theme theme_mode updated_at".split(" "),
};
const ANON: Record<string, string[]> = {
  reviews: AUTHENTICATED.reviews,
  questions: AUTHENTICATED.questions,
  stores: "brand_color company_address created_at currency_base id legal_name logo_url name refund_days slug status support_email tagline theme theme_mode".split(" "),
};
/** Files that run for visitors with no sign-in */
const VISITOR_FILES = ["lib/api/live/storefront.ts"];

const ROOT = path.resolve(__dirname, "../../..");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = ["app", "components", "hooks", "lib"].flatMap((d) => walk(path.join(ROOT, d))).map((p) => ({ file: path.relative(ROOT, p).split(path.sep).join("/"), text: fs.readFileSync(p, "utf8") }));

interface Read {
  file: string;
  table: string;
  columns: string[] | "*";
}

function reads(): Read[] {
  const out: Read[] = [];
  for (const { file, text } of files) {
    const consts = new Map([...text.matchAll(/const\s+(\w+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
    for (const m of text.matchAll(/\.from\(\s*"(\w+)"\s*\)\s*\.select\(\s*([^)]*?)\s*(?:,\s*\{[^)]*\})?\s*\)/g)) {
      const arg = m[2].trim();
      let list: string | undefined;
      if (arg === "") list = "*";
      else if (/^["'`]/.test(arg)) list = arg.slice(1, -1);
      else list = consts.get(arg.split(",")[0].trim());
      if (list === undefined) continue; // a computed list: reviewed by hand
      const columns = list.trim() === "*" ? "*" : list.split(",").map((c) => c.trim().split(":").pop()!.split("(")[0].trim()).filter(Boolean);
      out.push({ file, table: m[1], columns });
    }
  }
  return out;
}

describe("column grants", () => {
  const all = reads();

  it("finds the reads it is meant to check", () => {
    expect(all.length).toBeGreaterThan(20);
    expect(all.some((r) => r.table === "creator_orders")).toBe(true);
  });

  it("never does `select *` (or an empty select) on a table with column grants", () => {
    const bad = all.filter((r) => r.table in AUTHENTICATED && r.columns === "*");
    expect(bad.map((r) => `${r.file}: ${r.table}`)).toEqual([]);
  });

  it("only names granted columns", () => {
    const bad = all.flatMap((r) => {
      if (r.columns === "*") return [];
      const grant = (VISITOR_FILES.includes(r.file) ? ANON : AUTHENTICATED)[r.table];
      if (!grant) return [];
      return r.columns.filter((c) => c !== "*" && !grant.includes(c)).map((c) => `${r.file}: ${r.table}.${c}`);
    });
    expect(bad).toEqual([]);
  });

  it("reads orders, reviews and questions for creators through the creator_* views", () => {
    const creatorFiles = ["lib/api/live/orders.ts", "lib/api/live/catalog.ts", "lib/api/analytics.ts"];
    const tables = all.filter((r) => creatorFiles.includes(r.file)).map((r) => r.table);
    for (const v of ["creator_orders", "creator_customers", "creator_sales_daily", "creator_product_sales", "creator_reviews", "creator_questions"]) expect(tables).toContain(v);
  });
});
