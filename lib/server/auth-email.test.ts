import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callbackLink, hookMails, sendHookMails, verifyHook, type HookPayload } from "./auth-email";
import { newOrderMail, paymentFailedMail, payoutMail, refundMail } from "./email";

afterEach(() => vi.unstubAllGlobals());

const SITE = "https://pp.test";
const KEY = Buffer.from("a-very-secret-key").toString("base64");
const SECRET = `v1,whsec_${KEY}`;
const sign = (id: string, ts: string, body: string) => `v1,${createHmac("sha256", Buffer.from(KEY, "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;

const payload = (action: string, extra: Partial<HookPayload["email_data"]> = {}, user: HookPayload["user"] = { email: "ada@x.co" }): HookPayload => ({
  user,
  email_data: { token: "123456", token_hash: "hash1", redirect_to: `${SITE}/auth/callback?next=%2Fonboarding`, email_action_type: action, site_url: SITE, ...extra },
});

describe("auth email hook", () => {
  it("accepts a correctly signed, recent request and nothing else", () => {
    const now = 1_800_000_000_000;
    const ts = String(now / 1000);
    const body = JSON.stringify(payload("signup"));
    expect(verifyHook(body, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, SECRET, now)).toBe(true);
    expect(verifyHook(body + " ", { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, SECRET, now)).toBe(false);
    expect(verifyHook(body, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, SECRET, now + 10 * 60_000)).toBe(false);
    expect(verifyHook(body, { id: "msg_1", timestamp: ts, signature: null }, SECRET, now)).toBe(false);
  });

  it("links straight to our callback, keeping where the person was headed", () => {
    const url = new URL(callbackLink("signup", "hash1", `${SITE}/auth/callback?next=%2Fonboarding`, SITE)!);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe("/onboarding");
    expect(url.searchParams.get("token_hash")).toBe("hash1");
    expect(url.searchParams.get("type")).toBe("email");
    // Somewhere else is never a destination
    expect(new URL(callbackLink("recovery", "h", "https://evil.example/x", SITE)!).origin).toBe(SITE);
    expect(new URL(callbackLink("recovery", "h", undefined, SITE)!).searchParams.get("next")).toBe("/reset-password");
  });

  it("sends the sign-up code and link to the person signing up", () => {
    const [m, ...rest] = hookMails(payload("signup"), SITE);
    expect(rest).toHaveLength(0);
    expect(m.to).toBe("ada@x.co");
    expect(m.subject).toContain("Confirm your email");
    expect(m.html).toContain("123456");
    expect(m.html).toContain("token_hash=hash1");
  });

  it("a secure email change sends two emails, with Supabase's reversed hashes", () => {
    const mails = hookMails(payload("email_change", { token: "111111", token_hash: "for-new", token_new: "222222", token_hash_new: "for-current" }, { email: "old@x.co", new_email: "new@x.co" }), SITE);
    const toNew = mails.find((m) => m.to === "new@x.co")!;
    const toOld = mails.find((m) => m.to === "old@x.co")!;
    expect(toNew.html).toContain("222222");
    expect(toNew.html).toContain("token_hash=for-new");
    expect(toOld.html).toContain("111111");
    expect(toOld.html).toContain("token_hash=for-current");
  });

  it("a plain email change sends one email, to the new address", () => {
    const mails = hookMails(payload("email_change", { token: "111111", token_hash: "only" }, { email: "old@x.co", new_email: "new@x.co" }), SITE);
    expect(mails.map((m) => m.to)).toEqual(["new@x.co"]);
    expect(mails[0].html).toContain("token_hash=only");
  });

  it("fails loudly when email isn't connected, so Supabase reports it", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(sendHookMails(payload("recovery"), SITE, {})).rejects.toThrow(/isn't connected/);
  });
});

describe("order and payout emails", () => {
  it("never lets buyer or store text become markup", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const all = [
      paymentFailedMail({ storeName: evil, buyerName: evil, ref: "R", total: "₹1", retryUrl: "https://x.co", reason: evil }),
      refundMail({ storeName: evil, buyerName: evil, ref: "R", amount: "₹1", orderUrl: "https://x.co" }),
      newOrderMail({ storeName: evil, ownerName: "Ada", ref: "R", buyerName: evil, lines: [{ title: evil, amount: "₹1" }], total: "₹1", orderUrl: "https://x.co" }),
      payoutMail({ ownerName: evil, amount: "₹1", to: evil, ok: false, reason: evil, payoutsUrl: "https://x.co" }),
    ];
    for (const m of all) expect(m.html).not.toContain("<img");
  });

  it("each says what happened and what to do next", () => {
    expect(paymentFailedMail({ storeName: "S", buyerName: "Ada L", ref: "R1", total: "₹499", retryUrl: "https://x.co/s/s" }).html).toContain("https://x.co/s/s");
    expect(refundMail({ storeName: "S", buyerName: "Ada", ref: "R1", amount: "₹499", cash: true, orderUrl: "https://x.co/o" }).text).toContain("hand the money back");
    expect(newOrderMail({ storeName: "S", ownerName: "Ada", ref: "R1", buyerName: "Bo", lines: [], total: "₹499", cod: true, orderUrl: "https://x.co/o" }).text).toContain("cash on delivery");
    expect(payoutMail({ ownerName: "Ada", amount: "₹10", to: "HDFC account ending 1234", ok: true, payoutsUrl: "https://x.co/p" }).subject).toBe("₹10 is on its way to you");
  });
});
