import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; inviteId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, inviteId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_TEAM");

    const invite = await db.invite.findFirst({
      where: { id: inviteId, organizationId },
    });
    if (!invite) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const updated = await db.invite.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    });

    await logAudit({
      organizationId,
      userId,
      action: "invite.revoked",
      entityType: "Invite",
      entityId: updated.id,
    });

    return NextResponse.json({ invite: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
