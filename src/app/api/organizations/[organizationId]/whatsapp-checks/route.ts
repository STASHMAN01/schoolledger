import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership, TenantAccessError } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";

type Params = { params: Promise<{ organizationId: string }> };

// Phase 5 Communication tab: per class, which children's parents have been
// added to that class's WhatsApp group. Manual tick-list only -- Crechely
// doesn't talk to WhatsApp. Read: Centre Management (TEACHER: own class).
// Tick/untick: MANAGE_CHILDREN (TEACHER: own class).

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const scope = resolveAttendanceScope(role, assignedCategoryId, req.nextUrl.searchParams.get("categoryId"));
    if (scope.mode === "none") {
      return NextResponse.json({ error: "No class assigned yet." }, { status: 400 });
    }
    if (scope.mode === "all") {
      return NextResponse.json({ error: "categoryId is required." }, { status: 400 });
    }

    const category = await db.category.findFirst({
      where: { id: scope.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const [children, checks] = await Promise.all([
      db.child.findMany({
        where: { organizationId, categoryId: category.id, archived: false, deletedAt: null, exitDate: null },
        select: { id: true, firstName: true, lastName: true, parentName: true, parentPhone: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      db.whatsAppGroupCheck.findMany({
        where: { organizationId, categoryId: category.id },
        select: { childId: true, addedAt: true },
      }),
    ]);
    const addedAt = new Map(checks.map((c) => [c.childId, c.addedAt.toISOString()]));

    return NextResponse.json({
      category,
      children: children.map((c) => ({ ...c, addedAt: addedAt.get(c.id) ?? null })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const postSchema = z.object({
  childId: z.string().min(1),
  categoryId: z.string().min(1),
  added: z.boolean(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_CHILDREN");
    const body = postSchema.parse(await req.json());

    if (role === "TEACHER" && body.categoryId !== assignedCategoryId) {
      throw new TenantAccessError("Not allowed for your role.", 403);
    }

    // The child must belong to this org AND currently be in that class.
    const child = await db.child.findFirst({
      where: { id: body.childId, organizationId, categoryId: body.categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (body.added) {
      await db.whatsAppGroupCheck.upsert({
        where: { childId_categoryId: { childId: child.id, categoryId: body.categoryId } },
        create: { organizationId, childId: child.id, categoryId: body.categoryId, addedByUserId: userId },
        update: {},
      });
    } else {
      await db.whatsAppGroupCheck.deleteMany({
        where: { organizationId, childId: child.id, categoryId: body.categoryId },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
