import { describe, expect, it } from "vitest";
import { addressHash, optOutToken, readOptOutToken } from "./optout";

const env = { AGENTS_VAULT_KEY: "test-key" };
const id = "3f0c7a52-8a43-4d2e-9a3b-0d1f7f1c2b3a";

describe("opt-out links", () => {
  it("round-trips a signed token and refuses a forged one", () => {
    const t = optOutToken(id, env);
    expect(readOptOutToken(t, env)).toBe(id);
    expect(readOptOutToken(`${id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, env)).toBeNull();
    expect(readOptOutToken(t, { AGENTS_VAULT_KEY: "other" })).toBeNull();
    expect(readOptOutToken("nonsense", env)).toBeNull();
  });

  it("hashes emails case-insensitively, matching the database's sha256", () => {
    expect(addressHash("email", " Ravi@Example.TEST ")).toBe(addressHash("email", "ravi@example.test"));
    expect(addressHash("whatsapp", "+919000000001")).toMatch(/^[0-9a-f]{64}$/);
  });
});
