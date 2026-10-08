import type { AnalyticsTags } from "./types";

/**
 * Google Analytics 4 and Microsoft Clarity for a store. A creator pastes an ID; the tag loads on
 * their store (and on the buyer's order page) only after the visitor agrees, and only when the ID
 * is the right shape, so nothing pasted here can run as code.
 */
export const GA4_ID = /^G-[A-Z0-9]{6,12}$/;
export const CLARITY_ID = /^[a-z0-9]{8,12}$/;

export function cleanTags(t: AnalyticsTags | undefined): AnalyticsTags {
  const ga4Id = t?.ga4Id?.trim().toUpperCase();
  const clarityId = t?.clarityId?.trim().toLowerCase();
  return { ...(ga4Id && GA4_ID.test(ga4Id) ? { ga4Id } : {}), ...(clarityId && CLARITY_ID.test(clarityId) ? { clarityId } : {}) };
}

/** What's wrong with the text someone typed, or null */
export function ga4Error(v: string): string | null {
  const t = v.trim();
  return !t || GA4_ID.test(t.toUpperCase()) ? null : "Google Analytics 4 IDs look like G-ABC123XYZ. Find yours under Admin › Data streams.";
}
export function clarityError(v: string): string | null {
  const t = v.trim();
  return !t || CLARITY_ID.test(t.toLowerCase()) ? null : "Clarity project IDs are 8 to 12 letters and numbers. Find yours in the project's Settings.";
}

export const hasTags = (t: AnalyticsTags | undefined) => Object.keys(cleanTags(t)).length > 0;

const consentKey = (storeId: string) => `pp:analytics-consent:${storeId}`;
export function readConsent(storeId: string): "yes" | "no" | undefined {
  try {
    const v = localStorage.getItem(consentKey(storeId));
    return v === "yes" || v === "no" ? v : undefined;
  } catch {
    return undefined;
  }
}
export function writeConsent(storeId: string, v: "yes" | "no") {
  try {
    localStorage.setItem(consentKey(storeId), v);
  } catch {
    /* blocked storage: asked again next visit */
  }
}

type W = typeof window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; clarity?: ((...a: unknown[]) => void) & { q?: unknown[] } };
const loaded = new Set<string>();

/** Adds the tags once. Safe to call again. */
export function loadTags(tags: AnalyticsTags | undefined) {
  const t = cleanTags(tags);
  const w = window as W;
  if (t.ga4Id && !loaded.has(`ga:${t.ga4Id}`)) {
    loaded.add(`ga:${t.ga4Id}`);
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function (...a: unknown[]) { w.dataLayer!.push(a); };
    w.gtag("js", new Date());
    // Page views are sent by us on each page change, so the first one isn't doubled
    w.gtag("config", t.ga4Id, { send_page_view: false, anonymize_ip: true });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t.ga4Id)}`;
    document.head.appendChild(s);
  }
  if (t.clarityId && !loaded.has(`cl:${t.clarityId}`)) {
    loaded.add(`cl:${t.clarityId}`);
    w.clarity = w.clarity || Object.assign(function (...a: unknown[]) { (w.clarity!.q = w.clarity!.q || []).push(a); }, {});
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${encodeURIComponent(t.clarityId)}`;
    document.head.appendChild(s);
  }
}

/** A Google Analytics event; does nothing unless the tag is loaded */
export function gtagEvent(name: string, params: Record<string, unknown> = {}) {
  (window as W).gtag?.("event", name, params);
}
