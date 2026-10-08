import { sb } from "../supabase/browser";
import { ApiError } from "./client";
import { liveChange } from "./live/notify";
import { fail, must } from "./live/errors";
import { activeStoreId } from "./live/session";

/**
 * What visitors send from a store's pages (a lead form, a booking, a newsletter signup), and what
 * the creator reads back. Visitors only ever write through submit_lead, which checks the store and
 * the page are live; the table itself is readable by the store's owner alone.
 */
export type LeadKind = "lead" | "booking" | "newsletter" | "contact";

export interface LeadInput {
  kind: LeadKind;
  name?: string;
  email?: string;
  phone?: string;
  /** Answers to the other fields, by label */
  data?: Record<string, string>;
  /** Bookings: the exact moment, and how long */
  slotAt?: string;
  minutes?: number;
}

export interface Lead {
  id: string;
  kind: LeadKind;
  name?: string;
  email?: string;
  phone?: string;
  data: Record<string, string>;
  slotAt?: string;
  minutes?: number;
  pageId?: string;
  pageTitle?: string;
  createdAt: string;
}

const MESSAGES: Record<string, string> = {
  booking_taken: "That time was just taken. Please pick another.",
  booking_invalid: "That time can't be booked. Pick one from the list.",
  lead_rate_limited: "You've sent a lot today. Please try again tomorrow.",
  lead_store_not_found: "This store isn't taking submissions right now.",
  lead_page_not_found: "This page isn't taking submissions right now.",
  lead_invalid: "Check your details and try again.",
};

/** Straight to the database: submit_lead checks the store and page are live, stops floods, and a time can be booked once. */
export async function submitLead(storeSlug: string, pageSlug: string | null, input: LeadInput): Promise<void> {
  const r = await sb().rpc("submit_lead", {
    p_store_slug: storeSlug,
    p_page_slug: pageSlug as string,
    p_kind: input.kind,
    p_name: input.name as string,
    p_email: input.email as string,
    p_phone: input.phone as string,
    p_data: (input.data ?? {}) as never,
    p_slot: input.slotAt as string,
    p_minutes: input.minutes as number,
  });
  if (!r.error) return;
  const key = Object.keys(MESSAGES).find((k) => r.error!.message.includes(k));
  if (key) throw new ApiError(MESSAGES[key], "validation");
  if (/email/i.test(r.error.message)) throw new ApiError("That email looks off. Check for typos.", "validation");
  throw new ApiError("That didn't go through. Please try again.");
}

/** Times already taken on a page's calendar */
export async function getBookedSlots(storeSlug: string, pageSlug: string, from: Date, to: Date): Promise<{ at: Date; minutes: number }[]> {
  const r = await sb().rpc("booked_slots", { p_store_slug: storeSlug, p_page_slug: pageSlug, p_from: from.toISOString(), p_to: to.toISOString() });
  if (r.error) throw new ApiError("We couldn't load the free times. Please try again.");
  return (r.data ?? []).map((s) => ({ at: new Date(s.slot_at), minutes: s.slot_minutes }));
}

/* Creator ------------------------------------------------------------ */

export async function getLeads(): Promise<Lead[]> {
  const storeId = await activeStoreId();
  const rows = must(await sb().from("leads").select("id, kind, name, email, phone, data, slot_at, slot_minutes, page_id, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(1000));
  const pages = must(await sb().from("custom_pages").select("id, title").eq("store_id", storeId));
  const title = new Map(pages.map((p) => [p.id, p.title]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as LeadKind,
    name: r.name ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    data: (r.data ?? {}) as Record<string, string>,
    slotAt: r.slot_at ?? undefined,
    minutes: r.slot_minutes ?? undefined,
    pageId: r.page_id ?? undefined,
    pageTitle: r.page_id ? title.get(r.page_id) : undefined,
    createdAt: r.created_at,
  }));
}

export const deleteLead = (id: string): Promise<void> =>
  liveChange(
    (async () => {
      const r = await sb().from("leads").delete().eq("id", id);
      if (r.error) fail(r.error);
    })()
  );
