import { commit, db } from "../mock/db";
import { slugify, uid } from "../mock/random";
import type {
  BillingInvoice,
  Company,
  Integration,
  IntegrationId,
  InvoiceSettings,
  Notification,
  Page,
  PageTemplate,
  Plan,
  Sku,
  Store,
  TaxCode,
  TeamMember,
} from "../types";
import { ApiError, call, notFound } from "./client";
import { TEMPLATE_BLOCKS } from "../templates";

/* Store, company, invoice ------------------------------------------- */

export function getStore(): Promise<Store> {
  return call(() => db().store, { fast: true });
}

export function updateStore(patch: Partial<Store>): Promise<Store> {
  return call(() => {
    if (patch.slug !== undefined) {
      const s = slugify(patch.slug);
      if (s.length < 3) throw new ApiError("Store links need at least 3 letters or numbers.", "validation");
      if (RESERVED.includes(s)) throw new ApiError(`“${s}” is taken. Try adding your city or a word.`, "conflict");
      patch.slug = s;
    }
    commit((d) => Object.assign(d.store, patch));
    return db().store;
  });
}

const RESERVED = ["admin", "powerproof", "store", "shop", "help", "support", "api", "priya", "rahul"];

/** Debounced in the UI. Returns null when free. */
export function checkSlug(slug: string): Promise<{ available: boolean; suggestion?: string }> {
  return call(() => {
    const s = slugify(slug);
    const taken = RESERVED.includes(s);
    return { available: !taken && s.length >= 3, suggestion: taken ? `${s}-studio` : undefined };
  }, { fast: true });
}

export function getCompany(): Promise<Company> {
  return call(() => db().company);
}

export function updateCompany(patch: Partial<Company>): Promise<Company> {
  return call(() => {
    commit((d) => Object.assign(d.company, patch));
    return db().company;
  });
}

export function getInvoiceSettings(): Promise<InvoiceSettings> {
  return call(() => db().invoice);
}

export function updateInvoiceSettings(patch: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
  return call(() => {
    commit((d) => Object.assign(d.invoice, patch));
    return db().invoice;
  });
}

/* Tax codes and SKUs -------------------------------------------------- */

export function getTaxCodes(): Promise<TaxCode[]> {
  return call(() => db().taxCodes);
}

export function saveTaxCode(code: TaxCode): Promise<TaxCode[]> {
  return call(() => {
    if (!/^\d{4,8}$/.test(code.code)) throw new ApiError("HSN and SAC codes are 4 to 8 digits.", "validation");
    commit((d) => {
      const i = d.taxCodes.findIndex((t) => t.code === code.code);
      if (code.isDefault) d.taxCodes.forEach((t) => (t.isDefault = false));
      if (i >= 0) d.taxCodes[i] = code;
      else d.taxCodes.push(code);
    });
    return db().taxCodes;
  });
}

export function deleteTaxCode(code: string): Promise<TaxCode[]> {
  return call(() => {
    const d = db();
    if (d.products.some((p) => p.taxCode === code)) throw new ApiError("Products still use this code. Move them first.", "conflict");
    commit((x) => (x.taxCodes = x.taxCodes.filter((t) => t.code !== code)));
    return db().taxCodes;
  });
}

export function getSkus(): Promise<Sku[]> {
  return call(() => db().skus);
}

export function saveSku(sku: Omit<Sku, "id"> & { id?: string }): Promise<Sku[]> {
  return call(() => {
    const d = db();
    if (d.skus.some((s) => s.code.toLowerCase() === sku.code.toLowerCase() && s.id !== sku.id)) {
      throw new ApiError(`SKU ${sku.code} already exists.`, "conflict");
    }
    commit((x) => {
      const existing = sku.id && x.skus.find((s) => s.id === sku.id);
      const product = x.products.find((p) => p.id === sku.productId);
      if (existing) Object.assign(existing, sku, { productTitle: product?.title });
      else x.skus.unshift({ ...sku, id: uid("sku"), productTitle: product?.title });
      if (product) {
        product.sku = sku.code;
        product.taxCode = sku.taxCode;
      }
    });
    return db().skus;
  });
}

export function deleteSku(id: string): Promise<Sku[]> {
  return call(() => {
    commit((d) => (d.skus = d.skus.filter((s) => s.id !== id)));
    return db().skus;
  });
}

/* Integrations ---------------------------------------------------------- */

export function getIntegrations(): Promise<Integration[]> {
  return call(() => db().integrations);
}

const ID_RULES: Record<IntegrationId, RegExp> = {
  "google-analytics": /^G-[A-Z0-9]{6,12}$/,
  "microsoft-clarity": /^[a-z0-9]{8,12}$/,
};

export function connectIntegration(id: IntegrationId, value: string): Promise<Integration> {
  return call(() => {
    const v = id === "google-analytics" ? value.trim().toUpperCase() : value.trim();
    if (!ID_RULES[id].test(v)) {
      throw new ApiError(
        id === "google-analytics" ? "GA4 IDs look like G-ABC123XYZ. Find it in Admin › Data streams." : "Clarity project IDs are 8 to 12 lowercase letters and numbers.",
        "validation"
      );
    }
    commit((d) => {
      const it = d.integrations.find((x) => x.id === id)!;
      Object.assign(it, { value: v, connected: true, connectedAt: new Date().toISOString() });
    });
    return db().integrations.find((x) => x.id === id)!;
  });
}

export function disconnectIntegration(id: IntegrationId): Promise<Integration> {
  return call(() => {
    commit((d) => {
      const it = d.integrations.find((x) => x.id === id)!;
      Object.assign(it, { value: undefined, connected: false, connectedAt: undefined });
    });
    return db().integrations.find((x) => x.id === id)!;
  });
}

/* Team, plan, notifications ------------------------------------------- */

export function getTeam(): Promise<TeamMember[]> {
  return call(() => db().team);
}

export function inviteMember(email: string, role: TeamMember["role"]): Promise<TeamMember[]> {
  return call(() => {
    if (db().team.some((m) => m.email === email.toLowerCase())) throw new ApiError("They're already on your team.", "conflict");
    commit((d) => d.team.push({ id: uid("tm"), name: email.split("@")[0], email: email.toLowerCase(), role, status: "invited" }));
    return db().team;
  });
}

export function removeMember(id: string): Promise<TeamMember[]> {
  return call(() => {
    commit((d) => (d.team = d.team.filter((m) => m.id !== id || m.role === "owner")));
    return db().team;
  });
}

export function getPlan(): Promise<{ plan: Plan; invoices: BillingInvoice[] }> {
  return call(() => ({ plan: db().plan, invoices: db().billing }));
}

export function getNotifications(): Promise<Notification[]> {
  return call(() => db().notifications.slice(0, 12), { fast: true });
}

export function markNotificationsRead(): Promise<void> {
  return call(() => commit((d) => d.notifications.forEach((n) => (n.read = true))), { fast: true });
}

/* Pages ------------------------------------------------------------------ */

export function getPages(): Promise<Page[]> {
  return call(() => db().pages);
}

export function getPage(id: string): Promise<Page> {
  return call(() => db().pages.find((p) => p.id === id) ?? notFound("Page"));
}

export function createPage(template: PageTemplate, title: string, productId?: string, mode: Page["mode"] = "visual"): Promise<Page> {
  return call(() => {
    const page: Page = {
      id: uid("page"),
      title,
      slug: slugify(title) || "page",
      template,
      mode,
      blocks: TEMPLATE_BLOCKS[template].map((b) => ({ ...b, id: uid("b") })),
      html: mode === "html" ? STARTER_HTML : "",
      productIds: productId ? [productId] : [],
      status: "draft",
      views: 0,
      updatedAt: new Date().toISOString(),
    };
    commit((d) => d.pages.unshift(page));
    return page;
  });
}

export function updatePage(id: string, patch: Partial<Page>): Promise<Page> {
  return call(() => {
    const p = db().pages.find((x) => x.id === id) ?? notFound("Page");
    commit(() => Object.assign(p, patch, { updatedAt: new Date().toISOString() }));
    return p;
  });
}

export function deletePage(id: string): Promise<void> {
  return call(() => commit((d) => (d.pages = d.pages.filter((p) => p.id !== id))));
}

export const STARTER_HTML = `<section style="max-width:560px;margin:48px auto;padding:0 16px;font-family:system-ui">
  <h1 style="font-size:40px;line-height:1.1;margin:0 0 12px">Your product, your page.</h1>
  <p style="font-size:18px;color:#444">Paste your own HTML here. Any button with
  data-pp-buy="PRODUCT_ID" becomes a working buy button.</p>
  <button data-pp-buy="PRODUCT_ID">Buy now</button>
</section>`;
