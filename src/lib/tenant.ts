import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Permission } from "@prisma/client";
import { hasActiveAccess } from "@/lib/billing/access";
import { REQUEST_METHOD_HEADER, REQUEST_PATH_HEADER } from "@/lib/requestMethod";
import { teacherMayCall } from "@/lib/teacherAccess";
import { getEffectivePermissions } from "@/lib/permissions";

export class TenantAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * The ONE function allowed to answer "is this request allowed to touch
 * this organization's data, and with what permissions". Every API route
 * that reads or writes organization-scoped data (children, payments,
 * statements, settings, invites, ...) must call this first and use the
 * returned organizationId in its Prisma queries — never trust an
 * organizationId passed in a request body/query string on its own.
 *
 * This is what actually prevents School A's staff from ever being able to
 * read or modify School B's data, which is the single most important
 * property this app has to hold given it stores other people's financial
 * and children's personal information.
 *
 * `requiredPermission` (optional) is a specific Permission (see
 * src/lib/permissions.ts) the caller must have, resolved from their role's
 * default plus any per-membership overrides an admin has set for them —
 * never a hardcoded role list. Omit it for an endpoint any member of the
 * organization may reach regardless of role (e.g. most GET endpoints that
 * don't expose money).
 */
export async function requireMembership(
  organizationId: string,
  requiredPermission?: Permission,
  options?: {
    // Only the billing checkout/portal routes should ever pass this — an
    // organization whose trial/subscription has lapsed still needs to be
    // able to reach the billing page to pay. Every other route stays locked out,
    // which is what actually enforces "no subscription, no access" rather
    // than that being a UI-only suggestion.
    skipAccessCheck?: boolean;
    // Only the restore route passes this: a school in the 30-day trash is
    // otherwise completely locked, for every member.
    allowDeletedOrganization?: boolean;
    // For the few non-GET routes that only READ (export a backup, reveal a
    // masked ID number, mark the tour seen): allowed even while the school
    // is read-only because its subscription/trial has ended.
    allowWhenReadOnly?: boolean;
  }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new TenantAccessError("Not signed in.", 401);
  }

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { permissionOverrides: true, user: { select: { emailVerified: true, isProfile: true } } },
  });

  if (!membership) {
    // Deliberately the same error/shape as "permission not allowed" below —
    // never reveal whether an organizationId exists to a non-member.
    throw new TenantAccessError("Not found.", 404);
  }

  // A class profile (shared classroom tablet) is only ever a TEACHER and
  // never gets the sensitive permissions, enforced here on every request
  // so no stale override row or role edit can widen it.
  if (membership.user.isProfile && membership.role !== "TEACHER") {
    throw new TenantAccessError("Not allowed for your role.", 403);
  }
  const permissions = getEffectivePermissions(membership.role, membership.permissionOverrides, {
    isProfile: membership.user.isProfile,
  });

  if (!options?.allowDeletedOrganization) {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { deletedAt: true },
    });
    if (org?.deletedAt) {
      throw new TenantAccessError(
        "This school has been deleted. An admin can restore it within 30 days.",
        403
      );
    }
  }

  // Defense in depth for the same gate the /dashboard layout enforces in
  // the UI (VerifyEmailGate): belt-and-suspenders against any request that
  // reaches an API route directly (a stale tab, a script) while this
  // account still hasn't clicked its verification link.
  if (!membership.user.emailVerified) {
    throw new TenantAccessError("Please verify your email before continuing.", 403);
  }

  // Teachers (Dylan, 4 Oct 2026) may only make the API calls on the list in
  // src/lib/teacherAccess.ts. Default-deny: anything new is closed to them
  // until it's added there. Path and method come from middleware; if
  // either is missing, refuse.
  if (membership.role === "TEACHER") {
    const h = await headers();
    const method = h.get(REQUEST_METHOD_HEADER);
    const path = h.get(REQUEST_PATH_HEADER);
    if (!method || !path || !teacherMayCall(method, path)) {
      throw new TenantAccessError("Not allowed for your role.", 403);
    }
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw new TenantAccessError("Not allowed for your role.", 403);
  }

  if (!options?.skipAccessCheck && !options?.allowWhenReadOnly) {
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
    });
    // No trial/paid days left = READ-ONLY, not locked out (Dylan, 28 Sept
    // 2026): reads still work, anything that changes data is refused.
    // The method comes from a header src/middleware.ts sets on every
    // request (overwriting anything the client sent). If it's missing we
    // treat the request as a write -- fail closed.
    if (organization && !hasActiveAccess(organization)) {
      const method = ((await headers()).get(REQUEST_METHOD_HEADER) ?? "").toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        throw new TenantAccessError(
          "This school is read-only because its subscription has ended. An admin can resubscribe under Settings → Billing.",
          402
        );
      }
    }
  }

  return {
    userId,
    role: membership.role,
    permissions,
    assignedCategoryId: membership.assignedCategoryId,
  };
}

