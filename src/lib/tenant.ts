import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { hasActiveAccess } from "@/lib/billing/access";

export class TenantAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * The ONE function allowed to answer "is this request allowed to touch
 * this organization's data, and with what role". Every API route that
 * reads or writes organization-scoped data (children, payments, statements,
 * settings, invites, ...) must call this first and use the returned
 * organizationId in its Prisma queries — never trust an organizationId
 * passed in a request body/query string on its own.
 *
 * This is what actually prevents School A's staff from ever being able to
 * read or modify School B's data, which is the single most important
 * property this app has to hold given it stores other people's financial
 * and children's personal information.
 */
export async function requireMembership(
  organizationId: string,
  allowedRoles?: Role[],
  options?: {
    // Only the billing checkout/portal routes should ever pass this — an
    // organization whose trial/subscription has lapsed still needs to be
    // able to reach the billing page to pay. Every other route stays locked out,
    // which is what actually enforces "no subscription, no access" rather
    // than that being a UI-only suggestion.
    skipAccessCheck?: boolean;
  }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new TenantAccessError("Not signed in.", 401);
  }

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    // Deliberately the same error/shape as "role not allowed" below —
    // never reveal whether an organizationId exists to a non-member.
    throw new TenantAccessError("Not found.", 404);
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new TenantAccessError("Not allowed for your role.", 403);
  }

  if (!options?.skipAccessCheck) {
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionStatus: true, trialEndsAt: true },
    });
    if (organization && !hasActiveAccess(organization)) {
      throw new TenantAccessError(
        "This school's trial has ended. An admin needs to subscribe to continue.",
        402
      );
    }
  }

  return { userId, role: membership.role };
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new TenantAccessError("Not signed in.", 401);
  }
  return session.user.id;
}
