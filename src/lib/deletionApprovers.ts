import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getEffectivePermissions } from "@/lib/permissions";
import { requiredApprovalsFor } from "@/lib/deletion";

// Server-only companion to requiredApprovalsFor() in deletion.ts. It lives
// in its own module rather than in deletion.ts because that file is
// imported by DeletionControl, a client component -- pulling the Prisma
// client in there would drag the database into the browser bundle.

type Client = Prisma.TransactionClient | typeof db;

/**
 * How many people in this school can approve a deletion right now.
 *
 * Counts effective permissions rather than the ADMIN role, because
 * APPROVE_DELETION can be granted to a non-admin per person (see
 * src/lib/permissions.ts) -- a school whose owner has given a second
 * person that permission genuinely does have two approvers, and should
 * still get the two-person check.
 */
export async function countDeletionApprovers(
  client: Client,
  organizationId: string
): Promise<number> {
  const members = await client.membership.findMany({
    where: { organizationId },
    select: {
      role: true,
      permissionOverrides: { select: { permission: true, granted: true } },
      user: { select: { isProfile: true } },
    },
  });

  return members.filter((m) =>
    getEffectivePermissions(m.role, m.permissionOverrides, { isProfile: m.user.isProfile }).includes("APPROVE_DELETION")
  ).length;
}

/** The approvals this school's next deletion will actually need. */
export async function requiredApprovalsForOrg(
  client: Client,
  organizationId: string
): Promise<number> {
  return requiredApprovalsFor(await countDeletionApprovers(client, organizationId));
}
