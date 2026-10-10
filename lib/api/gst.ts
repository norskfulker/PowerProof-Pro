import type { GstCompany } from "../gstin";

export type GstLookup = { ok: true; company: GstCompany } | { ok: false; code: "invalid" | "not_connected" | "not_found" | "unavailable" | "signed_out"; message: string };

/** Asks the server (which holds the provider's key) for a GSTIN's registered company details. */
export async function lookupGstin(gstin: string, signal?: AbortSignal): Promise<GstLookup> {
  try {
    const res = await fetch(`/api/gst?gstin=${encodeURIComponent(gstin)}`, { signal, cache: "no-store" });
    return (await res.json()) as GstLookup;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return { ok: false, code: "unavailable", message: "We couldn't reach the GST lookup. Check your connection, or fill the details in by hand." };
  }
}
