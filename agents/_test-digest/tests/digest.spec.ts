import { describe, expect, it } from "vitest";
import { AGENTS, getManifest } from "@/agents/index";
import { AGENT_CODE } from "@/agents/server";
import { istInstant } from "@/lib/agents/time";
import { makeCtx } from "@/lib/server/agents/runtime/context";
import { runSteps, type Checkpoints } from "@/lib/server/agents/runtime/engine";
import { MemoryDb, MemoryPlatform } from "@/lib/server/agents/runtime/memory";
import testDigest from "../steps";

/**
 * Done-when #3 and #4: a second agent is one folder plus one registry line (here, the test's own
 * registry: it is never in the production one), and it reuses a connection the first agent uses.
 */
const REGISTRY = [...AGENTS, testDigest.manifest];
const CODE = { ...AGENT_CODE, [testDigest.manifest.id]: testDigest };

const checkpoints = (): Checkpoints => {
  const saved: Record<string, unknown> = {};
  return { load: async () => saved, done: async (s, o) => void (saved[s] = o), failed: async () => {} };
};

describe("a second agent, added as a folder", () => {
  it("isn't in the production registry", () => {
    expect(getManifest("test-digest")).toBeUndefined();
    expect(getManifest("test-digest", REGISTRY)?.name).toBe("Test Digest");
  });

  it("runs on the platform with no platform changes, reusing the store's sheet connection", async () => {
    const now = istInstant("2026-10-24", 11);
    const platform = new MemoryPlatform();
    platform.grant(5);
    platform.connections.push({ id: "conn-1", type: "google_sheets", status: "connected", config: { name: "Dues 2026" } });
    const ctxFor = (agent: string) =>
      makeCtx({
        code: CODE[agent],
        instance: { id: `inst-${agent}`, storeId: "store-a", status: "active", settings: { owner_email: "owner@example.test", channels: ["email"] }, consentAt: "2026-10-01T00:00:00Z" },
        runId: `run-${agent}`,
        dryRun: false,
        now,
        business: { name: "Demo Business", supportEmail: null, country: "IN" },
        ports: platform.ports(new MemoryDb("store-a"), { now: () => now }),
      });
    // The same connection row answers both agents
    expect((await ctxFor("payment-chaser").connectors.get("google_sheets"))?.id).toBe("conn-1");
    const out = await runSteps(testDigest.manifest, testDigest.steps, ctxFor("test-digest"), checkpoints());
    expect(out).toMatchObject({ ok: true, output: { sent: true, status: "sent" } });
    expect(platform.emails[0]).toMatchObject({ to: "owner@example.test" });
    expect(platform.emails[0].text).toContain("Dues 2026");
    expect(platform.balance()).toBe(4);
  });

  it("can only use what its manifest declares", async () => {
    const platform = new MemoryPlatform();
    const ctx = makeCtx({
      code: testDigest,
      instance: { id: "i", storeId: "store-a", status: "active", settings: {}, consentAt: null },
      runId: "r",
      dryRun: false,
      now: new Date(),
      business: { name: "B", supportEmail: null, country: "IN" },
      ports: platform.ports(new MemoryDb("store-a"), { now: () => new Date() }),
    });
    await expect(ctx.connectors.get("invoice_source")).rejects.toThrow(/didn't declare/);
    await expect(ctx.db.select("chaser_invoices", "*")).rejects.toThrow(/can't use table/);
    await expect(ctx.actions.enqueue({ kind: "whatsapp_send", title: "x", idempotencyKey: "k" })).rejects.toThrow(/didn't declare/);
    await expect(ctx.credits.charge("email_sent", "k")).rejects.toThrow(/no credit cost/);
  });
});
