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
    // Events are billing: every figure here is money, so VIEW_MONEY is
    // required (final inspection R2). Centre Management uses the money-free
    // events/upcoming route instead.
    await requireMembership(organizationId, "VIEW_MONEY");

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
      const entries = e.paymentType?.planEntries ?? [];
      const totalDueCents = entries.reduce((sum, en) => sum + en.amountDueCents, 0);
      const totalPaidCents = entries.reduce((sum, en) => sum + en.amountPaidCents, 0);
      return {
        id: e.id,
        name: e.name,
        eventDate: e.eventDate,
        isPaid: e.amountCents !== null,
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
    // Creating an event (free or paid) needs MANAGE_EVENTS. A *paid* one
    // additionally needs VIEW_MONEY -- entering an amount is money, even
    // when the form it came from is Centre Management's.
    const { userId, permissions } = await requireMembership(organizationId, "MANAGE_EVENTS");

    const body = eventSchema.parse(await req.json());
    if (body.isPaid && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json(
        { error: "You don't have permission to create a paid event." },
        { status: 403 }
      );
    }

    const categories = await db.category.findMany({
      where: { id: { in: body.categoryIds }, organizationId, archived: false },
    });
    if (categories.length !== body.categoryIds.length) {
      return NextResponse.json(
        { error: "One or more selected classes were not found." },
        { status: 400 }
      );
    }

    const result = await db.$transaction((tx) =>
      createEventWithCharges(tx, organizationId, userId, {
        name: body.name,
        date: body.date,
        amountCents: body.isPaid ? (body.amountCents ?? null) : null,
        categoryIds: body.categoryIds,
      })
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
