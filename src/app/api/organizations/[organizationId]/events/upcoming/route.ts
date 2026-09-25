import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Phase 5 Upcoming Events tile. Read-only view of the existing (billing)
// Event model for Centre Management. Amounts are only included for
// VIEW_MONEY, and a TEACHER only sees events that apply to their class.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    const canSeeMoney = permissions.includes("VIEW_MONEY");

    if (role === "TEACHER" && !assignedCategoryId) {
      return NextResponse.json({ events: [], total: 0 });
    }

    // "from" = the viewer's local today (YYYY-MM-DD), so an event later
    // today still counts as upcoming; falls back to server today.
    const fromParam = req.nextUrl.searchParams.get("from");
    const from = fromParam && !Number.isNaN(new Date(fromParam).getTime()) ? new Date(fromParam) : new Date();
    if (!fromParam) from.setHours(0, 0, 0, 0);

    const where: Prisma.EventWhereInput = {
      organizationId,
      eventDate: { gte: from },
      ...(role === "TEACHER" && assignedCategoryId
        ? { categories: { some: { categoryId: assignedCategoryId } } }
        : {}),
    };

    const [total, events] = await Promise.all([
      db.event.count({ where }),
      db.event.findMany({
        where,
        orderBy: { eventDate: "asc" },
        take: 10,
        include: { categories: { include: { category: { select: { name: true } } } } },
      }),
    ]);

    return NextResponse.json({
      total,
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        eventDate: e.eventDate.toISOString(),
        classes: e.categories.map((ec) => ec.category.name),
        // Whether it has a fee at all isn't a money figure, so it's fine to
        // show to everyone; the actual amountCents stays VIEW_MONEY-gated.
        isPaid: e.amountCents !== null,
        ...(canSeeMoney ? { amountCents: e.amountCents } : {}),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
