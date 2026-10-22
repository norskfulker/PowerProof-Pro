import { sb } from "../../supabase/browser";
import type { Customer, CustomerSegment, SegmentRules } from "../../types";
import { ApiError } from "../client";
import { must } from "./errors";
import { activeStoreId } from "./session";

/**
 * Notes, tags, email consent and saved segments for customers (buyers by email, per store).
 * customer_profiles and customer_segments are the store team's; customer_audience says who asked
 * for the store's emails.
 */

export interface CustomerExtras {
  tags: string[];
  note?: string;
  subscribed: boolean;
  unsubscribed: boolean;
}

/** Everything extra about every customer, by lower-cased email */
export async function customerExtras(storeId: string): Promise<Map<string, CustomerExtras>> {
  const client = sb();
  const [profiles, audience] = await Promise.all([
    client.from("customer_profiles").select("email, note, tags, unsubscribed_at").eq("store_id", storeId),
    client.rpc("customer_audience", { p_store: storeId }),
  ]);
  const out = new Map<string, CustomerExtras>();
  for (const a of audience.data ?? []) out.set(a.email.toLowerCase(), { tags: [], subscribed: a.opted_in && !a.unsubscribed, unsubscribed: a.unsubscribed });
  for (const p of profiles.data ?? []) {
    const key = String(p.email).toLowerCase();
    const cur = out.get(key) ?? { tags: [], subscribed: false, unsubscribed: false };
    out.set(key, { ...cur, tags: p.tags ?? [], note: p.note ?? undefined, unsubscribed: cur.unsubscribed || !!p.unsubscribed_at, subscribed: cur.subscribed && !p.unsubscribed_at });
  }
  return out;
}

const cleanTags = (tags: string[]) => [...new Set(tags.map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 20);

/** Save a customer's note and tags */
export async function saveCustomerProfile(email: string, patch: { note?: string; tags?: string[] }): Promise<void> {
  const storeId = await activeStoreId();
  const row: { store_id: string; email: string; note?: string | null; tags?: string[] } = { store_id: storeId, email: email.toLowerCase() };
  if (patch.note !== undefined) row.note = patch.note.trim().slice(0, 4000) || null;
  if (patch.tags !== undefined) row.tags = cleanTags(patch.tags);
  const r = await sb().from("customer_profiles").upsert(row, { onConflict: "store_id,email" }).select("email").single();
  if (r.error) throw new ApiError("That didn't save. Try again.");
}

/** Add one tag to several customers */
export async function tagCustomers(customers: Pick<Customer, "email" | "tags">[], tag: string): Promise<void> {
  const storeId = await activeStoreId();
  const rows = customers.map((c) => ({ store_id: storeId, email: c.email.toLowerCase(), tags: cleanTags([...c.tags, tag]) }));
  const r = await sb().from("customer_profiles").upsert(rows, { onConflict: "store_id,email" });
  if (r.error) throw new ApiError("Those tags didn't save. Try again.");
}

export async function getSegments(): Promise<CustomerSegment[]> {
  const rows = must(await sb().from("customer_segments").select("id, name, rules").eq("store_id", await activeStoreId()).order("created_at"));
  return rows.map((r) => ({ id: r.id, name: r.name, rules: r.rules as unknown as SegmentRules }));
}

export async function saveSegment(name: string, rules: SegmentRules): Promise<CustomerSegment> {
  const r = await sb().from("customer_segments").insert({ store_id: await activeStoreId(), name: name.trim().slice(0, 60), rules: rules as never }).select("id, name, rules").single();
  if (r.error) throw new ApiError("That view didn't save. Try again.");
  return { id: r.data.id, name: r.data.name, rules: r.data.rules as unknown as SegmentRules };
}

export async function deleteSegment(id: string): Promise<void> {
  must(await sb().from("customer_segments").delete().eq("id", id).select("id"));
}

export async function getEmailSends(): Promise<{ id: string; subject: string; recipients: number; createdAt: string }[]> {
  const rows = must(await sb().from("email_sends").select("id, subject, recipients, created_at").eq("store_id", await activeStoreId()).order("created_at", { ascending: false }).limit(20));
  return rows.map((r) => ({ id: r.id, subject: r.subject, recipients: r.recipients, createdAt: r.created_at }));
}
