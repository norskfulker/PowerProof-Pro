import { seedAdmin } from "../mock/admin";
import { db } from "../mock/db";
import { money } from "../money";
import type { AdminCreator, AdminPayout, Dispute, Flag, Order } from "../types";
import { call } from "./client";

let admin: ReturnType<typeof seedAdmin> | null = null;
const A = () => (admin ??= seedAdmin());

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

/** All orders across the platform: the demo store's real orders plus nothing else, labelled. */
export function getPlatformOrders(): Promise<(Order & { storeName: string })[]> {
  return call(() => db().orders.map((o) => ({ ...o, storeName: db().store.name })));
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

export function getFlags(): Promise<Flag[]> {
  return call(() => A().flags);
}

export function setFlagStatus(id: string, status: Flag["status"]): Promise<Flag> {
  return call(() => {
    const f = A().flags.find((x) => x.id === id)!;
    f.status = status;
    return f;
  });
}
