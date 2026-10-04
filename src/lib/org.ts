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
  // Prefer the oldest school that ISN'T in the 30-day trash (deletedAt),
  // so someone who also belongs to another school lands there. Only when
  // every school they belong to is deleted do they get the deleted one
  // back (the dashboard then shows the "scheduled for deletion" screen).
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      organization: true,
      permissionOverrides: true,
      user: { select: { isProfile: true } },
    },
  });
  return memberships.find((m) => !m.organization.deletedAt) ?? memberships[0] ?? null;
}
