import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { eventSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";
import { createEventWithCharges } from "@/lib/billing/events";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view

    const events = await db.event.findMany({
      where: { organizationId },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
        paymentType: {
          include: {
            planEntries: { select: { amountDueCents: true, amountPaidCents: true, status: true } },
          },
        },
      },
      orderBy: { eventDate: "desc" },
    });

    const summarized = events.map((e) => {
      const entries = e.paymentType.planEntries;
      const totalDueCents = entries.reduce((sum, en) => sum + en.amountDueCents, 0);
      const totalPaidCents = entries.reduce((sum, en) => sum + en.amountPaidCents, 0);
      return {
        id: e.id,
        name: e.name,
        eventDate: e.eventDate,
        amountCents: e.amountCents,
        categories: e.categories.map((c) => c.category),
        childCount: entries.length,
        totalDueCents,
        totalPaidCents,
        totalOutstandingCents: totalDueCents - totalPaidCents,
      };
    });

    return NextResponse.json({ events: summarized });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    // Same role boundary as recording payments/payment types — events move
    // money, so MANAGER (organize-only) is deliberately excluded.
    const { userId } = await requireMembership(organizationId, ["ADMIN", "ACCOUNTANT"]);

    const body = eventSchema.parse(await req.json());

    const categories = await db.category.findMany({
      where: { id: { in: body.categoryIds }, organizationId, archived: false },
    });
    if (categories.length !== body.categoryIds.length) {
      return NextResponse.json(
        { error: "One or more selected categories were not found." },
        { status: 400 }
      );
    }

    const result = await db.$transaction((tx) =>
      createEventWithCharges(tx, organizationId, userId, {
        name: body.name,
        date: body.date,
        amountCents: body.amountCents,
        categoryIds: body.categoryIds,
      })
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
