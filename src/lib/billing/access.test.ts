import { describe, it, expect } from "vitest";
import { hasActiveAccess } from "./access";

// This is the other place a bug is expensive: get this wrong and either a
// paying school gets locked out (angry customer) or a non-paying one keeps
// full access forever (revenue leak). Every case here mirrors a state
// the Paystack webhook handler can actually put an organization into.

describe("hasActiveAccess", () => {
  it("grants access during an unexpired trial", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(hasActiveAccess({ subscriptionStatus: "trialing", trialEndsAt: future })).toBe(true);
  });

  it("denies access once the trial end date is in the past", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(hasActiveAccess({ subscriptionStatus: "trialing", trialEndsAt: past })).toBe(false);
  });

  it("grants access for a trialing org with no trialEndsAt set (treated as not yet expired)", () => {
    expect(hasActiveAccess({ subscriptionStatus: "trialing", trialEndsAt: null })).toBe(true);
  });

  it("grants access for an active paid subscription", () => {
    expect(hasActiveAccess({ subscriptionStatus: "active", trialEndsAt: null })).toBe(true);
  });

  it("grants access for past_due, trusting Paystack's own dunning/retry schedule", () => {
    expect(hasActiveAccess({ subscriptionStatus: "past_due", trialEndsAt: null })).toBe(true);
  });

  it("denies access once canceled, even if a stale trialEndsAt is still in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(hasActiveAccess({ subscriptionStatus: "canceled", trialEndsAt: future })).toBe(false);
  });

  it("denies access for an incomplete subscription (initial payment never succeeded)", () => {
    expect(hasActiveAccess({ subscriptionStatus: "incomplete", trialEndsAt: null })).toBe(false);
  });
});
