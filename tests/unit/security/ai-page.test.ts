import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB } from "@/tests/fixtures";

vi.mock("server-only", () => ({}));

/* A scripted Gemini: each turn is a list of parts and a finish reason ---------------------------- */

const gem = vi.hoisted(() => ({ turns: [] as { parts: Record<string, unknown>[]; finish: string }[], requests: [] as Record<string, unknown>[], down: false }));

vi.mock("@google/genai", () => {
  class ApiError extends Error {
    status = 503;
  }
  return {
    ApiError,
    FunctionCallingConfigMode: { AUTO: "AUTO" },
    GoogleGenAI: class {
      models = {
        generateContentStream: async (params: Record<string, unknown>) => {
          if (gem.down) throw new ApiError("overloaded");
          gem.requests.push(JSON.parse(JSON.stringify(params)));
          const turn = gem.turns.shift() ?? { parts: [{ text: "Done." }], finish: "STOP" };
          return (async function* () {
            yield { candidates: [{ content: { role: "model", parts: turn.parts }, finishReason: turn.finish }] };
          })();
        },
      };
    },
  };
});

const { runAiPage } = await import("@/lib/pages/ai-run");
import type { AiEvent } from "@/lib/pages/ai";
import type { AiStoreContext } from "@/lib/pages/ai-run";

const store: AiStoreContext = {
  name: "Fixture Store",
  slug: "my-store",
  tagline: "Kits",
  currency: "INR",
  refundDays: 7,
  theme: DB.design.theme,
  products: [{ id: "p1", slug: "ui-kit", title: "UI Kit", price: "₹499", description: "A kit", picture: "pic:1" }],
  media: [{ ref: "pic:1", kind: "image", src: "product:p1", what: "Cover of UI Kit" }],
  collections: [],
  rating: { average: 0, count: 0 },
  about: { name: "Ana", story: "I design.", location: "Pune" },
  faq: [],
  pageTitle: "Home page",
};
const brief = { pageType: "home" as const, description: "A home for my design kits", audience: "", tone: "friendly" as const, language: "Hindi", productIds: [], theme: false, mode: "replace" as const };
const look = { scheme: "", fill: "content", align: "left", width: "wide", space: "md", height: "auto", gap: "md", background: { kind: "none", picture: "", video: "", color: "", color2: "", overlay: 0, text: "auto" } };
const hero = { eyebrow: "", headline: "Kits", subtext: "", buttonLabel: "Shop", buttonTarget: "products", secondButtonLabel: "", secondButtonTarget: "", pictures: ["pic:1"], layout: "split", ...look };
const textSection = { label: "Story", ...look, blocks: [{ type: "text", text: "Hello", size: "md", align: "" }] };

async function run() {
  const events: AiEvent[] = [];
  const r = await runAiPage({ brief, store, existingSections: 0, runId: "r1", emit: (e) => events.push(e) });
  return { r, events, of: <T extends AiEvent["type"]>(t: T) => events.filter((e) => e.type === t) as Extract<AiEvent, { type: T }>[] };
}

const call = (id: string, name: string, args: unknown) => ({ functionCall: { id, name, args } });

describe("building a page with AI", () => {
  beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "k"));
  afterEach(() => {
    vi.unstubAllEnvs();
    gem.turns = [];
    gem.requests = [];
    gem.down = false;
  });

  it("uses Gemini with the same tools and checks, and the brief's language", async () => {
    gem.turns = [
      { parts: [{ ...call("g1", "add_hero", hero), thoughtSignature: "sig" }, call("g2", "add_section", { ...textSection, blocks: [{ type: "product_card", productId: "fake" }] })], finish: "STOP" },
      { parts: [call("g3", "add_section", textSection)], finish: "STOP" },
      { parts: [{ text: "A tidy home page." }], finish: "STOP" },
    ];
    const { r, of } = await run();
    expect(r).toEqual({ ok: true, sections: 2 });
    expect(of("section").map((e) => e.node.id)).toEqual(["r1-s1", "r1-s2"]);
    expect(of("done")[0]).toMatchObject({ sections: 2, summary: "A tidy home page." });
    const req = gem.requests[0] as { model: string; contents: { parts: { text: string }[] }[]; config: { tools: { functionDeclarations: { name: string }[] }[] } };
    expect(req.model).toBe("gemini-3.8-flash");
    expect(req.config.tools[0].functionDeclarations.map((d) => d.name)).toEqual(["set_theme", "add_hero", "add_section"]);
    expect(req.contents[0].parts[0].text).toContain("Language for everything buyers read: Hindi");
    expect(req.contents[0].parts[0].text).toContain('"rating": "no reviews yet"');
    // Gemini gets one-item enums, not const
    expect(JSON.stringify(req.config.tools)).not.toContain('"const"');
    // The model's turn goes back unchanged, and a bad section gets a reason
    const second = gem.requests[1] as { contents: { role: string; parts: Record<string, unknown>[] }[] };
    expect(second.contents[1].parts[0]).toMatchObject({ thoughtSignature: "sig" });
    expect(second.contents[2].parts[1]).toMatchObject({ functionResponse: { id: "g2", name: "add_section", response: { error: expect.stringMatching(/no product/) } } });
  });

  it("shows the AI the store's pictures, labelled, and says their shape", async () => {
    // A 2×1 PNG header
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 200, 0, 0, 0, 100, 8, 2, 0, 0, 0]);
    const fetchMock = vi.fn(async (url: string) => (url.includes("ok") ? new Response(png, { headers: { "content-type": "image/png" } }) : new Response("no", { status: 404 })));
    vi.stubGlobal("fetch", fetchMock);
    const withPics = { ...store, media: [{ ref: "pic:1", kind: "image" as const, src: "product:p1", what: "Cover", url: "https://cdn.test/ok.png" }, { ref: "pic:2", kind: "image" as const, src: "https://cdn.test/gone.png", what: "Gone", url: "https://cdn.test/gone.png" }] };
    gem.turns = [{ parts: [call("g1", "add_hero", hero)], finish: "STOP" }];
    await runAiPage({ brief, store: withPics, existingSections: 0, runId: "r1", emit: () => {} });
    vi.unstubAllGlobals();
    const parts = (gem.requests[0] as { contents: { parts: Record<string, unknown>[] }[] }).contents[0].parts;
    expect(parts[1]).toEqual({ text: "pic:1" });
    expect(parts[2]).toMatchObject({ inlineData: { mimeType: "image/png" } });
    expect(parts).toHaveLength(3);
    expect(String(parts[0].text)).toContain('"shape": "landscape"');
    expect(String(parts[0].text)).toContain("1 of the pictures are attached");
  });

  it("uses GEMINI_MODEL when set", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-other");
    gem.turns = [{ parts: [call("g1", "add_hero", hero)], finish: "STOP" }];
    await run();
    expect((gem.requests[0] as { model: string }).model).toBe("gemini-other");
  });

  it("drops a section cut off by the output limit and asks for it again", async () => {
    gem.turns = [
      { parts: [call("g1", "add_hero", hero), call("g2", "add_section", textSection)], finish: "MAX_TOKENS" },
      { parts: [call("g3", "add_section", textSection)], finish: "STOP" },
    ];
    const { of } = await run();
    expect(of("section").map((e) => e.node.id)).toEqual(["r1-s1", "r1-s2"]);
    const replies = (gem.requests[1] as { contents: { parts: { functionResponse: { id: string; response: { error?: string } } }[] }[] }).contents.at(-1)!.parts;
    expect(replies.find((x) => x.functionResponse.id === "g2")!.functionResponse.response.error).toMatch(/cut off/);
  });

  it("doesn't change the theme when the creator said to keep it", async () => {
    gem.turns = [{ parts: [call("g1", "set_theme", {}), call("g2", "add_hero", hero)], finish: "STOP" }];
    const { of } = await run();
    expect(of("theme")).toHaveLength(0);
    expect(of("section")).toHaveLength(1);
  });

  it("stops when the brief is blocked and reports nothing made", async () => {
    gem.turns = [{ parts: [], finish: "SAFETY" }];
    const { r, of } = await run();
    expect(r.ok).toBe(false);
    expect(of("error")[0].message).toMatch(/couldn't build/);
  });

  it("says the AI is having trouble when the service fails", async () => {
    gem.down = true;
    const { r, of } = await run();
    expect(r.ok).toBe(false);
    expect(of("error")[0].message).toMatch(/had a problem/);
  });

  it("says it isn't connected without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { r, of } = await run();
    expect(r.ok).toBe(false);
    expect(of("error")[0].message).toMatch(/isn't connected/);
  });
});

/* The route: who may ask, and the daily allowance ------------------------------------------------ */

const STORE_ROW = { id: "st1", name: "Fixture Store", slug: "my-store", tagline: "Kits", brand_color: "#0F3D33", country: "IN", currency_base: "INR", support_email: "a@b.test", refund_days: 7, created_at: "2026-01-01T00:00:00Z", status: "published", logo_url: null, theme: {}, theme_mode: "auto", owner_id: "u1" };
const auth = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null, page: { id: "pg1", store_id: "st1", title: "Home", layout: {} } as object | null, rpcError: null as { message: string; code?: string } | null }));
vi.mock("@/lib/supabase/server", () => {
  const empty = { data: [], error: null };
  const q = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "order", "limit"]) chain[m] = () => chain;
    chain.single = async () => result;
    chain.maybeSingle = async () => result;
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(empty).then(res);
    return chain;
  };
  return {
    sbServer: async () => ({
      auth: { getUser: async () => ({ data: { user: auth.user } }) },
      from: (t: string) => q(t === "custom_pages" ? { data: auth.page } : t === "stores" ? { data: STORE_ROW } : { data: null }),
      rpc: async () => (auth.rpcError ? { data: null, error: auth.rpcError } : { data: "gen1", error: null }),
      storage: { from: () => ({ list: async () => ({ data: [], error: null }), getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
    }),
  };
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/ai/page/route");
  const res = await POST(new Request("http://x/api/ai/page", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: res.headers.get("content-type")?.includes("json") ? await res.json() : null };
};
const okBody = { pageId: "pg1", brief: { pageType: "home", description: "A home for my design kits" } };

describe("POST /api/ai/page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    auth.user = { id: "u1" };
    auth.page = { id: "pg1", store_id: "st1", title: "Home", layout: {} };
    auth.rpcError = null;
  });
  it("is for signed-in creators only", async () => {
    auth.user = null;
    expect((await post(okBody)).status).toBe(401);
  });
  it("needs a real brief", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const r = await post({ pageId: "pg1", brief: { pageType: "home", description: "hi" } });
    expect(r.status).toBe(400);
  });
  it("says it isn't connected without any AI key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const r = await post(okBody);
    expect(r.status).toBe(501);
    expect(r.json.code).toBe("not_connected");
  });
  it("only builds pages the creator owns", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    auth.page = null;
    expect((await post(okBody)).status).toBe(404);
  });
  it("says it's unavailable when the run can't be recorded", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    auth.rpcError = { message: "new row violates check constraint", code: "23514" };
    const r = await post(okBody);
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("unavailable");
  });
  it("stops at the day's allowance", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    auth.rpcError = { message: "ai_daily_limit", code: "P0001" };
    const r = await post(okBody);
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("limit");
  });
});
