import { describe, expect, it } from "vitest";
import { REQUIRED_DELETION_APPROVALS, requiredApprovalsFor } from "./deletion";

// Before 2 Oct 2026 the requirement was a flat 2, which a one-admin school
// could never reach: it would request a deletion, approve once, and sit at
// 1/2 forever with no way to delete anything -- including a payment entered
// by mistake. Most crèches are run by one person, so this was most of the
// target market. These cases pin the rule that replaced it.

describe("requiredApprovalsFor", () => {
  it("keeps the two-person check once a school has two or more approvers", () => {
    expect(requiredApprovalsFor(2)).toBe(REQUIRED_DELETION_APPROVALS);
    expect(requiredApprovalsFor(3)).toBe(REQUIRED_DELETION_APPROVALS);
    expect(requiredApprovalsFor(25)).toBe(REQUIRED_DELETION_APPROVALS);
  });

  it("lets a sole admin approve alone", () => {
    expect(requiredApprovalsFor(1)).toBe(1);
  });

  it("never requires zero approvals", () => {
    // An org with nobody holding APPROVE_DELETION shouldn't resolve to 0,
    // which would delete a record the instant a request was raised.
    expect(requiredApprovalsFor(0)).toBe(1);
    expect(requiredApprovalsFor(-1)).toBe(1);
  });

  it("never requires more approvals than there are people to give them", () => {
    for (const approvers of [0, 1, 2, 3, 10]) {
      const required = requiredApprovalsFor(approvers);
      expect(required).toBeLessThanOrEqual(Math.max(1, approvers));
      expect(required).toBeGreaterThanOrEqual(1);
    }
  });
});
