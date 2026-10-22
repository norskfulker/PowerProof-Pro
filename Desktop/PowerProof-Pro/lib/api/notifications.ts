import { emailPrefsFrom, type EmailPrefs } from "../email-prefs";
import { sb } from "../supabase/browser";
import { must } from "./live/errors";
import { notifyChange } from "./live/local";
import { activeStoreId, currentUser } from "./live/session";

/**
 * The bell: what happened in the active store (orders, refunds, disputes, reviews, questions,
 * form sign-ups, payouts, stock running out). The database writes them (migration 043) and only
 * shows each person the ones for the parts of the store they work on.
 */
export type NotificationKind = "order" | "cod" | "refund" | "dispute" | "review" | "question" | "lead" | "payout_paid" | "payout_failed" | "low_stock" | "shipped";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(limit = 30): Promise<{ items: AppNotification[]; unread: number }> {
  const storeId = await activeStoreId();
  const [list, unread] = await Promise.all([
    sb().from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(limit),
    sb().from("notifications").select("id", { count: "exact", head: true }).eq("store_id", storeId).is("read_at", null),
  ]);
  return {
    items: must(list).map((n) => ({ id: n.id, kind: n.kind as NotificationKind, title: n.title, body: n.body ?? undefined, href: n.href ?? undefined, read: !!n.read_at, createdAt: n.created_at })),
    unread: unread.count ?? 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  const r = await sb().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (r.error) must(r);
  notifyChange();
}

export async function markAllNotificationsRead(): Promise<void> {
  const r = await sb().rpc("notifications_read_all", { p_store: await activeStoreId() });
  if (r.error) must(r);
  notifyChange();
}

/* Which emails the person wants ------------------------------------------------------------ */

export { DEFAULT_EMAIL_PREFS, emailPrefsFrom, type EmailPrefs } from "../email-prefs";


export async function getEmailPrefs(): Promise<EmailPrefs> {
  const user = await currentUser();
  const row = must(await sb().from("profiles").select("notify").eq("id", user.id).single());
  return emailPrefsFrom(row.notify);
}

export async function saveEmailPrefs(p: EmailPrefs): Promise<EmailPrefs> {
  const user = await currentUser();
  must(await sb().from("profiles").update({ notify: { ...p } }).eq("id", user.id).select("notify").single());
  notifyChange();
  return p;
}
