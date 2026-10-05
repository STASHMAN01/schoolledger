import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Admin: lesson plans teachers have proposed and nobody has reviewed yet,
// grouped by class.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const rows = await db.lessonPlan.findMany({
      where: { organizationId, status: "PENDING", category: { deletedAt: null } },
      orderBy: [{ categoryId: "asc" }, { date: "asc" }],
      select: {
        date: true,
        topic: true,
        notes: true,
        category: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });

    const classes = new Map<string, { id: string; name: string; days: { date: string; topic: string; notes: string; by: string }[] }>();
    for (const r of rows) {
      const entry = classes.get(r.category.id) ?? { id: r.category.id, name: r.category.name, days: [] };
      entry.days.push({ date: r.date.toISOString().slice(0, 10), topic: r.topic, notes: r.notes ?? "", by: r.createdBy.name });
      classes.set(r.category.id, entry);
    }
    return NextResponse.json({ classes: [...classes.values()].sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err) {
    return handleApiError(err);
  }
}
