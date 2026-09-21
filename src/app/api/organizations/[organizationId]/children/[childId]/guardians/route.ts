import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { guardianSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { maskIdNumber } from "@/lib/idMask";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

// Same "does this child exist, and if I'm a TEACHER is it my own class"
// check every other children/[childId]/* route makes -- see that route's
// comment for why a mismatch and a real not-found look identical.
async function findAccessibleChild(
  organizationId: string,
  childId: string,
  role: string,
  assignedCategoryId: string | null
) {
  const child = await db.child.findFirst({ where: { id: childId, organizationId } });
  if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) {
    return null;
  }
  return child;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);

    const child = await findAccessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const guardians = await db.guardian.findMany({
      where: { childId, organizationId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      guardians: guardians.map((g) => ({ ...g, idNumber: maskIdNumber(g.idNumber) })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const child = await findAccessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = guardianSchema.parse(await req.json());

    if (body.photoImage && !child.photoConsentGiven) {
      return NextResponse.json(
        { error: "Photo consent is required (on the child's profile) before a guardian photo can be saved." },
        { status: 400 }
      );
    }

    const guardian = await db.guardian.create({
      data: {
        organizationId,
        childId,
        relationship: body.relationship,
        firstName: body.firstName,
        lastName: body.lastName,
        idNumber: body.idNumber ?? null,
        occupation: body.occupation ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        photoImage: body.photoImage ?? null,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "guardian.created",
      entityType: "Guardian",
      entityId: guardian.id,
      metadata: { childId, firstName: guardian.firstName, lastName: guardian.lastName },
    });

    return NextResponse.json(
      { guardian: { ...guardian, idNumber: maskIdNumber(guardian.idNumber) } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
