import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership, TenantAccessError } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Takes a school back out of the 30-day trash. Admins only. The one route
// allowed past requireMembership's "this school is deleted" lock.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, undefined, {
      skipAccessCheck: true,
      allowDeletedOrganization: true,
    });
    if (role !== "ADMIN") {
      throw new TenantAccessError("Only an admin can restore the school.", 403);
    }

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { deletedAt: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (!org.deletedAt) {
      return NextResponse.json({ restored: true });
    }

    await db.organization.update({
      where: { id: organizationId },
      data: { deletedAt: null, deletedByUserId: null },
    });

    await logAudit({
      organizationId,
      userId,
      action: "organization.restored",
      entityType: "Organization",
      entityId: organizationId,
    });

    return NextResponse.json({ restored: true });
  } catch (err) {
    return handleApiError(err);
  }
}
