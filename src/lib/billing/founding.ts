import { db } from "@/lib/db";

// Founding-school plan (Dylan, 29 Sept 2026): R299 a month for life, for as
// long as the school stays subscribed, for the first 10 schools only
// (normally R499). Its Paystack plan code goes in PAYSTACK_PLAN_CODE_FOUNDING;
// until that's set the Billing page shows the offer with a "reserve" email
// link instead of a checkout button.
export const FOUNDING_PRICE_CENTS = 29900;
export const FOUNDING_SPOTS = 10;

// Places taken = schools currently paying on the founding plan. A school
// that cancels frees its place (it loses the price if it leaves).
export async function foundingSpotsLeft(): Promise<number> {
  const code = process.env.PAYSTACK_PLAN_CODE_FOUNDING;
  if (!code) return FOUNDING_SPOTS;
  const taken = await db.organization.count({
    where: { paystackPlanCode: code, subscriptionStatus: { in: ["active", "past_due"] }, deletedAt: null },
  });
  return Math.max(0, FOUNDING_SPOTS - taken);
}
