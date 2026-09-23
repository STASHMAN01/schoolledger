import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; eventId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, eventId } = await params;
    // Per-child charges and payments -- money, so VIEW_MONEY (R2).
    await requireMembership(organizationId, "VIEW_MONEY");

    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
        paymentType: {
          include: {
            planEntries: {
              include: {
                child: { select: { id: true, firstName: true, lastName: true, categoryId: true } },
              },
              orderBy: [{ child: { lastName: "asc" } }],
            },
          },
        },
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        eventDate: event.eventDate,
        amountCents: event.amountCents,
        paymentTypeId: event.paymentTypeId,
        categories: event.categories.map((c) => c.category),
        entries: event.paymentType.planEntries,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
