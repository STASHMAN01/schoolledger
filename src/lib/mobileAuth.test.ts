import { describe, expect, it } from "vitest";
import { bearerToken, hashMobileToken, mobileExpiry, newMobileToken } from "@/lib/mobileAuth";

describe("mobile auth helpers", () => {
  it("makes unguessable, url-safe tokens and hashes them", () => {
    const a = newMobileToken();
    const b = newMobileToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashMobileToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashMobileToken(a)).not.toContain(a);
  });

  it("reads only a well-formed Bearer header", () => {
    const t = newMobileToken();
    expect(bearerToken(`Bearer ${t}`)).toBe(t);
    expect(bearerToken(`bearer ${t}`)).toBeNull();
    expect(bearerToken("Bearer short")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(`Basic ${t}`)).toBeNull();
  });

  it("expires 60 days out", () => {
    const from = new Date("2026-10-07T00:00:00Z");
    expect(mobileExpiry(from).toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });
});
