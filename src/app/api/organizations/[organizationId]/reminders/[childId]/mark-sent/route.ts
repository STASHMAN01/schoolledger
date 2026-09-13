import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { z } from "zod";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

const bodySchema = z.object({
  channel: z.enum(["whatsapp", "email", "manual"]).optional(),
});

// Purely a record-keeping action — nothing is actually sent from the
// server (see the reminders route's comment for why). This just lets
// whoever's working through the list check items off and see who's
// already been reminded this round.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    // Same "anyone but VIEWER" boundary as organizing children/categories —
    // sending a reminder isn't moving money, so it doesn't need the
    // ADMIN/ACCOUNTANT-only restriction payments do.
    const { userId } = await requireMembership(organizationId, [
      "ADMIN",
      "ACCOUNTANT",
      "MANAGER",
    ]);

    const child = await db.child.findFirst({ where: { id: childId, organizationId } });
    if (!child) {
      return NextResponse.json({ error: "Child not found." }, { status: 404 });
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    const updated = await db.child.update({
      where: { id: childId },
      data: { lastReminderSentAt: new Date() },
    });

    await logAudit({
      organizationId,
      userId,
      action: "reminder.sent",
      entityType: "Child",
      entityId: childId,
      metadata: { childName: `${child.firstName} ${child.lastName}`, channel: body.channel ?? "manual" },
    });

    return NextResponse.json({ lastReminderSentAt: updated.lastReminderSentAt });
  } catch (err) {
    return handleApiError(err);
  }
}
