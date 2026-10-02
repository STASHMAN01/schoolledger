import { describe, expect, it } from "vitest";
import {
  MONTHLY_PRICE,
  YEARLY_PRICE,
  FOUNDING_PRICE,
  TWELVE_MONTHS_PRICE,
  YEARLY_VS_MONTHLY,
  MONTHS_FREE_ON_YEARLY,
} from "./pricingDisplay";

// These strings are the prices a visitor reads on the homepage and on
// /pricing. They were typed out separately on each page before 2 Oct
// 2026; the point of the module is that both pages now read the same
// values, so the formatting and the arithmetic are worth pinning.

describe("pricing display", () => {
  it("writes the prices the way the rest of the site writes them", () => {
    expect(MONTHLY_PRICE).toBe("R499");
    expect(YEARLY_PRICE).toBe("R4,990");
    expect(FOUNDING_PRICE).toBe("R299");
    // Comma-grouped, not space-grouped: toLocaleString("en-ZA") would
    // give "R4 990", which matches nothing else on the site.
    expect(YEARLY_PRICE).not.toContain(" ");
  });

  it("derives the yearly saving instead of asserting it in copy", () => {
    expect(TWELVE_MONTHS_PRICE).toBe("R5,988");
    expect(YEARLY_VS_MONTHLY).toBe("R998");
    expect(MONTHS_FREE_ON_YEARLY).toBe(2);
  });
});
