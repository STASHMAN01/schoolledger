import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { redactMoneyMetadata } from "@/lib/auditLabel";

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
    const { permissions } = await requireMembership(organizationId, "VIEW_ACTIVITY_LOG");
    const canViewMoney = permissions.includes("VIEW_MONEY");

    const cursor = req.nextUrl.searchParams.get("cursor");
    // "since" (ISO datetime) powers the dashboard's recent-activity card
    // switching between "last 5", "this month", and "lifetime" — the
    // month/lifetime views need more than the dashboard's own cheap
    // 20-row fetch can guarantee, so they call this endpoint instead.
    const since = req.nextUrl.searchParams.get("since");
    // "userId" is the Activity log page's "sort by user" filter — any
    // member, so an accountant can be filtered same as an admin.
    const userId = req.nextUrl.searchParams.get("userId");
    // "entityTypes" (comma-separated) is how the Accounting and Centre
    // Management activity feeds each show only their own mode's entries
    // (Phase 1 restructure) -- see src/lib/activityArea.ts for the two
    // lists. Omit it to get everything (used nowhere in the UI right now,
    // kept for API flexibility / debugging).
    const entityTypesParam = req.nextUrl.searchParams.get("entityTypes");
    const entityTypes = entityTypesParam
      ? entityTypesParam.split(",").filter(Boolean)
      : null;

    const entries = await db.auditLog.findMany({
      where: {
        organizationId,
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        ...(userId ? { userId } : {}),
        ...(entityTypes ? { entityType: { in: entityTypes } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const hasMore = entries.length > PAGE_SIZE;
    const page = hasMore ? entries.slice(0, PAGE_SIZE) : entries;

    // Only worth fetching the member list on a fresh (non-paginated,
    // unfiltered) request — it's just for populating the "sort by user"
    // dropdown, which only needs to be built once.
    const members =
      !cursor && !userId
        ? await db.membership.findMany({
            where: { organizationId },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          })
        : null;

    return NextResponse.json({
      entries: page.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        // Amounts only for VIEW_MONEY (final inspection R2).
        metadata: canViewMoney ? e.metadata : redactMoneyMetadata(e).metadata,
        createdAt: e.createdAt.toISOString(),
        actor: e.user ? { name: e.user.name, email: e.user.email } : null,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      ...(members ? { members: members.map((m) => ({ id: m.user.id, name: m.user.name })) } : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
