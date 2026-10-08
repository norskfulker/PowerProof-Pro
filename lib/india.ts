export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Chandigarh", "Andaman and Nicobar Islands",
  "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep",
];

export const BUSINESS_TYPES = [
  { value: "individual", label: "Just me", hint: "No registered business. Most creators start here." },
  { value: "proprietorship", label: "Sole proprietorship", hint: "Registered in your name, with or without GST." },
  { value: "partnership", label: "Partnership or LLP", hint: "Two or more partners." },
  { value: "private_limited", label: "Private limited company", hint: "Registered with the MCA." },
] as const;

/** 15 characters: 2 digit state code, 10 char PAN, entity number, Z, checksum. */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;

/** Words of a name, lower-case, without punctuation. */
const words = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean))];

/**
 * A bank account must be in the company's name or in the name of the director who runs it. Names
 * match when one holds every word of the other ("Ravi Kumar" and "KUMAR RAVI S"). The database
 * applies the same rule.
 */
export function holderNameMatches(holder: string, allowed: (string | undefined | null)[]): boolean {
  const h = words(holder);
  if (!h.length) return false;
  return allowed.some((a) => {
    const w = words(a ?? "");
    return w.length > 0 && (h.every((x) => w.includes(x)) || w.every((x) => h.includes(x)));
  });
}

/** What can be sent on each network, and what an address on it looks like. */
export const CRYPTO_NETWORKS = {
  TRC20: { label: "TRON (TRC-20)", assets: ["USDT", "USDC"], re: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, example: "TXyZ…(34 characters, starts with T)" },
  ERC20: { label: "Ethereum (ERC-20)", assets: ["USDT", "USDC", "ETH"], re: /^0x[0-9a-fA-F]{40}$/, example: "0x… (42 characters)" },
  BEP20: { label: "BNB Smart Chain (BEP-20)", assets: ["USDT", "USDC"], re: /^0x[0-9a-fA-F]{40}$/, example: "0x… (42 characters)" },
  POLYGON: { label: "Polygon", assets: ["USDT", "USDC"], re: /^0x[0-9a-fA-F]{40}$/, example: "0x… (42 characters)" },
  SOLANA: { label: "Solana", assets: ["USDT", "USDC"], re: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, example: "32 to 44 letters and numbers" },
  BITCOIN: { label: "Bitcoin", assets: ["BTC"], re: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/, example: "starts with bc1, 1 or 3" },
} as const;
export type CryptoNetwork = keyof typeof CRYPTO_NETWORKS;
export type CryptoAsset = "USDT" | "USDC" | "BTC" | "ETH";
export const CRYPTO_ASSETS: CryptoAsset[] = ["USDT", "USDC", "BTC", "ETH"];

export const networksFor = (asset: CryptoAsset) => (Object.keys(CRYPTO_NETWORKS) as CryptoNetwork[]).filter((n) => (CRYPTO_NETWORKS[n].assets as readonly string[]).includes(asset));
export const isWalletAddress = (network: CryptoNetwork, address: string) => !!CRYPTO_NETWORKS[network]?.re.test(address.trim());

/** Each kind of payout method: at most this many (the database enforces it too). */
export const MAX_PAYOUT_METHODS_PER_KIND = 5;
