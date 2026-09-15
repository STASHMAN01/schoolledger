import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import {
  planForOrg,
  isPaying,
  isTrialing,
  getConfiguredPriceCents,
  countryName,
} from "@/lib/platformStats";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const orgs = await db.organization.findMany({
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        stripePriceId: true,
        countryCode: true,
        createdAt: true,
      },
    });

    const priceCents = await getConfiguredPriceCents();

    let payingMonthly = 0;
    let payingYearly = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceled = 0;
    const byCountry = new Map<string, number>();

    for (const org of orgs) {
      byCountry.set(org.countryCode, (byCountry.get(org.countryCode) ?? 0) + 1);

      if (org.subscriptionStatus === "past_due") pastDue++;
      if (org.subscriptionStatus === "canceled") canceled++;
      if (isTrialing(org)) trialing++;

      if (isPaying(org)) {
        const plan = planForOrg(org);
        if (plan === "monthly") payingMonthly++;
        else if (plan === "yearly") payingYearly++;
      }
    }

    const payingTotal = payingMonthly + payingYearly;

    // MRR: monthly-plan orgs pay their price every month; yearly-plan orgs
    // pay once a year, so their contribution is divided by 12. Null price
    // (Stripe not configured, or price id env vars unset/stale) means that
    // component is simply omitted from the total rather than treated as 0,
    // so the dashboard doesn't quietly under-report revenue as "0".
    const pricesKnown = priceCents.monthly !== null && priceCents.yearly !== null;
    const mrrCents = pricesKnown
      ? payingMonthly * (priceCents.monthly ?? 0) + payingYearly * ((priceCents.yearly ?? 0) / 12)
      : null;
    const arrCents = mrrCents !== null ? mrrCents * 12 : null;

    const countries = Array.from(byCountry.entries())
      .map(([countryCode, count]) => ({ countryCode, countryName: countryName(countryCode), count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalOrganizations: orgs.length,
      payingTotal,
      payingMonthly,
      payingYearly,
      trialing,
      pastDue,
      canceled,
      mrrCents,
      arrCents,
      priceCents,
      countries,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
