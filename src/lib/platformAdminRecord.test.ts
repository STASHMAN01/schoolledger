import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/platformTwoFactor", () => ({ hasPassedStepUp: vi.fn() }));

import { isPlatformAdminRecord } from "./platformAdmin";

beforeAll(() => {
  process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";
});

const base = { email: "owner@example.com", isPlatformAdmin: false, isProfile: false, emailVerified: new Date() };

describe("isPlatformAdminRecord (security review #12)", () => {
  it("accepts a verified owner email or a flagged admin", () => {
    expect(isPlatformAdminRecord(base)).toBe(true);
    expect(isPlatformAdminRecord({ ...base, email: "x@example.com", isPlatformAdmin: true })).toBe(true);
  });

  it("refuses an unverified owner email, a class profile, and everyone else", () => {
    expect(isPlatformAdminRecord({ ...base, emailVerified: null })).toBe(false);
    expect(isPlatformAdminRecord({ ...base, isProfile: true })).toBe(false);
    expect(isPlatformAdminRecord({ ...base, email: "x@example.com" })).toBe(false);
    expect(isPlatformAdminRecord({ ...base, email: null })).toBe(false);
  });
});
