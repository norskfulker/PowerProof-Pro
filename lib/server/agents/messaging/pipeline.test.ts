import { describe, expect, it } from "vitest";
import { istInstant } from "@/lib/agents/time";
import type { OutboundMessage } from "../runtime/types";
import { sendThroughPipeline, whatsappLink, type PipelineDeps, type ReserveResult } from "./pipeline";

/** An in-memory stand-in for the database's reserve function: same rules, no network */
function fakeDb(credits = 10) {
  const outbox = new Map<string, { status: string; contactKey: string; at: number }>();
  const optedOut = new Set<string>();
  let balance = credits;
  const sent: string[] = [];
  const actions: string[] = [];
  const deps = (over: Partial<PipelineDeps> = {}): PipelineDeps => ({
    now: istInstant("2026-10-24", 11),
    dryRun: false,
    instance: { status: "active", consentAt: "2026-10-01T00:00:00Z", sendWindow: "09:00-20:00", channelsOn: ["email", "whatsapp"] },
    stopped: async () => false,
    limits: { capMessages: 1, capDays: 3, dailyCap: 100 },
    creditCost: () => 1,
    smsEnabled: false,
    reserve: async (o): Promise<ReserveResult> => {
      const dup = outbox.get(o.idempotencyKey);
      if (dup) return { result: "duplicate", outboxId: o.idempotencyKey, status: dup.status };
      if (optedOut.has(o.to)) return { result: "opted_out" };
      const recent = [...outbox.values()].filter((m) => m.contactKey === o.contactKey && m.status !== "failed").length;
      if (recent >= o.limits.capMessages) return { result: "frequency_cap" };
      if (balance < o.credits) return { result: "no_credits" };
      balance -= o.credits;
      outbox.set(o.idempotencyKey, { status: "pending", contactKey: o.contactKey, at: Date.now() });
      return { result: "reserved", outboxId: o.idempotencyKey };
    },
    deliverEmail: async (o) => (sent.push(o.to), { ok: true, id: "re_1" }),
    finish: async (id, o) => {
      outbox.get(id)!.status = o.status;
      if (o.status === "failed") balance += 1;
    },
    enqueueAction: async (a) => void actions.push(a.idempotencyKey),
    optOutUrl: () => "https://powerproof.app/agents/optout/x",
    ...over,
  });
  return { deps, sent, actions, optedOut, balance: () => balance };
}

const email: OutboundMessage = { channel: "email", to: "ravi@example.test", subject: "Payment reminder", body: "Hi Ravi", contactKey: "c1", idempotencyKey: "s1:c1:1:2026-10-01", creditReason: "email_sent" };

describe("messaging pipeline", () => {
  it("sends once, charges once, even when run twice", async () => {
    const db = fakeDb();
    expect((await sendThroughPipeline(db.deps(), email, "Shop")).status).toBe("sent");
    expect(await sendThroughPipeline(db.deps(), email, "Shop")).toEqual({ status: "skipped", reason: "duplicate" });
    expect(db.sent).toHaveLength(1);
    expect(db.balance()).toBe(9);
  });

  it("never sends outside the window", async () => {
    const db = fakeDb();
    const out = await sendThroughPipeline(db.deps({ now: istInstant("2026-10-24", 21) }), email, "Shop");
    expect(out).toMatchObject({ status: "skipped", reason: "outside_window", retryAt: istInstant("2026-10-25", 9).toISOString() });
    expect(db.sent).toHaveLength(0);
  });

  it("needs consent, a running agent and no kill switch", async () => {
    const db = fakeDb();
    expect(await sendThroughPipeline(db.deps({ instance: { ...db.deps().instance, consentAt: null } }), email, "S")).toMatchObject({ reason: "no_consent" });
    expect(await sendThroughPipeline(db.deps({ instance: { ...db.deps().instance, status: "trial_ended" } }), email, "S")).toMatchObject({ reason: "not_active" });
    expect(await sendThroughPipeline(db.deps({ stopped: async () => true }), email, "S")).toMatchObject({ reason: "kill_switch" });
    expect(db.sent).toHaveLength(0);
  });

  it("stops at zero credits, never overdraws", async () => {
    const db = fakeDb(0);
    expect(await sendThroughPipeline(db.deps(), email, "S")).toMatchObject({ reason: "no_credits" });
  });

  it("caps messages per customer and respects opt-outs", async () => {
    const db = fakeDb();
    await sendThroughPipeline(db.deps(), email, "S");
    expect(await sendThroughPipeline(db.deps(), { ...email, idempotencyKey: "other" }, "S")).toMatchObject({ reason: "frequency_cap" });
    db.optedOut.add("asha@example.test");
    expect(await sendThroughPipeline(db.deps(), { ...email, to: "asha@example.test", contactKey: "c2", idempotencyKey: "k3" }, "S")).toMatchObject({ reason: "opted_out" });
  });

  it("queues WhatsApp for the owner's tap with an opt-out line", async () => {
    const db = fakeDb();
    const out = await sendThroughPipeline(db.deps({ now: istInstant("2026-10-24", 22) }), { ...email, channel: "whatsapp", to: "+919812345678", creditReason: "whatsapp_queued" }, "S");
    expect(out.status).toBe("queued");
    expect(db.actions).toHaveLength(1);
    expect(decodeURIComponent(whatsappLink("+919812345678", "Hi"))).toContain("Reply STOP to opt out.");
  });

  it("keeps SMS off and refuses bad recipients", async () => {
    const db = fakeDb();
    expect(await sendThroughPipeline(db.deps(), { ...email, channel: "sms", to: "+919812345678" }, "S")).toMatchObject({ reason: "channel_off" });
    expect(await sendThroughPipeline(db.deps(), { ...email, to: "not-an-email" }, "S")).toMatchObject({ reason: "invalid_recipient" });
  });

  it("dry run sends and charges nothing", async () => {
    const db = fakeDb();
    expect(await sendThroughPipeline(db.deps({ dryRun: true, instance: { ...db.deps().instance, consentAt: null, status: "setup" } }), email, "S")).toEqual({ status: "dry_run" });
    expect(db.balance()).toBe(10);
  });

  it("gives the credit back when the email fails", async () => {
    const db = fakeDb();
    const out = await sendThroughPipeline(db.deps({ deliverEmail: async () => ({ ok: false, error: "Resend 500" }) }), email, "S");
    expect(out.status).toBe("failed");
    expect(db.balance()).toBe(10);
  });
});
