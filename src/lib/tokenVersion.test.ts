import { describe, expect, it, vi } from "vitest";
import { isTokenStillValid } from "./tokenVersion";

describe("isTokenStillValid", () => {
  it("keeps a session whose tokenVersion matches", async () => {
    expect(await isTokenStillValid(3, async () => ({ tokenVersion: 3 }))).toBe(true);
  });

  it("ends a session after a password change or forced logout", async () => {
    expect(await isTokenStillValid(3, async () => ({ tokenVersion: 4 }))).toBe(false);
  });

  it("ends a session whose user no longer exists", async () => {
    expect(await isTokenStillValid(3, async () => null)).toBe(false);
  });

  it("does NOT log someone out because the database lookup failed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await isTokenStillValid(3, async () => {
      throw new Error("Can't reach database server");
    });
    expect(result).toBe(true);
    spy.mockRestore();
  });
});
