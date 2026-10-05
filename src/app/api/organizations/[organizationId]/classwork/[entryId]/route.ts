import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; entryId: string }> };

// Removes a mistaken entry. Admin side only (teachers can only add); the
// removal is recorded in the activity log.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, entryId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const entry = await db.classworkEntry.findFirst({
      where: { id: entryId, organizationId },
      select: { id: true, date: true, category: { select: { name: true } } },
    });
    if (!entry) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await db.classworkEntry.delete({ where: { id: entry.id } });

    await logAudit({
      organizationId,
      userId,
      action: "classwork.deleted",
      entityType: "ClassworkEntry",
      entityId: entry.id,
      metadata: { date: entry.date.toISOString().slice(0, 10), className: entry.category.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
