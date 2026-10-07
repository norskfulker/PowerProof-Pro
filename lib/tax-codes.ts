import type { TaxCode } from "./types";

/**
 * GST reference codes for digital goods (SAC, services accounting codes). This is regulatory
 * reference data creators pick from, not store data: products keep the chosen code in
 * products.hsn_sac and its rate in products.tax_rate_bps.
 */
export const TAX_CODES: TaxCode[] = [
  { code: "998431", kind: "SAC", description: "Online text-based information (ebooks, guides)", rate: 18 },
  { code: "998433", kind: "SAC", description: "Other online content (templates, kits)", rate: 18, isDefault: true },
  { code: "998434", kind: "SAC", description: "Software and digital downloads", rate: 18 },
  { code: "999293", kind: "SAC", description: "Commercial training and coaching", rate: 18 },
  { code: "998439", kind: "SAC", description: "Other online content not elsewhere listed", rate: 18 },
];

export const DEFAULT_TAX_CODE = "998433";
