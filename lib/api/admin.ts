import { adminDb } from "../mock/admin";
import { money } from "../money";
import type { AdminCreator, AdminPayout, Dispute, Flag, Order } from "../types";
import { commit } from "../mock/db";
import { call } from "./client";
import { allScopes } from "./scope";

const A = adminDb;

export interface PlatformStats {
  gmv30d: ReturnType<typeof money>;
  revenue30d: ReturnType<typeof money>;
  creators: number;
  activeCreators: number;
  openDisputes: number;
  queuedPayouts: number;
  openFlags: number;
}

export function getPlatformStats(): Promise<PlatformStats> {
  return call(() => {
    const a = A();
    const gmv = a.creators.reduce((t, c) => t + c.gmv30d.amount, 0);
    return {
      gmv30d: money(gmv),
      revenue30d: money(Math.round(gmv * 0.03)),
      creators: a.creators.length,
      activeCreators: a.creators.filter((c) => c.plan === "active" || c.plan === "trial").length,
      openDisputes: a.disputes.filter((d) => d.status === "open" || d.status === "under_review").length,
      queuedPayouts: a.payouts.filter((p) => p.status === "queued" || p.status === "on_hold").length,
      openFlags: a.flags.filter((f) => f.status === "open").length,
    };
  });
}

export function getCreators(search = ""): Promise<AdminCreator[]> {
  return call(() => {
    const s = search.toLowerCase();
    return A().creators.filter((c) => !s || c.storeName.toLowerCase().includes(s) || c.email.includes(s) || c.ownerName.toLowerCase().includes(s));
  });
}

export function setCreatorPlan(id: string, plan: AdminCreator["plan"]): Promise<AdminCreator> {
  return call(() => {
    const c = A().creators.find((x) => x.id === id)!;
    c.plan = plan;
    return c;
  });
}

/** All orders across the platform, every store, newest first, labelled with the store. */
export function getPlatformOrders(): Promise<(Order & { storeName: string })[]> {
  return call(() =>
    allScopes()
      .flatMap((sc) => sc.orders.map((o) => ({ ...o, storeName: sc.store.name })))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  );
}

export function getDisputes(): Promise<Dispute[]> {
  return call(() => A().disputes);
}

export function setDisputeStatus(id: string, status: Dispute["status"]): Promise<Dispute> {
  return call(() => {
    const d = A().disputes.find((x) => x.id === id)!;
    d.status = status;
    return d;
  });
}

export function getPayoutQueue(): Promise<AdminPayout[]> {
  return call(() => A().payouts);
}

export function setPayoutStatus(id: string, status: AdminPayout["status"]): Promise<AdminPayout> {
  return call(() => {
    const p = A().payouts.find((x) => x.id === id)!;
    p.status = status;
    return p;
  });
}

/** Reported reviews and questions from every store, as flags. */
function contentFlags(): Flag[] {
  const out: Flag[] = [];
  for (const sc of allScopes()) {
    for (const r of sc.reviews.filter((x) => x.reported)) {
      out.push({ id: `flag:review:${r.id}`, kind: "review", target: `“${r.title}” by ${r.author}`, storeName: sc.store.name, reason: "Reported by a visitor", reporter: "Report button", status: r.hidden ? "removed" : "open", createdAt: r.createdAt });
    }
    for (const q of sc.questions.filter((x) => x.reported)) {
      out.push({ id: `flag:question:${q.id}`, kind: "question", target: `“${q.body.slice(0, 60)}”`, storeName: sc.store.name, reason: "Reported by a visitor", reporter: "Report button", status: q.hidden ? "removed" : "open", createdAt: q.createdAt });
    }
  }
  return out;
}

export function getFlags(): Promise<Flag[]> {
  return call(() => [...contentFlags(), ...A().flags]);
}

export function setFlagStatus(id: string, status: Flag["status"]): Promise<Flag> {
  return call(() => {
    if (id.startsWith("flag:")) {
      const [, kind, itemId] = id.split(":");
      commit(() => {
        for (const sc of allScopes()) {
          const item = kind === "review" ? sc.reviews.find((r) => r.id === itemId) : sc.questions.find((q) => q.id === itemId);
          if (!item) continue;
          if (status === "removed") item.hidden = true;
          if (status === "dismissed") item.reported = false;
        }
      });
      const f = contentFlags().find((x) => x.id === id);
      return f ?? { id, kind: kind as Flag["kind"], target: "", storeName: "", reason: "", reporter: "", status, createdAt: new Date().toISOString() };
    }
    const f = A().flags.find((x) => x.id === id)!;
    f.status = status;
    return f;
  });
}
