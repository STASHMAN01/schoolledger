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
    const { userId } = await requireMembership(organizationId, "MANAGE_TEAM");

    const body = bodySchema.parse(await req.json());

    const existing = await db.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: { select: { name: true, email: true } }, permissionOverrides: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const nextRole: Role = body.role ?? existing.role;

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
        memberEmail: existing.user.email,
        previousRole: existing.role,
        newRole: nextRole,
      },
    });

    return NextResponse.json({
      member: {
        membershipId: result.updated.id,
        role: result.updated.role,
        assignedCategoryId: result.updated.assignedCategoryId,
        permissions: getEffectivePermissions(result.updated.role, result.overrides),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
