import { afterEach, describe, expect, it, vi } from "vitest";
import { esc, mailConfigured, receiptMail, sendMail } from "./email";

afterEach(() => vi.unstubAllGlobals());
const mail = { to: "a@b.co", subject: "s", html: "<p>h</p>", text: "t" };

describe("email", () => {
  it("sends nothing and says so without a key or a sender", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(mailConfigured({})).toBe(false);
    expect(await sendMail(mail, {})).toEqual({ sent: false, reason: "not_configured" });
    expect(await sendMail(mail, { RESEND_API_KEY: "k" })).toEqual({ sent: false, reason: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("sends through Resend when configured, and reports a refusal or a dead line", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 422 }).mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", f);
    const env = { RESEND_API_KEY: "k", MAIL_FROM: "Shop <o@shop.co>" };
    expect(await sendMail(mail, env)).toEqual({ sent: true });
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ from: "Shop <o@shop.co>", to: ["a@b.co"], subject: "s" });
    expect(await sendMail(mail, env)).toEqual({ sent: false, reason: "failed" });
    expect(await sendMail(mail, env)).toEqual({ sent: false, reason: "failed" });
  });

  it("never lets a buyer's text become markup", () => {
    expect(esc(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
    const m = receiptMail({ storeName: "<b>S</b>", buyerName: "<i>Eve</i>", ref: "R", lines: [{ title: "<img src=x onerror=alert(1)>", amount: "₹1" }], total: "₹1", downloadUrl: "https://x.co/order/t" });
    expect(m.html).not.toContain("<img");
    expect(m.html).not.toContain("<i>Eve");
    expect(m.html).not.toContain("<b>S");
  });

  it("the receipt has the order, the total and the download link", () => {
    const r = receiptMail({ storeName: "Fixture", buyerName: "Ada Lovelace", ref: "PP/DP/ABC", lines: [{ title: "Planner", amount: "₹499.00" }], total: "₹499.00", downloadUrl: "https://x.co/order/t", invoiceUrl: "https://x.co/inv" });
    expect(r.subject).toContain("PP/DP/ABC");
    expect(r.html).toContain("Thanks, Ada!");
    expect(r.html).toContain("https://x.co/order/t");
    expect(r.text).toContain("Planner  ₹499.00");
  });
});
