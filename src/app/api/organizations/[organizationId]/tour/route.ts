import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Marks the caller's own first-time walkthrough as seen for one mode, so it
// doesn't auto-open again. Any member can call this for their own
// membership -- no permission gate, this is a UI preference, not data.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId);
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode;
    if (mode !== "centre" && mode !== "accounting") {
      return NextResponse.json({ error: "mode must be 'centre' or 'accounting'." }, { status: 400 });
    }

    await db.membership.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: mode === "centre" ? { centreTourSeenAt: new Date() } : { accountingTourSeenAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
