import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";

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
        isPaid: event.amountCents !== null,
        amountCents: event.amountCents,
        paymentTypeId: event.paymentTypeId,
        categories: event.categories.map((c) => c.category),
        entries: event.paymentType?.planEntries ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, eventId } = await params;
    // Deleting an event needs MANAGE_EVENTS, same as creating one. A paid
    // event additionally needs VIEW_MONEY to delete -- it's a billing
    // object, same reasoning as POST.
    const { userId, permissions } = await requireMembership(organizationId, "MANAGE_EVENTS");

    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
      include: {
        paymentType: {
          include: { planEntries: { select: { id: true, amountPaidCents: true } } },
        },
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (event.paymentTypeId && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json(
        { error: "You don't have permission to delete a paid event." },
        { status: 403 }
      );
    }

    // Never silently erase a charge someone has already paid against --
    // same principle as FinancialPlanEntry's Restrict-not-Cascade (final
    // inspection R7/R13). If any child has paid anything toward this
    // event, refuse: the admin needs to sort out the money first (refund,
    // reallocate) before the event record can go away.
    const entries = event.paymentType?.planEntries ?? [];
    const hasPayments = entries.some((e) => e.amountPaidCents > 0);
    if (hasPayments) {
      return NextResponse.json(
        {
          error:
            "This event has payments recorded against it, so it can't be deleted. Remove or reallocate those payments first.",
        },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      if (event.paymentTypeId) {
        // No payments exist (checked above), so these plan entries carry
        // no money -- safe to clear before removing the PaymentType itself.
        await tx.financialPlanEntry.deleteMany({ where: { paymentTypeId: event.paymentTypeId } });
        await tx.event.delete({ where: { id: eventId } });
        await tx.paymentType.delete({ where: { id: event.paymentTypeId } });
      } else {
        await tx.event.delete({ where: { id: eventId } });
      }
    });

    await logAudit({
      organizationId,
      userId,
      action: "event.deleted",
      entityType: "Event",
      entityId: eventId,
      metadata: { name: event.name, wasPaid: event.paymentTypeId !== null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
