import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership, TenantAccessError } from "@/lib/tenant";
import { verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { purgeDateFor } from "@/lib/orgDeletion";

type Params = { params: Promise<{ organizationId: string }> };

const bodySchema = z.object({
  confirmName: z.string().max(200),
  password: z.string().min(1).max(200),
});

// Moves the whole school into the 30-day trash (deletedAt). Admins only,
// and only after re-typing the school's name and their own password --
// this locks out every member immediately. Restorable from the dashboard
// for 30 days; after that the daily purge removes it for good.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    // skipAccessCheck: a school whose trial has lapsed must still be deletable.
    const { userId, role } = await requireMembership(organizationId, undefined, {
      skipAccessCheck: true,
    });
    if (role !== "ADMIN") {
      throw new TenantAccessError("Only an admin can delete the school.", 403);
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const [org, user] = await Promise.all([
      db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, subscriptionStatus: true, paystackSubscriptionCode: true },
      }),
      db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
    ]);
    if (!org || !user) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (parsed.data.confirmName.trim().toLowerCase() !== org.name.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "The school name you typed doesn't match." },
        { status: 400 }
      );
    }
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
    }

    // Don't leave Paystack billing a school that no longer exists.
    if (
      org.paystackSubscriptionCode &&
      (org.subscriptionStatus === "active" || org.subscriptionStatus === "past_due")
    ) {
      return NextResponse.json(
        { error: "Cancel your subscription under Settings → Billing first, then delete the school." },
        { status: 409 }
      );
    }

    const deletedAt = new Date();
    await db.organization.update({
      where: { id: organizationId },
      data: { deletedAt, deletedByUserId: userId },
    });

    await logAudit({
      organizationId,
      userId,
      action: "organization.deleted",
      entityType: "Organization",
      entityId: organizationId,
      metadata: { purgeAfter: purgeDateFor(deletedAt).toISOString() },
    });

    return NextResponse.json({ deletedAt, purgeAfter: purgeDateFor(deletedAt) });
  } catch (err) {
    return handleApiError(err);
  }
}
