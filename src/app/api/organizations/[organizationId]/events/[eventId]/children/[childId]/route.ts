import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = {
  params: Promise<{ organizationId: string; eventId: string; childId: string }>;
};

// Removing a child from an event = deleting their generated
// FinancialPlanEntry, matching spec section 9 ("the admin can remove
// individual children from the event — their entry is deleted"). Blocked
// once any money has actually been put toward that entry: deleting a row
// with a PaymentAllocation pointing at it would silently orphan that
// allocation and corrupt the payment's own history — a receipt must never
// be able to reference a charge that no longer exists.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, eventId, childId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_EVENTS");

    const event = await db.event.findFirst({ where: { id: eventId, organizationId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    // A free event has no PaymentType at all, so nothing was ever charged --
    // there's no entry to remove.
    if (!event.paymentTypeId) {
      return NextResponse.json(
        { error: "That child is not part of this event." },
        { status: 404 }
      );
    }

    const entry = await db.financialPlanEntry.findFirst({
      where: { organizationId, childId, paymentTypeId: event.paymentTypeId },
      include: { allocations: true },
    });
    if (!entry) {
      return NextResponse.json(
        { error: "That child is not part of this event." },
        { status: 404 }
      );
    }

    if (entry.amountPaidCents > 0 || entry.allocations.length > 0) {
      return NextResponse.json(
        {
          error:
            "This child has already paid something toward this event, so their charge can't just be removed — record a refund/adjustment instead if they're no longer attending.",
        },
        { status: 409 }
      );
    }

    await db.financialPlanEntry.delete({ where: { id: entry.id } });

    await logAudit({
      organizationId,
      userId,
      action: "event.childRemoved",
      entityType: "Event",
      entityId: event.id,
      metadata: { eventName: event.name, childId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
