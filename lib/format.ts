export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  return formatDate(iso);
}

export function formatDate(iso: string, opts: { time?: boolean } = {}): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!opts.time) return date;
  return `${date}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const FLAGS: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AE: "UAE",
  SG: "Singapore",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
};

export function countryShort(code: string): string {
  return FLAGS[code] ?? code;
}

export const SITE_URL = "powerproof.store";
export function storeUrl(slug: string): string {
  return `${SITE_URL}/${slug}`;
}

const SOURCES: Record<string, string> = {
  instagram: "Instagram",
  direct: "Direct",
  google: "Google",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  newsletter: "Newsletter",
};

export function sourceLabel(s: string): string {
  return SOURCES[s] ?? s;
}
