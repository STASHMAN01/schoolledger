import { getPlan } from "@/lib/paystack";

// Cross-tenant SaaS metrics for the /platform owner dashboard. Deliberately
// reads ONLY Organization-level subscription/billing fields (plan, status,
// country, signup date) — never a school's own Children/Payments data.
// Mixing those in would break the tenant-isolation guarantee this codebase
// otherwise holds everywhere else (see the SECURITY NOTE at the top of
// schema.prisma): what a school charges its own parents is that school's
// private data, not something the platform owner's dashboard should surface.

export type OrgBillingFields = {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  paystackPlanCode: string | null;
  countryCode: string;
  createdAt: Date;
};

export type Plan = "monthly" | "yearly" | "trial" | "unknown";

export function planForOrg(org: { paystackPlanCode: string | null; subscriptionStatus: string }): Plan {
  if (org.paystackPlanCode && org.paystackPlanCode === process.env.PAYSTACK_PLAN_CODE_MONTHLY) {
    return "monthly";
  }
  if (org.paystackPlanCode && org.paystackPlanCode === process.env.PAYSTACK_PLAN_CODE_YEARLY) {
    return "yearly";
  }
  if (org.subscriptionStatus === "trialing") return "trial";
  return "unknown";
}

// "Paying" = a subscription the payment provider currently considers
// billable (active or past_due, same definition src/lib/billing/access.ts
// uses for product access) — not just "has ever entered card details".
export function isPaying(org: { subscriptionStatus: string }): boolean {
  return org.subscriptionStatus === "active" || org.subscriptionStatus === "past_due";
}

export function isTrialing(org: { subscriptionStatus: string; trialEndsAt: Date | null }): boolean {
  if (org.subscriptionStatus !== "trialing") return false;
  return !org.trialEndsAt || org.trialEndsAt.getTime() > Date.now();
}

let priceCentsCache: { monthly: number | null; yearly: number | null; fetchedAt: number } | null =
  null;
const PRICE_CACHE_MS = 5 * 60 * 1000;

/**
 * Live unit-amount lookup for the two configured Paystack Plans, cached for
 * a few minutes in-process. Used to turn "N orgs on the monthly plan" into
 * an actual MRR figure without hardcoding the price anywhere — if the
 * price ever changes in Paystack, this dashboard reflects it automatically.
 * Returns nulls (never throws) if Paystack isn't configured — the
 * dashboard just omits the revenue figures in that case rather than
 * 500ing.
 */
export async function getConfiguredPriceCents(): Promise<{
  monthly: number | null;
  yearly: number | null;
}> {
  if (priceCentsCache && Date.now() - priceCentsCache.fetchedAt < PRICE_CACHE_MS) {
    return priceCentsCache;
  }

  const monthlyCode = process.env.PAYSTACK_PLAN_CODE_MONTHLY;
  const yearlyCode = process.env.PAYSTACK_PLAN_CODE_YEARLY;
  if (!process.env.PAYSTACK_SECRET_KEY || (!monthlyCode && !yearlyCode)) {
    return { monthly: null, yearly: null };
  }

  try {
    const [monthly, yearly] = await Promise.all([
      monthlyCode ? getPlan(monthlyCode) : Promise.resolve(null),
      yearlyCode ? getPlan(yearlyCode) : Promise.resolve(null),
    ]);
    const result = {
      monthly: monthly?.amount ?? null,
      yearly: yearly?.amount ?? null,
      fetchedAt: Date.now(),
    };
    priceCentsCache = result;
    return result;
  } catch (err) {
    console.error("Failed to fetch Paystack plan amounts for platform dashboard", err);
    return { monthly: null, yearly: null };
  }
}

// ISO 3166-1 alpha-2 -> display name, via the built-in Intl API so this
// needs no country-name dependency/table of its own.
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(countryCode: string): string {
  try {
    return regionNames.of(countryCode.toUpperCase()) ?? countryCode;
  } catch {
    return countryCode;
  }
}
