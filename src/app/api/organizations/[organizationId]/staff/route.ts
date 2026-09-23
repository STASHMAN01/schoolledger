import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership, TenantAccessError } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Phase 5 Staff tile/page: the org's team members (Memberships -- staff
// without an app login are deliberately not modelled yet) with role and
// assigned class. Visible to whoever runs the centre (MANAGE_CLASSES) or
// manages the team (MANAGE_TEAM); editing stays in Settings -> Team.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { permissions } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (!permissions.includes("MANAGE_CLASSES") && !permissions.includes("MANAGE_TEAM")) {
      throw new TenantAccessError("Not allowed for your role.", 403);
    }

    const members = await db.membership.findMany({
      where: { organizationId },
      include: {
        user: { select: { name: true, email: true } },
        assignedCategory: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      staff: members.map((m) => ({
        id: m.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        assignedClass: m.assignedCategory,
        joinedAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
