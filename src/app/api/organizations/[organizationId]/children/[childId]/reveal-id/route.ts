import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";

// Security review #17 (7 Oct 2026): only people who manage children may
// reveal a full ID number, and at most 30 an hour each, so nobody can
// quietly collect every ID in the school.
const REVEALS_PER_HOUR = 30;

type Params = { params: Promise<{ organizationId: string; childId: string }> };

const bodySchema = z.object({ field: z.enum(["childIdNumber", "parentIdNumber"]) });

// Returns one masked-by-default ID number in full, and logs exactly who
// looked at it and when -- the "audit-logged reveal" the plan asks for.
// Deliberately its own endpoint (not a flag on GET) so every reveal is a
// distinct, intentional, logged action rather than something that happens
// silently every time the profile page loads.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_CHILDREN", { allowWhenReadOnly: true });
    const quota = await rateLimit(`reveal-id:${organizationId}:${userId}`, { limit: REVEALS_PER_HOUR, windowMs: 60 * 60 * 1000 });
    if (!quota.allowed) {
      return NextResponse.json({ error: "Too many ID numbers shown in the last hour. Try again later." }, { status: 429 });
    }

    const child = await db.child.findFirst({ where: { id: childId, organizationId } });
    if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { field } = bodySchema.parse(await req.json());
    const value = field === "childIdNumber" ? child.childIdNumber : child.parentIdNumber;

    await logAudit({
      organizationId,
      userId,
      action: "child.idNumber.revealed",
      entityType: "Child",
      entityId: childId,
      metadata: { field },
    });

    return NextResponse.json({ value: value ?? null });
  } catch (err) {
    return handleApiError(err);
  }
}
