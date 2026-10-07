import { describe, expect, it } from "vitest";
import { decide, hashRateLimitKey, memoryRateLimit } from "./rateLimit";

describe("rate limiter", () => {
  it("allows up to the limit, then refuses", () => {
    expect(decide(1, 3)).toEqual({ allowed: true, remaining: 2 });
    expect(decide(3, 3)).toEqual({ allowed: true, remaining: 0 });
    expect(decide(4, 3)).toEqual({ allowed: false, remaining: 0 });
  });

  it("in-memory fallback counts per key within a window", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    expect(memoryRateLimit("t:a", opts).allowed).toBe(true);
    expect(memoryRateLimit("t:a", opts).allowed).toBe(true);
    expect(memoryRateLimit("t:a", opts).allowed).toBe(false);
    expect(memoryRateLimit("t:b", opts).allowed).toBe(true);
  });

  it("hashes keys so emails and IPs are never stored", async () => {
    const h = await hashRateLimitKey("login:email:someone@example.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("example");
    expect(await hashRateLimitKey("login:email:someone@example.com")).toBe(h);
  });
});
