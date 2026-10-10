import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ sbAdmin: () => ({}) }));

const { addressBlocked, safeFetch, FetchBlocked } = await import("@/lib/server/safe-fetch");

describe("reading addresses creators type", () => {
  it("never reaches private, local or internal addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "224.0.0.1"]) expect(addressBlocked(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "104.18.0.1", "2606:4700::1111"]) expect(addressBlocked(ip), ip).toBe(false);
  });
  it("refuses http, other ports, credentials and localhost before fetching", async () => {
    for (const url of ["http://example.com", "https://example.com:8080/", "https://user:pass@example.com/", "https://localhost/", "https://127.0.0.1/"]) await expect(safeFetch(url), url).rejects.toBeInstanceOf(FetchBlocked);
  });
});
