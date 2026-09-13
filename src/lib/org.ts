import { db } from "@/lib/db";

/**
 * A user can technically belong to more than one school (Membership is
 * many-to-many), but the UI doesn't yet have an organization switcher.
 * Until Phase 5 adds one, every signed-in user is treated as working in
 * their oldest (first-created) membership. This is a UI convenience only —
 * it does NOT replace the per-request `requireMembership` check in
 * src/lib/tenant.ts, which still verifies the specific organizationId in
 * every API call.
 */
export async function getPrimaryMembership(userId: string) {
  return db.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
}
