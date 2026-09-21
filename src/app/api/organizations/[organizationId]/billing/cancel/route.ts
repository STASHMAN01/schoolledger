import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { disableSubscription } from "@/lib/paystack";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ organizationId: string }> };

// Replaces the old Stripe billing-portal redirect — Paystack has no hosted
// self-serve portal, so cancellation is this one in-app action instead.
// Disabling stops the NEXT auto-renewal charge; Paystack does not refund or
// cut off access immediately, so access should keep working until
// currentPeriodEnd, same as it already does for a lapsed trial.
export async function POST(_req: Request, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "MANAGE_BILLING", { skipAccessCheck: true });

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization?.paystackSubscriptionCode || !organization.paystackEmailToken) {
      return NextResponse.json(
        { error: "No active subscription to cancel." },
        { status: 400 }
      );
    }

    await disableSubscription({
      code: organization.paystackSubscriptionCode,
      token: organization.paystackEmailToken,
    });

    // Optimistic local update so the UI reflects this immediately rather
    // than waiting on the webhook round-trip — the webhook handler will
    // also set this on its own subscription.disable event, so this is
    // just belt-and-braces, not the only place it happens.
    await db.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: "canceled" },
    });

    await logAudit({
      organizationId,
      action: "billing.subscriptionCancelled",
      entityType: "Organization",
      entityId: organizationId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
