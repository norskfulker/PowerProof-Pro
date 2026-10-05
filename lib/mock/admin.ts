import { fromMajor } from "../money";
import type { AdminCreator, AdminPayout, Dispute, Flag } from "../types";
import { DAY, rng } from "./random";

/** Platform-wide mock data for the founder admin. Generated once per load. */
export function seedAdmin(now = Date.now()) {
  const r = rng(77);
  const iso = (t: number) => new Date(t).toISOString();
  const stores: [string, string, string, string][] = [
    ["Ananya Makes", "ananya", "Ananya Rao", "Mumbai"],
    ["Pixel Chai Studio", "pixelchai", "Harsh Patel", "Ahmedabad"],
    ["Notes by Nidhi", "nidhinotes", "Nidhi Agarwal", "Jaipur"],
    ["Frame Theory", "frametheory", "Karan Malhotra", "Delhi"],
    ["The Ledger Desk", "ledgerdesk", "Shruti Menon", "Kochi"],
    ["Beats from Bandra", "bandrabeats", "Zoya Fernandes", "Mumbai"],
    ["Code with Kartik", "kartikcodes", "Kartik Iyer", "Bengaluru"],
    ["Slow Kitchen", "slowkitchen", "Lakshmi Rao", "Hyderabad"],
    ["Desi Design Co", "desidesign", "Aman Gill", "Chandigarh"],
    ["Study with Sana", "sanastudy", "Sana Mirza", "Lucknow"],
    ["Wanderframes", "wanderframes", "Rhea Kapoor", "Goa"],
    ["Quiet Planner", "quietplanner", "Ira Sen", "Kolkata"],
  ];
  const creators: AdminCreator[] = stores.map(([storeName, slug, ownerName, city], i) => ({
    id: `cr_${i + 1}`,
    storeName,
    slug,
    ownerName,
    email: `${slug}@example.com`,
    city,
    plan: i === 3 ? "past_due" : i === 10 ? "suspended" : i > 8 ? "trial" : "active",
    gmv30d: fromMajor(r.int(4, 260) * 1000 + r.int(0, 99) * 10),
    orders30d: r.int(3, 420),
    kyc: i === 9 ? "pending" : i === 10 ? "rejected" : i === 11 ? "pending" : "verified",
    joinedAt: iso(now - r.int(5, 200) * DAY),
    risk: i === 10 ? "high" : i === 3 || i === 7 ? "medium" : "low",
  }));

  const disputes: Dispute[] = [
    { id: "dp_1", orderNumber: "PP-2210", storeName: "Frame Theory", buyerEmail: "mike.r@gmail.com", amount: fromMajor(1999), reason: "not_as_described", status: "open", dueBy: iso(now + 3 * DAY), openedAt: iso(now - 2 * DAY) },
    { id: "dp_2", orderNumber: "PP-1987", storeName: "Wanderframes", buyerEmail: "j.doe@outlook.com", amount: fromMajor(899), reason: "fraud", status: "under_review", dueBy: iso(now + 6 * DAY), openedAt: iso(now - 4 * DAY) },
    { id: "dp_3", orderNumber: "PP-1802", storeName: "Pixel Chai Studio", buyerEmail: "sam@proton.me", amount: fromMajor(499), reason: "not_received", status: "open", dueBy: iso(now + 1 * DAY), openedAt: iso(now - 5 * DAY) },
    { id: "dp_4", orderNumber: "PP-1650", storeName: "Notes by Nidhi", buyerEmail: "aarav@yahoo.in", amount: fromMajor(349), reason: "duplicate", status: "won", dueBy: iso(now - 4 * DAY), openedAt: iso(now - 12 * DAY) },
    { id: "dp_5", orderNumber: "PP-1533", storeName: "Beats from Bandra", buyerEmail: "kim@icloud.com", amount: fromMajor(1199), reason: "fraud", status: "lost", dueBy: iso(now - 9 * DAY), openedAt: iso(now - 20 * DAY) },
  ];

  const payouts: AdminPayout[] = creators.slice(0, 8).map((c, i) => ({
    id: `apo_${i + 1}`,
    storeName: c.storeName,
    amount: fromMajor(r.int(2, 60) * 1000 + r.int(0, 99) + 0.5),
    method: `Bank ····${String(1000 + r.int(0, 8999))}`,
    status: i === 3 ? "on_hold" : i === 6 ? "failed" : i > 4 ? "sent" : "queued",
    requestedAt: iso(now - r.int(1, 30) * 3600 * 1000),
    note: i === 3 ? "Open dispute on this store" : i === 6 ? "IFSC mismatch" : undefined,
  }));

  const flags: Flag[] = [
    { id: "fl_1", kind: "product", target: "Guaranteed 10k Followers Method", storeName: "Wanderframes", reason: "Misleading claims", reporter: "Automated check", status: "open", createdAt: iso(now - 6 * 3600 * 1000) },
    { id: "fl_2", kind: "product", target: "Premium Netflix Accounts", storeName: "Wanderframes", reason: "Prohibited item", reporter: "buyer report", status: "open", createdAt: iso(now - 1 * DAY) },
    { id: "fl_3", kind: "page", target: "Crypto Signals VIP", storeName: "Desi Design Co", reason: "Financial promises", reporter: "Automated check", status: "open", createdAt: iso(now - 2 * DAY) },
    { id: "fl_4", kind: "store", target: "Frame Theory", storeName: "Frame Theory", reason: "Chargeback rate above 1%", reporter: "Risk rules", status: "open", createdAt: iso(now - 3 * DAY) },
    { id: "fl_5", kind: "product", target: "Wedding LUTs Pack", storeName: "Frame Theory", reason: "Copyright claim", reporter: "rights holder", status: "dismissed", createdAt: iso(now - 9 * DAY) },
  ];

  return { creators, disputes, payouts, flags };
}

let cache: ReturnType<typeof seedAdmin> | null = null;

/** Platform admin data, generated once per page load and kept in memory. */
export function adminDb() {
  return (cache ??= seedAdmin());
}
