import { beforeAll, describe, expect, it } from "vitest";
import { isValidStepUpValue, makeStepUpValue } from "./platformTwoFactor";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-step-up-cookie";
});

describe("platform two-factor cookie", () => {
  const now = 1_800_000_000_000;

  it("accepts its own value for the same user and token version", () => {
    const v = makeStepUpValue("user1", 3, now);
    expect(isValidStepUpValue(v, "user1", 3, now + 1000)).toBe(true);
  });

  it("rejects another user, a bumped token version, expiry and tampering", () => {
    const v = makeStepUpValue("user1", 3, now);
    expect(isValidStepUpValue(v, "user2", 3, now)).toBe(false);
    expect(isValidStepUpValue(v, "user1", 4, now)).toBe(false);
    expect(isValidStepUpValue(v, "user1", 3, now + 13 * 60 * 60 * 1000)).toBe(false);
    const [uid, ver, , sig] = v.split(".");
    expect(isValidStepUpValue(`${uid}.${ver}.${now + 10 ** 12}.${sig}`, "user1", 3, now)).toBe(false);
    expect(isValidStepUpValue(undefined, "user1", 3, now)).toBe(false);
  });
});
