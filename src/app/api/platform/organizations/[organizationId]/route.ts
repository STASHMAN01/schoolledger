import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TRIAL_DAYS } from "@/lib/trial";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { TenantAccessError } from "@/lib/tenant";

// The full vocabulary a platform admin can force an org's subscriptionStatus
// to from here. Deliberately the same values billing/access.ts and
// platformStats.ts already know how to read — this never introduces a new
// status those don't handle. "lifetime" is the one value NO Paystack
// webhook ever writes (see src/app/api/webhooks/paystack/route.ts), so it
// only ever changes via this endpoint, and Paystack activity for an org
// that's already Paystack-connected can still freely move it between the
// other four afterwards.
const MANUAL_STATUSES = ["lifetime", "active", "trialing", "past_due", "canceled"] as const;

const bodySchema = z.object({
  subscriptionStatus: z.enum(MANUAL_STATUSES),
});

type Params = { params: Promise<{ organizationId: string }> };

// Manual override of one school's billing status — e.g. granting a
// lifetime/comp account, or reactivating one by hand without going through
// Paystack. This is a deliberately blunt tool: it does not touch Paystack
// at all (no charge, no plan change over there), it just tells this app's
// own access checks (hasActiveAccess) and the /platform dashboards to
// treat the org as this status from now on. If the org is later charged
// through Paystack for real, that webhook traffic will just overwrite
// this the same way it would for any other org.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await requirePlatformAdmin();
    const { organizationId } = await params;

    const json = await req.json().catch(() => null);
    const { subscriptionStatus } = bodySchema.parse(json);

    const existing = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, subscriptionStatus: true, trialEndsAt: true },
    });
    if (!existing) {
      throw new TenantAccessError("School not found.", 404);
    }

    // Lifetime/canceled have no meaningful trial-end or renewal date of
    // their own — clear both so the "Schools" table doesn't show a stale
    // date left over from whatever status the org was in before.
    const clearsDates = subscriptionStatus === "lifetime" || subscriptionStatus === "canceled";
    // Putting a school (back) on trial with no trial end date on file gives
    // it a fresh free trial from today, instead of a trial that never ends.
    const freshTrial =
      subscriptionStatus === "trialing" && (!existing.trialEndsAt || existing.trialEndsAt < new Date())
        ? { trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) }
        : {};

    const updated = await db.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus,
        ...(clearsDates ? { trialEndsAt: null, currentPeriodEnd: null } : {}),
        ...freshTrial,
      },
      select: { id: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
    });

    await logAudit({
      organizationId,
      userId,
      action: "platform.subscriptionOverride",
      entityType: "Organization",
      entityId: organizationId,
      metadata: { from: existing.subscriptionStatus, to: subscriptionStatus },
    });

    return NextResponse.json({ organization: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
