import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, getEffectivePermissions } from "@/lib/permissions";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ organizationId: string; membershipId: string }> };

const ROLES = ["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER", "TEACHER", "RECEPTIONIST"] as const;

const bodySchema = z.object({
  role: z.enum(ROLES).optional(),
  // The full desired effective permission set for this member (not just
  // the deltas) — the server diffs it against the role's defaults and
  // only persists the rows that actually differ. Omit to leave
  // permissions untouched (e.g. a role-only or class-only change).
  effectivePermissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
  // TEACHER's one assigned class ("own class only"). Explicit null
  // clears it. Ignored (cleared) for any role other than TEACHER.
  assignedCategoryId: z.string().nullable().optional(),
});

// Change one member's role, their individual permission overrides, and/or
// their assigned class — the "easy to change staff/managers/accountants,
// easy to revoke" mechanism from Settings -> Team. Every field is
// optional so the UI can send just what actually changed.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, membershipId } = await params;
    const { userId, role: callerRole, permissions: callerPermissions } = await requireMembership(organizationId, "MANAGE_TEAM");

    const body = bodySchema.parse(await req.json());

    const existing = await db.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: { select: { name: true, email: true, username: true, isProfile: true } }, permissionOverrides: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const nextRole: Role = body.role ?? existing.role;

    // Privilege rules (security review #16, 7 Oct 2026). MANAGE_TEAM can be
    // given to a non-admin, and before this nothing stopped that person
    // making themselves (or a friend) an Admin, or demoting the owner.
    if (existing.userId === userId) {
      return NextResponse.json(
        { error: "You can't change your own role or permissions. Ask another admin." },
        { status: 403 }
      );
    }
    if (callerRole !== "ADMIN") {
      if (existing.role === "ADMIN" || nextRole === "ADMIN") {
        return NextResponse.json({ error: "Only an admin can make or change an admin." }, { status: 403 });
      }
      // A non-admin can only hand out permissions they hold themselves,
      // whether through the role's defaults or an explicit list.
      const granting = body.effectivePermissions ?? ROLE_DEFAULT_PERMISSIONS[nextRole];
      const changesAccess = body.role !== undefined || body.effectivePermissions !== undefined;
      if (changesAccess && granting.some((p) => !callerPermissions.includes(p))) {
        return NextResponse.json(
          { error: "You can only give permissions that you have yourself." },
          { status: 403 }
        );
      }
    }
    if (existing.role === "ADMIN" && nextRole !== "ADMIN") {
      const otherAdmins = await db.membership.count({
        where: { organizationId, role: "ADMIN", id: { not: existing.id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "A school needs at least one admin. Make someone else an admin first." },
          { status: 400 }
        );
      }
    }

    // A class profile (shared tablet) is only ever a Teacher. Its sensitive
    // permissions are stripped on every request anyway (see
    // getEffectivePermissions), but refuse the change outright so the Team
    // page never shows an admin something that won't take effect.
    if (existing.user.isProfile && nextRole !== "TEACHER") {
      return NextResponse.json(
        { error: "A class profile can only be a Teacher." },
        { status: 400 }
      );
    }

    let nextAssignedCategoryId: string | null | undefined = undefined;
    if (nextRole !== "TEACHER") {
      // Only meaningful for TEACHER — clear it for every other role,
      // including when a role change moves someone off TEACHER.
      nextAssignedCategoryId = null;
    } else if (body.assignedCategoryId !== undefined) {
      if (body.assignedCategoryId) {
        const category = await db.category.findFirst({
          where: { id: body.assignedCategoryId, organizationId, deletedAt: null },
        });
        if (!category) {
          return NextResponse.json({ error: "Class not found." }, { status: 400 });
        }
      }
      nextAssignedCategoryId = body.assignedCategoryId;
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: {
          role: nextRole,
          ...(nextAssignedCategoryId !== undefined ? { assignedCategoryId: nextAssignedCategoryId } : {}),
        },
      });

      // ADMIN always has every permission, not stored as rows — drop any
      // leftover overrides if someone is promoted to ADMIN.
      if (nextRole === "ADMIN") {
        await tx.membershipPermission.deleteMany({ where: { membershipId } });
      } else if (body.effectivePermissions) {
        const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[nextRole]);
        const desired = new Set(body.effectivePermissions);
        await tx.membershipPermission.deleteMany({ where: { membershipId } });
        const rows = ALL_PERMISSIONS.filter((p) => desired.has(p) !== defaults.has(p)).map((p) => ({
          membershipId,
          permission: p,
          granted: desired.has(p),
        }));
        if (rows.length > 0) {
          await tx.membershipPermission.createMany({ data: rows });
        }
      } else if (body.role) {
        // Role changed but no explicit permission list was sent — drop
        // whatever overrides existed for the OLD role rather than silently
        // carrying them onto the new one (a stale override could grant or
        // deny something that makes no sense for the new role).
        await tx.membershipPermission.deleteMany({ where: { membershipId } });
      }

      const overrides = await tx.membershipPermission.findMany({ where: { membershipId } });
      return { updated, overrides };
    });

    await logAudit({
      organizationId,
      userId,
      action: "membership.updated",
      entityType: "Membership",
      entityId: membershipId,
      metadata: {
        memberName: existing.user.name,
        memberEmail: existing.user.email ?? existing.user.username,
        previousRole: existing.role,
        newRole: nextRole,
      },
    });

    return NextResponse.json({
      member: {
        membershipId: result.updated.id,
        role: result.updated.role,
        assignedCategoryId: result.updated.assignedCategoryId,
        permissions: getEffectivePermissions(result.updated.role, result.overrides, {
          isProfile: existing.user.isProfile,
        }),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
