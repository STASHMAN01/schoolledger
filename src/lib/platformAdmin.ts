import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TenantAccessError } from "@/lib/tenant";
import { hasPassedStepUp } from "@/lib/platformTwoFactor";

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

export function isOwnerEmail(email: string | null | undefined): boolean {
  // Class profiles have no email, so they are never an owner.
  if (!email) return false;
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
export async function requirePlatformAdmin(options?: {
  // Only the two-factor set-up / verify routes pass this: they are how an
  // admin gets past the check in the first place.
  skipSecondFactor?: boolean;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new TenantAccessError("Not signed in.", 401);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isPlatformAdmin: true,
      isProfile: true,
      emailVerified: true,
      tokenVersion: true,
      totpEnabledAt: true,
    },
  });
  if (!user) {
    throw new TenantAccessError("Not signed in.", 401);
  }

  // Security review #12: the owner-email allowlist must never make an
  // unverified account (someone who merely registered that address) an
  // admin, and a shared class-tablet profile can never be one.
  if (!isPlatformAdminRecord(user)) {
    // Same 404-shaped response style as requireMembership — don't hint to
    // a regular user that a /platform area exists at all.
    throw new TenantAccessError("Not found.", 404);
  }

  // Security review #5: a password alone never opens the platform area.
  if (!options?.skipSecondFactor && !(user.totpEnabledAt && (await hasPassedStepUp(user.id, user.tokenVersion)))) {
    throw new TenantAccessError("Two-factor check needed.", 401);
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    tokenVersion: user.tokenVersion,
    totpEnabled: Boolean(user.totpEnabledAt),
  };
}

/**
 * Non-throwing check for UI use (e.g. "show a Platform link in the
 * dashboard header if this signed-in user happens to also be a platform
 * admin"). Returns false for a signed-out user rather than throwing.
 */
export async function checkIsPlatformAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isPlatformAdmin: true, isProfile: true, emailVerified: true },
  });
  if (!user) return false;
  return isPlatformAdminRecord(user);
}

/** The one rule for "is this user record a platform admin" (pure, tested). */
export function isPlatformAdminRecord(user: {
  email: string | null;
  isPlatformAdmin: boolean;
  isProfile: boolean;
  emailVerified: Date | null;
}): boolean {
  if (user.isProfile || !user.emailVerified) return false;
  return user.isPlatformAdmin || (user.email !== null && isOwnerEmail(user.email));
}
