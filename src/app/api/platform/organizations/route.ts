import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import { planForOrg, isPaying, isTrialing, countryName } from "@/lib/platformStats";
import { purgeDateFor } from "@/lib/orgDeletion";

// Org list for the /platform/organizations table. Intentionally selects
// only billing/identity fields plus cheap _count rollups — never a school's
// Children/Payments rows themselves (see the note in platformStats.ts).
// Also returns who to contact about the account (Dylan, 19 Oct 2026: "see
// the email addresses of schools that sign up so I can contact and help
// them"): the person who signed the school up (its first ADMIN, created by
// /api/auth/register) plus the optional contact fields from Settings.
// That's account-holder contact data, not children's or parents' data.
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
        paystackPlanCode: true,
        paystackCustomerCode: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        createdAt: true,
        deletedAt: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        memberships: {
          where: { role: "ADMIN" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { user: { select: { name: true, email: true, emailVerified: true } } },
        },
        _count: { select: { memberships: true, children: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      organizations: orgs.map((org) => {
        const signupAdmin = org.memberships[0]?.user ?? null;
        return {
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
          // needs no extra Paystack invoice-history calls. currentPeriodEnd
          // is included too so the table can show "renews/expires" alongside.
          createdAt: org.createdAt,
          trialEndsAt: org.trialEndsAt,
          currentPeriodEnd: org.currentPeriodEnd,
          memberCount: org._count.memberships,
          childrenCount: org._count.children,
          hasPaystackCustomer: Boolean(org.paystackCustomerCode),
          // In the 30-day trash; permanently removed on this date.
          purgeAfter: org.deletedAt ? purgeDateFor(org.deletedAt) : null,
          // The person who signed up. Null only if every admin has since
          // been removed from the school.
          signupName: signupAdmin?.name ?? null,
          signupEmail: signupAdmin?.email ?? null,
          signupEmailVerified: Boolean(signupAdmin?.emailVerified),
          contactName: org.contactName,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
