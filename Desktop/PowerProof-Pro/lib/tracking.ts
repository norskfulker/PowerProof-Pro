import type { TrafficSource } from "./types";

/**
 * Where a visit came from, from the page that sent them (or the link's utm_source). Cookieless
 * counting: a random per-tab id and the answer to this, nothing about the person.
 */
const HOSTS: [RegExp, TrafficSource][] = [
  [/(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)yahoo\.com$/, "google"],
  [/(^|\.)instagram\.com$|^l\.instagram\.com$/, "instagram"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$|^t\.co$/, "twitter"],
  [/(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$/, "facebook"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
];
const NAMED: Record<string, TrafficSource> = { google: "google", instagram: "instagram", ig: "instagram", youtube: "youtube", twitter: "twitter", x: "twitter", facebook: "facebook", fb: "facebook", linkedin: "linkedin", whatsapp: "whatsapp", newsletter: "newsletter", email: "newsletter" };

export function classifySource(referrer: string, search: string, ownHost: string): TrafficSource {
  const q = new URLSearchParams(search);
  const named = (q.get("utm_source") ?? q.get("ref") ?? "").toLowerCase();
  if (NAMED[named]) return NAMED[named];
  if ((q.get("utm_medium") ?? "").toLowerCase() === "email") return "newsletter";
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (host === ownHost) return "direct";
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? "other";
}

/** Browsers that ask not to be tracked, and automated ones, are not counted */
export function shouldCount(nav: { doNotTrack?: string | null; webdriver?: boolean }): boolean {
  return nav.doNotTrack !== "1" && !nav.webdriver;
}
