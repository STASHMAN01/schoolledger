import { getStripe } from "@/lib/stripe";

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
  stripePriceId: string | null;
  countryCode: string;
  createdAt: Date;
};

export type Plan = "monthly" | "yearly" | "trial" | "unknown";

export function planForOrg(org: { stripePriceId: string | null; subscriptionStatus: string }): Plan {
  if (org.stripePriceId && org.stripePriceId === process.env.STRIPE_PRICE_ID_MONTHLY) {
    return "monthly";
  }
  if (org.stripePriceId && org.stripePriceId === process.env.STRIPE_PRICE_ID_YEARLY) {
    return "yearly";
  }
  if (org.subscriptionStatus === "trialing") return "trial";
  return "unknown";
}

// "Paying" = a subscription Stripe currently considers billable (active or
// past_due, same definition src/lib/billing/access.ts uses for product
// access) — not just "has ever entered card details".
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
 * Live unit-amount lookup for the two configured Stripe Prices, cached for
 * a few minutes in-process. Used to turn "N orgs on the monthly plan" into
 * an actual MRR figure without hardcoding the price anywhere — if the
 * price ever changes in Stripe, this dashboard reflects it automatically.
 * Returns nulls (never throws) if Stripe isn't configured — the dashboard
 * just omits the revenue figures in that case rather than 500ing.
 */
export async function getConfiguredPriceCents(): Promise<{
  monthly: number | null;
  yearly: number | null;
}> {
  if (priceCentsCache && Date.now() - priceCentsCache.fetchedAt < PRICE_CACHE_MS) {
    return priceCentsCache;
  }

  const monthlyId = process.env.STRIPE_PRICE_ID_MONTHLY;
  const yearlyId = process.env.STRIPE_PRICE_ID_YEARLY;
  if (!process.env.STRIPE_SECRET_KEY || (!monthlyId && !yearlyId)) {
    return { monthly: null, yearly: null };
  }

  try {
    const stripe = getStripe();
    const [monthly, yearly] = await Promise.all([
      monthlyId ? stripe.prices.retrieve(monthlyId) : Promise.resolve(null),
      yearlyId ? stripe.prices.retrieve(yearlyId) : Promise.resolve(null),
    ]);
    const result = {
      monthly: monthly?.unit_amount ?? null,
      yearly: yearly?.unit_amount ?? null,
      fetchedAt: Date.now(),
    };
    priceCentsCache = result;
    return result;
  } catch (err) {
    console.error("Failed to fetch Stripe price amounts for platform dashboard", err);
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
