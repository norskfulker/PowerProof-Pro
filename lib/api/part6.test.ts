import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas and IndexedDB aren't in jsdom: stand in for the picture maker and the file store
vi.mock("../ai/render", () => ({
  hashString: (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
  paletteFor: () => ["#0F3D33", "#C9A24F", "#F5F6F4"],
  renderMock: async () => ({ blob: new Blob(["x"], { type: "image/png" }), width: 1024, height: 1024 }),
  editMock: async () => ({ blob: new Blob(["y"], { type: "image/png" }), width: 2048, height: 2048 }),
  flattenText: async () => ({ blob: new Blob(["z"], { type: "image/png" }), width: 1024, height: 1024 }),
}));
vi.mock("../media/store", async (orig) => {
  const real = await orig<typeof import("../media/store")>();
  let n = 0;
  return {
    ...real,
    putAsset: async () => `asset:test${++n}`,
    assetUrl: async (src: string) => (src.startsWith("asset:") ? `blob:${src}` : undefined),
    deleteAsset: async () => {},
    measureMedia: async () => ({ width: 800, height: 600 }),
  };
});

import { commit, db, resetDb } from "../mock/db";
import { readProgress } from "../mock/progress";
import { withinLimit, PLAN_LIMITS, PLAN_COMPARISON } from "../plans";
import { createOwnedStore, getOwnedStores, getPlanState, getStoreInfo, LimitError, setPlanTier, switchStore, updateStorePage } from "./account";
import { generateImage, getAiCredits, saveAiImage, transformImage, validatePrompt } from "./ai";
import { login, logout, signup, verifyEmail } from "./auth";
import { dismissChecklist, getChecklist, markLinkShared, skipStep } from "./getting-started";
import { getMediaLibrary } from "./media";
import { createProduct } from "./products";
import type { ProductInput } from "../types";

const input = (title: string): ProductInput => ({
  title,
  description: "A useful thing.",
  kind: "ebook",
  price: { amount: 49900, currency: "INR" },
  images: [],
  files: [],
  sku: "",
  taxCode: "998433",
  status: "draft",
});

describe("plan limits", () => {
  it("Free allows one store and one product; Pro has no limits", () => {
    expect(withinLimit("free", "products", 0)).toBe(true);
    expect(withinLimit("free", "products", 1)).toBe(false);
    expect(withinLimit("free", "stores", 1)).toBe(false);
    expect(withinLimit("pro", "products", 500)).toBe(true);
    expect(PLAN_LIMITS.free).toMatchObject({ stores: 1, products: 1 });
  });
  it("keeps the same per-sale fee on both plans", () => {
    const fee = PLAN_COMPARISON.find((r) => r.feature === "Fee per sale")!;
    expect(fee.free).toBe(fee.pro);
  });

  describe("a new Free account", () => {
    beforeEach(async () => {
      await signup("Meera Rao", "meera@example.com");
    });
    it("starts on Free", async () => {
      const s = await getPlanState();
      expect(s.tier).toBe("free");
      expect(s.usage).toEqual({ stores: 1, products: 0 });
    });
    it("creates the first product, then asks to upgrade on the second", async () => {
      await createProduct(input("First"));
      await expect(createProduct(input("Second"))).rejects.toBeInstanceOf(LimitError);
      await expect(createProduct(input("Second"))).rejects.toMatchObject({ code: "limit", kind: "products" });
    });
    it("asks to upgrade on a second store", async () => {
      await expect(createOwnedStore({ name: "Another" })).rejects.toMatchObject({ code: "limit", kind: "stores" });
    });
    it("upgrading starts a free Pro month and lifts the limits", async () => {
      await createProduct(input("First"));
      const s = await setPlanTier("pro");
      expect(s.tier).toBe("pro");
      expect(s.plan.status).toBe("trial");
      await expect(createProduct(input("Second"))).resolves.toMatchObject({ title: "Second" });
      await expect(createOwnedStore({ name: "Another" })).resolves.toMatchObject({ slug: "another" });
    });
  });
});

describe("stores", () => {
  beforeEach(() => resetDb("seeded"));

  it("lists the creator's stores with the active one first", async () => {
    const stores = await getOwnedStores();
    expect(stores.length).toBeGreaterThanOrEqual(2);
    expect(stores[0].active).toBe(true);
    expect(stores.filter((s) => s.active)).toHaveLength(1);
  });

  it("switching swaps products, design and pages", async () => {
    const before = db().store.id;
    const productsBefore = db().products.map((p) => p.id);
    const other = (await getOwnedStores())[1];
    await switchStore(other.id);
    expect(db().store.id).toBe(other.id);
    expect(db().products.map((p) => p.id)).not.toEqual(productsBefore);
    await switchStore(before);
    expect(db().products.map((p) => p.id)).toEqual(productsBefore);
  });

  it("keeps About, FAQ and policies separate per store", async () => {
    const [a, b] = await getOwnedStores();
    const ia = await getStoreInfo(a.id);
    const ib = await getStoreInfo(b.id);
    expect(ia.pages.refund).not.toBe(ib.pages.refund);
    expect(ia.about.story).not.toBe(ib.about.story);
    await updateStorePage(b.id, { key: "refund", text: "Refunds within 7 days if the presets don't open." });
    expect((await getStoreInfo(a.id)).pages.refund).toBe(ia.pages.refund);
    expect((await getStoreInfo(b.id)).pages.edited?.refund).toBe(true);
  });

  it("a new store starts with default text marked not edited", async () => {
    const s = await createOwnedStore({ name: "Study Notes" });
    const info = await getStoreInfo(s.id);
    expect(info.pages.refund.length).toBeGreaterThan(20);
    expect(info.pages.edited?.refund).toBeFalsy();
    await expect(updateStorePage(s.id, { key: "terms", text: "short" })).rejects.toMatchObject({ code: "validation" });
  });
});

describe("AI images", () => {
  beforeEach(() => {
    resetDb("seeded");
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const req = { prompt: "A calm desk with morning light", purpose: "product_cover", aspect: "1:1", style: "clean" } as const;
  const run = async <T,>(p: Promise<T>) => {
    await vi.advanceTimersByTimeAsync(7000);
    return p;
  };

  it("checks the prompt", () => {
    expect(validatePrompt("")).toBeTruthy();
    expect(validatePrompt("A calm desk with morning light")).toBeUndefined();
  });

  it("makes four variations for one credit", async () => {
    const before = (await run(getAiCredits())).used;
    const gen = await run(generateImage({ ...req }));
    expect(gen.images).toHaveLength(4);
    expect((await run(getAiCredits())).used).toBe(before + 1);
  });

  it("regenerates, edits and saves to the media library", async () => {
    const gen = await run(generateImage({ ...req }));
    const again = await run(transformImage("regenerate", gen.id, gen.images[0].id));
    expect(again.images).toHaveLength(1);
    const edited = await run(transformImage("edit", gen.id, gen.images[1].id, { instruction: "make it warmer" }));
    expect(edited.images[0].op).toBe("edit");
    await expect(transformImage("edit", gen.id, gen.images[1].id, { instruction: "" })).rejects.toMatchObject({ code: "validation" });
    vi.useRealTimers();
    globalThis.fetch = vi.fn(async () => new Response(new Blob(["x"]))) as unknown as typeof fetch;
    const item = await saveAiImage(gen.id, gen.images[0].id, { alt: "A desk" });
    const lib = await getMediaLibrary({ kind: "ai" });
    expect(lib.map((m) => m.id)).toContain(item.id);
  });

  it("stops at the monthly limit with the Upgrade path", async () => {
    await run(setPlanTier("free"));
    commit((d) => (d.aiCreditsUsed = { month: new Date().toISOString().slice(0, 7), used: PLAN_LIMITS.free.aiCredits }));
    await expect(generateImage({ ...req })).rejects.toMatchObject({ code: "limit", kind: "aiCredits" });
  });

  it("can be cancelled", async () => {
    const ctl = new AbortController();
    const p = generateImage({ ...req }, { signal: ctl.signal });
    const caught = p.catch((e) => e);
    ctl.abort();
    await vi.advanceTimersByTimeAsync(7000);
    expect(((await caught) as Error).name).toBe("AbortError");
  });
});

describe("getting started", () => {
  it("a new account starts at 0% and moves as real things happen", async () => {
    await signup("Meera Rao", "meera@example.com");
    let c = await getChecklist();
    expect(c.percent).toBe(0);
    expect(c.next?.id).toBe("verify_email");
    expect(c.steps.every((s) => s.href.includes("coach="))).toBe(true);

    await verifyEmail("123456");
    await createProduct(input("First"));
    markLinkShared();
    c = await getChecklist();
    expect(c.steps.find((s) => s.id === "verify_email")?.state).toBe("done");
    expect(c.steps.find((s) => s.id === "first_product")?.state).toBe("done");
    expect(c.steps.find((s) => s.id === "share")?.state).toBe("done");
    expect(c.percent).toBe(30);
  });

  it("only optional steps can be skipped, and the card only dismisses when required steps are done", async () => {
    await signup("Meera Rao", "meera@example.com");
    await expect(skipStep("payout")).rejects.toMatchObject({ code: "validation" });
    const c = await skipStep("analytics");
    expect(c.steps.find((s) => s.id === "analytics")?.state).toBe("skipped");
    await expect(dismissChecklist()).rejects.toMatchObject({ code: "conflict" });
  });

  it("doesn't flag an upgrade for the first product on Free", async () => {
    await signup("Meera Rao", "meera@example.com");
    const c = await getChecklist();
    expect(c.steps.find((s) => s.id === "first_product")?.needsUpgrade).toBeUndefined();
  });

  it("resumes after signing out and back in", async () => {
    await signup("Meera Rao", "meera@example.com");
    await verifyEmail("123456");
    const before = await getChecklist();
    await logout();
    await login("meera@example.com", "password123");
    const after = await getChecklist();
    expect(after.percent).toBe(before.percent);
    expect(readProgress("meera@example.com").emailVerified).toBe(true);
  });
});
