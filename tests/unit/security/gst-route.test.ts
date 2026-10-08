import { afterEach, describe, expect, it, vi } from "vitest";
import { gstinChecksum } from "@/lib/gstin";

vi.mock("server-only", () => ({}));
const user = vi.hoisted(() => ({ current: { id: "u1" } as { id: string } | null }));
vi.mock("@/lib/supabase/server", () => ({ sbServer: async () => ({ auth: { getUser: async () => ({ data: { user: user.current } }) } }) }));

const body = "27ABCPR1234F1Z";
const GSTIN = body + gstinChecksum(body);
const ask = async (g: string) => {
  const { GET } = await import("@/app/api/gst/route");
  const res = await GET(new Request(`http://x/api/gst?gstin=${g}`));
  return { status: res.status, json: await res.json() };
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  user.current = { id: "u1" };
});

describe("GET /api/gst", () => {
  it("is for signed-in creators only", async () => {
    user.current = null;
    expect((await ask(GSTIN)).status).toBe(401);
  });
  it("refuses a number that can't be a GSTIN, before asking anyone", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("GST_LOOKUP_URL", "https://provider.test/{gstin}");
    vi.stubEnv("GST_LOOKUP_KEY", "k");
    const r = await ask("27ABCPR1234F1ZX".slice(0, 14) + "Q");
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("invalid");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("says it isn't connected when no provider is set, and invents nothing", async () => {
    vi.stubEnv("GST_LOOKUP_URL", "");
    vi.stubEnv("GST_LOOKUP_KEY", "");
    const r = await ask(GSTIN);
    expect(r.status).toBe(501);
    expect(r.json).toMatchObject({ ok: false, code: "not_connected" });
  });
  it("asks the provider with the key in a header, and returns the company", async () => {
    vi.stubEnv("GST_LOOKUP_URL", "https://provider.test/gstin/{gstin}");
    vi.stubEnv("GST_LOOKUP_KEY", "secret-key");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ data: { lgnm: "Fixture Traders", sts: "Active", pradr: { addr: { bno: "1", st: "Road", dst: "Pune", stcd: "Maharashtra", pncd: "411001" } } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await ask(GSTIN);
    expect(r.json).toMatchObject({ ok: true, company: { legalName: "Fixture Traders", city: "Pune", pincode: "411001" } });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://provider.test/gstin/${GSTIN}`);
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("secret-key");
    // The key never goes back to the browser
    expect(JSON.stringify(r.json)).not.toContain("secret-key");
  });
  it("tells 'no such registration' from 'the lookup is down'", async () => {
    vi.stubEnv("GST_LOOKUP_URL", "https://provider.test/{gstin}");
    vi.stubEnv("GST_LOOKUP_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect((await ask(GSTIN)).json.code).toBe("not_found");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    expect((await ask(GSTIN)).json.code).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect((await ask(GSTIN)).json.code).toBe("unavailable");
  });
});
