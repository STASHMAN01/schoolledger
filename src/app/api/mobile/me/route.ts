import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { mobileDeviceFromRequest } from "@/lib/mobileAuth";
import { getEffectivePermissions } from "@/lib/permissions";

// Who the app is signed in as, and which schools they belong to (with the
// role, permissions and, for a teacher, their class). The app calls this on
// start-up; a 401 means the token is no longer valid and it shows the login.
export async function GET() {
  try {
    const device = await mobileDeviceFromRequest();
    if (!device) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: device.userId },
      select: {
        id: true,
        name: true,
        email: true,
        memberships: {
          include: {
            permissionOverrides: true,
            organization: { select: { id: true, name: true, timezone: true, deletedAt: true } },
          },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      organizations: user.memberships
        .filter((m) => !m.organization.deletedAt)
        .map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          timezone: m.organization.timezone,
          role: m.role,
          permissions: getEffectivePermissions(m.role, m.permissionOverrides),
          assignedCategoryId: m.assignedCategoryId,
        })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
