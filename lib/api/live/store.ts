import { commit, db } from "../../mock/db";
import { writeProgress } from "../../mock/progress";
import { slugify } from "../../mock/random";
import { type PlanLimits, type PlanTier } from "../../plans";
import { limitsFromRows } from "../../plan-limits";
import { sb } from "../../supabase/browser";
import type { TablesUpdate } from "../../database.types";
import type { AboutContent, Company, InvoiceSettings, Plan, Store, StoreDesign, StorePageKey, StorePages } from "../../types";
import { ApiError } from "../client";
import type { OwnedStore, PlanState, StoreInfo, StorePageUpdate } from "../account";
import { fail, must } from "./errors";
import { designFrom, designToTheme, initials, pagesFrom, storeFrom, DEFAULT_BRAND, type StoreRow } from "./map";
import { activeStoreId, currentUser, setActiveStore, syncSession } from "./session";

/** The creator's stores, their settings, design and pages, and the plan, from Supabase. */

/** Columns a creator reads for their own store (they may read all of them). */
const STORE_COLS = "id, owner_id, name, slug, tagline, logo_url, status, theme, theme_mode, currency_base, brand_color, support_email, refund_days, legal_name, company_address, gstin, invoice_prefix, invoice_footer, created_at, updated_at";

async function owner() {
  const u = await currentUser();
  return { id: u.id, name: u.name, email: u.email.toLowerCase() };
}

async function storeRow(storeId?: string): Promise<StoreRow> {
  const id = storeId ?? (await activeStoreId());
  return must(await sb().from("stores").select(STORE_COLS).eq("id", id).single(), { notFound: "Store" });
}

async function pageRows(storeId: string) {
  return must(await sb().from("store_pages").select("kind, content, edited").eq("store_id", storeId));
}

export async function getStore(storeId?: string): Promise<Store> {
  const [row, who] = await Promise.all([storeRow(storeId), owner()]);
  const store = storeFrom(row, who);
  const { pages } = pagesFrom(store, await pageRows(row.id));
  return { ...store, refundPolicy: pages.refund };
}

/* Store settings ------------------------------------------------------------ */

export async function checkSlug(slug: string): Promise<{ available: boolean; suggestion?: string }> {
  const s = slugify(slug);
  if (s.length < 3) return { available: false };
  // Visible to this creator: their own stores and every published one. Drafts of other creators
  // are hidden by RLS, so the unique index still has the last word when saving.
  const { data } = await sb().from("stores").select("id").eq("slug", s).limit(1);
  const mine = await activeStoreId();
  const taken = (data ?? []).some((r) => r.id !== mine);
  return { available: !taken, suggestion: taken ? `${s}-studio` : undefined };
}

export async function updateStore(patch: Partial<Store>): Promise<Store> {
  const id = await activeStoreId();
  const row: TablesUpdate<"stores"> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.slug !== undefined) {
    const s = slugify(patch.slug);
    if (s.length < 3) throw new ApiError("Store links need at least 3 letters or numbers.", "validation");
    row.slug = s;
  }
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  if (patch.brandColor !== undefined) row.brand_color = /^#[0-9a-f]{6}$/i.test(patch.brandColor) ? patch.brandColor : DEFAULT_BRAND;
  if (patch.supportEmail !== undefined) row.support_email = patch.supportEmail.trim() || null;
  if (patch.refundDays !== undefined) row.refund_days = Math.max(0, Math.min(365, Math.round(patch.refundDays)));
  if (patch.currency !== undefined) row.currency_base = patch.currency;
  if ("logo" in patch) row.logo_url = patch.logo?.src && /^https:\/\//.test(patch.logo.src) ? patch.logo.src : null;
  // Publishing is the end of onboarding: the store becomes visible to buyers
  if (patch.onboarded !== undefined) row.status = patch.onboarded ? "published" : "draft";
  if (Object.keys(row).length) {
    const r = await sb().from("stores").update(row).eq("id", id).select("id").single();
    if (r.error) fail(r.error, { conflict: `“${row.slug}” is taken. Try adding your city or a word.` });
  }
  if (patch.refundPolicy !== undefined) await savePage(id, "refund", { text: patch.refundPolicy.trim() });
  if (patch.name !== undefined || patch.slug !== undefined || patch.onboarded) writeProgress({ storeConfirmed: true });
  if (patch.name !== undefined) await syncSession();
  return getStore(id);
}

/* Company and invoice settings ------------------------------------------------ */

/**
 * Legal name, GSTIN and the address are stored on the store (they print on invoices). The address
 * is kept as six lines: address 1, address 2, city, state, PIN code, country. Business type and
 * PAN have no column yet and stay in this browser.
 */
const ADDRESS: (keyof Company)[] = ["address1", "address2", "city", "state", "pincode", "country"];

export async function getCompany(): Promise<Company> {
  const row = await storeRow();
  const lines = (row.company_address ?? "").split("\n");
  const local = db().company;
  const fromDb = Object.fromEntries(ADDRESS.map((k, i) => [k, lines[i] ?? ""])) as Partial<Company>;
  return { ...local, ...(row.company_address ? fromDb : {}), legalName: row.legal_name ?? "", gstin: row.gstin ?? undefined, country: fromDb.country || local.country || "India" };
}

export async function updateCompany(patch: Partial<Company>): Promise<Company> {
  const current = await getCompany();
  const next = { ...current, ...patch };
  const address = ADDRESS.map((k) => String(next[k] ?? "").replace(/\n/g, " ").trim()).join("\n");
  const r = await sb()
    .from("stores")
    .update({ legal_name: next.legalName.trim() || null, gstin: next.gstin?.trim().toUpperCase() || null, company_address: address.replace(/\n/g, "").length ? address.slice(0, 400) : null })
    .eq("id", await activeStoreId())
    .select("id")
    .single();
  if (r.error) {
    if (r.error.code === "23514" && r.error.message.includes("gstin")) throw new ApiError("That GSTIN doesn't look right. It's 15 characters, like 29ABCDE1234F1Z5.", "validation");
    fail(r.error);
  }
  commit((d) => Object.assign(d.company, { businessType: next.businessType, pan: next.pan }));
  return getCompany();
}

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const row = await storeRow();
  return { ...db().invoice, prefix: row.invoice_prefix ?? db().invoice.prefix, footerNote: row.invoice_footer ?? db().invoice.footerNote };
}

export async function updateInvoiceSettings(patch: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
  const row: TablesUpdate<"stores"> = {};
  if (patch.prefix !== undefined) {
    const p = patch.prefix.trim().toUpperCase();
    if (!/^[A-Z0-9/-]{2,12}$/.test(p)) throw new ApiError("Prefixes are 2 to 12 letters, numbers, / or -.", "validation");
    row.invoice_prefix = p;
  }
  if (patch.footerNote !== undefined) row.invoice_footer = patch.footerNote.slice(0, 500) || null;
  if (Object.keys(row).length) must(await sb().from("stores").update(row).eq("id", await activeStoreId()).select("id").single());
  // The rest (numbering preview, GST display options) stays in this browser for now
  commit((d) => Object.assign(d.invoice, patch));
  return getInvoiceSettings();
}

/* Several stores ---------------------------------------------------------------- */

export async function getOwnedStores(): Promise<OwnedStore[]> {
  const who = await owner();
  const active = await activeStoreId();
  const rows = must(await sb().from("stores").select("id, name, slug, brand_color, created_at").eq("owner_id", who.id).order("created_at"));
  const counts = must(await sb().from("products").select("store_id").in("store_id", rows.map((r) => r.id)));
  const list = rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, logoText: initials(r.name), brandColor: r.brand_color ?? DEFAULT_BRAND, active: r.id === active, products: counts.filter((c) => c.store_id === r.id).length }));
  return [...list.filter((s) => s.active), ...list.filter((s) => !s.active)];
}

export async function switchStore(storeId: string): Promise<Store> {
  const store = await getStore(storeId);
  setActiveStore(store.id);
  return store;
}

export async function createOwnedStore(input: { name: string; slug?: string }): Promise<Store> {
  const name = input.name.trim();
  if (name.length < 2) throw new ApiError("Give your store a name.", "validation");
  const slug = slugify(input.slug?.trim() || name);
  if (slug.length < 3) throw new ApiError("Use letters or numbers for the store link.", "validation");
  const who = await owner();
  const r = await sb()
    .from("stores")
    .insert({ owner_id: who.id, name, slug, tagline: `Digital downloads by ${who.name}.`, support_email: who.email || null })
    .select(STORE_COLS)
    .single();
  if (r.error) fail(r.error, { conflict: "That link is taken. Try another." });
  return storeFrom(r.data as StoreRow, who);
}

/* Design, About, FAQ and policies ------------------------------------------------ */

async function savePage(storeId: string, kind: StorePageKey, content: Record<string, unknown>) {
  must(
    await sb()
      .from("store_pages")
      .upsert({ store_id: storeId, kind, content: JSON.parse(JSON.stringify(content)), edited: true, updated_at: new Date().toISOString() })
      .select("kind")
      .single()
  );
}

async function info(storeId: string): Promise<StoreInfo & { design: StoreDesign }> {
  const [row, who, rows] = await Promise.all([storeRow(storeId), owner(), pageRows(storeId)]);
  const base = storeFrom(row, who);
  const designNoAbout = designFrom(base, row.theme, row.theme_mode);
  const { pages, about } = pagesFrom(base, rows, designNoAbout);
  return { store: { ...base, refundPolicy: pages.refund }, about, pages, design: { ...designNoAbout, about } };
}

export async function getStoreDesign(): Promise<StoreDesign> {
  return (await info(await activeStoreId())).design;
}

export async function updateStoreDesign(design: StoreDesign): Promise<StoreDesign> {
  if (!design.hero.headline.trim()) throw new ApiError("The hero needs a headline.", "validation");
  const id = await activeStoreId();
  const before = (await info(id)).design;
  must(await sb().from("stores").update({ theme: designToTheme(design), theme_mode: design.theme.mode ?? "auto" }).eq("id", id).select("id").single());
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!same(before.about, design.about)) await savePage(id, "about", { ...design.about });
  writeProgress((p) => ({
    customized: {
      hero: p.customized.hero || !same(before.hero, design.hero),
      colors: p.customized.colors || !same(before.theme, design.theme),
      about: p.customized.about || !same(before.about, design.about),
    },
  }));
  return (await info(id)).design;
}

export async function getStorePages(): Promise<StorePages> {
  return (await info(await activeStoreId())).pages;
}

/** Saves only the pages that changed. */
export async function updateStorePages(pages: StorePages): Promise<StorePages> {
  const id = await activeStoreId();
  const before = (await info(id)).pages;
  if (JSON.stringify(before.faq) !== JSON.stringify(pages.faq) || before.contactNote !== pages.contactNote) await savePage(id, "faq", { items: pages.faq, contactNote: pages.contactNote });
  for (const k of ["refund", "terms", "privacy"] as const) if (before[k] !== pages[k]) await savePage(id, k, { text: pages[k] });
  return (await info(id)).pages;
}

export async function getStoreInfo(storeId: string): Promise<StoreInfo> {
  const { store, about, pages } = await info(storeId);
  return { store, about, pages };
}

export async function updateStorePage(storeId: string, change: StorePageUpdate): Promise<StoreInfo> {
  if (change.key === "faq" && change.faq.some((f) => !f.q.trim() || !f.a.trim())) throw new ApiError("Every question needs an answer, and every answer a question.", "validation");
  if ((change.key === "refund" || change.key === "terms" || change.key === "privacy") && change.text.trim().length < 20) throw new ApiError("That's very short. Say what buyers can expect in a sentence or two.", "validation");
  if (change.key === "about") {
    await savePage(storeId, "about", { ...(change.about as AboutContent) });
    writeProgress((p) => ({ customized: { ...p.customized, about: true } }));
  } else if (change.key === "faq") {
    const cur = (await info(storeId)).pages;
    await savePage(storeId, "faq", { items: change.faq, contactNote: cur.contactNote });
  } else await savePage(storeId, change.key, { text: change.text.trim() });
  return getStoreInfo(storeId);
}

/* Plan and limits ---------------------------------------------------------------- */

/**
 * The plan comes from the profile and its limits from plan_limits, so the numbers match what the
 * database enforces. Creates aren't pre-checked: the database refuses, and the Upgrade dialog opens.
 */
export async function getPlanState(): Promise<PlanState> {
  const who = await owner();
  const [{ data: profile }, { data: limits }, { data: stores }] = await Promise.all([
    sb().from("profiles").select("plan, created_at").eq("id", who.id).single(),
    sb().from("plan_limits").select("*"),
    sb().from("stores").select("id").eq("owner_id", who.id),
  ]);
  const tier: PlanTier = profile?.plan ?? "free";
  const row = limits?.find((l) => l.plan === tier);
  const lim: PlanLimits = limitsFromRows(limits)[tier];
  const ids = (stores ?? []).map((s) => s.id);
  const { count } = ids.length ? await sb().from("products").select("id", { count: "exact", head: true }).in("store_id", ids) : { count: 0 };
  const local = db().plan;
  const plan: Plan = { ...local, tier, name: tier === "pro" ? "Pro" : "Free", platformFeePct: (row?.platform_fee_bps ?? 300) / 100, status: "active" };
  return { plan, tier, limits: lim, usage: { stores: ids.length, products: count ?? 0 } };
}

export async function canCreate(kind: "stores" | "products"): Promise<boolean> {
  const s = await getPlanState();
  const max = s.limits[kind];
  return max === null || s.usage[kind] < max;
}

export async function setPlanTier(tier: PlanTier): Promise<PlanState> {
  void tier;
  // profiles.plan can only be changed by PowerProof (billing isn't connected yet)
  throw new ApiError("Upgrades open soon. Write to support and we'll switch your account to Pro.", "validation");
}
