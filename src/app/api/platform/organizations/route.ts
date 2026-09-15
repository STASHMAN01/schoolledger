import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import { planForOrg, isPaying, isTrialing, countryName } from "@/lib/platformStats";

// Org list for the /platform/organizations table. Intentionally selects
// only billing/identity fields plus cheap _count rollups — never a school's
// Children/Payments rows themselves (see the note in platformStats.ts).
export async function GET() {
  try {
    await requirePlatformAdmin();

    const orgs = await db.organization.findMany({
      select: {
        id: true,
        name: true,
        countryCode: true,
        currencyCode: true,
        subscriptionStatus: true,
        stripePriceId: true,
        stripeCustomerId: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        createdAt: true,
        _count: { select: { memberships: true, children: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      organizations: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        countryCode: org.countryCode,
        countryName: countryName(org.countryCode),
        currencyCode: org.currencyCode,
        subscriptionStatus: org.subscriptionStatus,
        plan: planForOrg(org),
        isPaying: isPaying(org),
        isTrialing: isTrialing(org),
        // How long they've been a paying subscriber, from signup — a
        // simple, always-available stand-in for "customer since" that
        // needs no extra Stripe invoice-history calls. currentPeriodEnd
        // is included too so the table can show "renews/expires" alongside.
        createdAt: org.createdAt,
        trialEndsAt: org.trialEndsAt,
        currentPeriodEnd: org.currentPeriodEnd,
        memberCount: org._count.memberships,
        childrenCount: org._count.children,
        hasStripeCustomer: Boolean(org.stripeCustomerId),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
