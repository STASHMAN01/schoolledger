import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TenantAccessError } from "@/lib/tenant";

// Comma-separated allowlist of emails that always count as the platform
// owner, e.g. PLATFORM_ADMIN_EMAILS="dylanmaps3@gmail.com". This exists so
// the very first platform admin can reach /platform with nothing more than
// an env var — no manual database edit needed on a fresh deploy. Anyone
// invited later via /platform/team is instead granted access through the
// isPlatformAdmin column on User (see PlatformInvite in schema.prisma).
function ownerEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string): boolean {
  return ownerEmails().includes(email.toLowerCase());
}

/**
 * The one function allowed to answer "is this request allowed to see
 * cross-tenant platform data (subscriber counts, revenue, which countries
 * schools are in, ...)". Deliberately separate from requireMembership —
 * platform admin has nothing to do with any one organization's Role, and
 * must never be checked by anything that also handles school data, so the
 * two privilege systems can't accidentally get confused for one another.
 */
export async function requirePlatformAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new TenantAccessError("Not signed in.", 401);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  });
  if (!user) {
    throw new TenantAccessError("Not signed in.", 401);
  }

  if (!user.isPlatformAdmin && !isOwnerEmail(user.email)) {
    // Same 404-shaped response style as requireMembership — don't hint to
    // a regular user that a /platform area exists at all.
    throw new TenantAccessError("Not found.", 404);
  }

  return { userId: user.id, email: user.email, name: user.name };
}

/**
 * Non-throwing check for UI use (e.g. "show a Platform link in the
 * dashboard header if this signed-in user happens to also be a platform
 * admin"). Returns false for a signed-out user rather than throwing.
 */
export async function checkIsPlatformAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isPlatformAdmin: true },
  });
  if (!user) return false;
  return user.isPlatformAdmin || isOwnerEmail(user.email);
}
