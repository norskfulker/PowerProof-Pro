import type { BillingInvoice, Company, InvoiceSettings, Plan, Sku, Store, TaxCode } from "../types";
import { TAX_CODES } from "../tax-codes";
import { ApiError } from "./client";
import * as catalog from "./live/catalog";
import { liveChange } from "./live/notify";
import * as live from "./live/store";

/* Store, company, invoice ------------------------------------------- */

export const getStore = (): Promise<Store> => live.getStore();
export const updateStore = (patch: Partial<Store>): Promise<Store> => liveChange(live.updateStore(patch));
/** Debounced in the UI. */
export const checkSlug = (slug: string): Promise<{ available: boolean }> => live.checkSlug(slug);
export const suggestSlug = (name: string): Promise<string> => live.suggestSlug(name);
export const createStore = (input: { name: string; brandColor: string; slug: string; country: string }): Promise<{ slug: string }> => live.createStore(input);
export const getCompany = (): Promise<Company> => live.getCompany();
export const updateCompany = (patch: Partial<Company>): Promise<Company> => liveChange(live.updateCompany(patch));
export const getInvoiceSettings = (): Promise<InvoiceSettings> => live.getInvoiceSettings();
export const updateInvoiceSettings = (patch: Partial<InvoiceSettings>): Promise<InvoiceSettings> => liveChange(live.updateInvoiceSettings(patch));

/* Tax codes and SKUs -------------------------------------------------- */

/**
 * The GST reference list plus the creator's own codes (saved in tax_codes, with their rates).
 * Each product keeps its own code and rate, so invoices never change after the fact.
 */
export async function getTaxCodes(): Promise<TaxCode[]> {
  return [...TAX_CODES, ...(await catalog.getCustomTaxCodes())];
}

export const getCustomTaxCodes = (): Promise<TaxCode[]> => catalog.getCustomTaxCodes();
/** Add one of your own codes. Returns the whole list: reference codes first, then yours. */
export async function saveTaxCode(input: { code: string; kind: "HSN" | "SAC"; description?: string; rate: number }): Promise<TaxCode[]> {
  await liveChange(catalog.saveTaxCode(input));
  return getTaxCodes();
}

export async function deleteTaxCode(id: string): Promise<TaxCode[]> {
  await liveChange(catalog.deleteTaxCode(id));
  return getTaxCodes();
}

/** A SKU is a product's own sku, HSN/SAC code and tax rate: there is no separate list to keep. */
export async function getSkus(): Promise<Sku[]> {
  const products = await catalog.getProducts();
  return products.filter((p) => p.sku).map((p) => ({ id: p.id, code: p.sku, productId: p.id, productTitle: p.title, taxCode: p.taxCode }));
}

export async function saveSku(sku: Omit<Sku, "id"> & { id?: string }): Promise<Sku[]> {
  const productId = sku.productId ?? sku.id;
  if (!productId) throw new ApiError("Pick the product this SKU belongs to.", "validation");
  const code = sku.code.trim();
  if (!code) throw new ApiError("Enter a SKU code.", "validation");
  const taken = (await getSkus()).some((s) => s.code.toLowerCase() === code.toLowerCase() && s.id !== productId);
  if (taken) throw new ApiError(`SKU ${code} already exists.`, "conflict");
  // Keep the rate that goes with the chosen code (a custom code has its own)
  const rate = (await getTaxCodes()).find((c) => c.code === sku.taxCode)?.rate;
  await liveChange(catalog.updateProduct(productId, { sku: code, taxCode: sku.taxCode, ...(rate !== undefined ? { taxRate: rate } : {}) }));
  return getSkus();
}

export async function deleteSku(id: string): Promise<Sku[]> {
  await liveChange(catalog.updateProduct(id, { sku: "" }));
  return getSkus();
}

/* Plan --------------------------------------------------------------------- */

/** The creator's plan from their profile. Billing isn't connected, so there are no invoices yet. */
export async function getPlan(): Promise<{ plan: Plan; invoices: BillingInvoice[] }> {
  const { plan } = await live.getPlanState();
  return { plan, invoices: [] };
}
