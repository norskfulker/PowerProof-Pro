import { describe, expect, it } from "vitest";
import { readReplyAddress, replyAddress, replyText } from "./reply-address";

const env = { AGENTS_VAULT_KEY: "test-key", AGENT_REPLY_DOMAIN: "reply.example.in" };
const id = "3f1c2a7e-9b0d-4c5e-8f6a-1b2c3d4e5f60";

describe("agent reply addresses", () => {
  it("is off until a reply domain is set", () => {
    expect(replyAddress(id, { AGENTS_VAULT_KEY: "test-key" })).toBeUndefined();
  });

  it("names the message and reads back only when signed by us", () => {
    const a = replyAddress(id, env)!;
    expect(a).toMatch(/^reply\+3f1c2a7e-9b0d-4c5e-8f6a-1b2c3d4e5f60\.[a-z0-9]{20}@reply\.example\.in$/);
    expect(readReplyAddress(a, env)).toBe(id);
    // Mail servers may change the case of the address
    expect(readReplyAddress(a.toUpperCase(), env)).toBe(id);
    expect(readReplyAddress(a.replace(/\.[a-z0-9]{20}@/, ".aaaaaaaaaaaaaaaaaaaa@"), env)).toBeNull();
    expect(readReplyAddress(a, { ...env, AGENTS_VAULT_KEY: "other" })).toBeNull();
  });

  it("keeps only the customer's own words", () => {
    const text = "Will pay by Friday, thanks.\n\nOn Mon, 26 Oct 2026 at 10:00, Sharma Traders wrote:\n> Hi, a gentle reminder…";
    expect(replyText(text)).toBe("Will pay by Friday, thanks.");
    expect(replyText("Paid.\n-- \nRavi\nSent from my phone")).toBe("Paid.");
  });
});
