import { describe, expect, it } from "vitest";
import { agentEnv, fromAddress } from "./mail-from";

describe("agent mail sender", () => {
  it("keeps the configured address and names the store", () => {
    expect(fromAddress({ MAIL_FROM: "amaze@powerproof.app" })).toBe("amaze@powerproof.app");
    expect(fromAddress({ MAIL_FROM: "PowerProof <amaze@powerproof.app>" })).toBe("amaze@powerproof.app");
    expect(agentEnv("Demo <Traders>", { MAIL_FROM: "amaze@powerproof.app" }).MAIL_FROM).toBe('"Demo Traders via PowerProof" <amaze@powerproof.app>');
  });

  it("leaves the settings alone when no sender is set", () => {
    expect(agentEnv("Demo", {}).MAIL_FROM).toBeUndefined();
  });
});
