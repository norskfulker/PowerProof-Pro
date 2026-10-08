import { GSTIN_RE, INDIAN_STATES, PAN_RE } from "./india";

/** GST state codes (the first two digits of a GSTIN) and the state they name. */
const STATE_BY_CODE: Record<string, (typeof INDIAN_STATES)[number]> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The 15th character is a check digit over the first 14 (base 36, weights 1 and 2). */
export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = ALPHABET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36];
}

export function isValidGstin(raw: string): boolean {
  const g = raw.trim().toUpperCase();
  return GSTIN_RE.test(g) && g[14] === gstinChecksum(g.slice(0, 14));
}

export interface GstinFacts {
  state?: (typeof INDIAN_STATES)[number];
  pan?: string;
  /** The business type the PAN's 4th letter points to, when it points to one */
  businessType?: "proprietorship" | "partnership" | "private_limited";
}

const TYPE_BY_PAN_LETTER: Record<string, GstinFacts["businessType"]> = { P: "proprietorship", F: "partnership", C: "private_limited" };

/** What the number itself says: state from the first two digits, PAN from the next ten. No lookup. */
export function readGstin(raw: string): GstinFacts {
  const g = raw.trim().toUpperCase();
  const pan = g.slice(2, 12);
  return { state: STATE_BY_CODE[g.slice(0, 2)], pan: PAN_RE.test(pan) ? pan : undefined, businessType: TYPE_BY_PAN_LETTER[pan[3]] };
}

/** What a GST data provider told us about a registration, in the company form's own fields. */
export interface GstCompany {
  legalName: string;
  tradeName?: string;
  /** "Active", "Cancelled", … as the portal reports it */
  status?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  pincode: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const first = (o: Obj, ...keys: string[]) => keys.map((k) => str(o[k])).find(Boolean) ?? "";

/**
 * Providers wrap the GST portal's record differently (`data`, `taxpayerInfo`, or the record
 * itself) but keep its field names (lgnm, tradeNam, pradr.addr…). This reads those, and a few
 * common plain-English spellings, and returns undefined when there's no legal name to use.
 */
export function parseGstRecord(json: unknown): GstCompany | undefined {
  let rec: unknown = json;
  for (const k of ["data", "result", "taxpayerInfo", "taxpayer"]) if (isObj(rec) && isObj(rec[k])) rec = rec[k];
  if (!isObj(rec)) return undefined;
  const legalName = first(rec, "lgnm", "legal_name", "legalName", "legal_name_of_business");
  if (!legalName) return undefined;
  const pr = isObj(rec.pradr) ? rec.pradr : {};
  const addr = isObj(pr.addr) ? pr.addr : isObj(rec.address) ? (rec.address as Obj) : {};
  const flat = typeof pr.adr === "string" ? pr.adr : typeof rec.address === "string" ? rec.address : typeof rec.principal_place_address === "string" ? rec.principal_place_address : "";
  const line1 = [first(addr, "flno", "floor"), first(addr, "bno", "building_number"), first(addr, "bnm", "building_name"), first(addr, "st", "street")].filter(Boolean).join(", ");
  const city = first(addr, "dst", "city", "district") || first(addr, "loc", "location");
  const locality = first(addr, "loc", "location");
  const state = first(addr, "stcd", "state") || undefined;
  const pincode = first(addr, "pncd", "pincode", "pin");
  return {
    legalName,
    tradeName: first(rec, "tradeNam", "trade_name", "tradeName") || undefined,
    status: first(rec, "sts", "status", "gstin_status") || undefined,
    address1: (line1 || flat.split(",").slice(0, 2).join(",")).trim(),
    address2: locality && locality !== city ? locality : undefined,
    city,
    state,
    pincode: /^\d{6}$/.test(pincode) ? pincode : "",
  };
}

/** Match a state name from a provider to our list ("NCT of Delhi" → Delhi, "Jammu & Kashmir" → Jammu and Kashmir). */
export function matchState(name?: string): (typeof INDIAN_STATES)[number] | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().replace(/&/g, "and").replace(/\bnct of\b/g, "").replace(/\s+/g, " ").trim();
  return INDIAN_STATES.find((s) => s.toLowerCase() === n) ?? INDIAN_STATES.find((s) => n.includes(s.toLowerCase()) || s.toLowerCase().includes(n));
}
