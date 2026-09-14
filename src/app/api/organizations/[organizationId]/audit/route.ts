import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

const PAGE_SIZE = 30;

// Read-only feed over AuditLog, which the rest of the app already writes to
// via logAudit() on every meaningful mutation (payments, children, invites,
// profile changes, ...). Visible to every member (not just ADMINs) since
// knowing "who did what, when" is useful to an accountant/manager too — it's
// the account-number values themselves that are locked down, not the fact
// that someone changed them.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId);

    const cursor = req.nextUrl.searchParams.get("cursor");

    const entries = await db.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const hasMore = entries.length > PAGE_SIZE;
    const page = hasMore ? entries.slice(0, PAGE_SIZE) : entries;

    return NextResponse.json({
      entries: page.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
        actor: e.user ? { name: e.user.name, email: e.user.email } : null,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
