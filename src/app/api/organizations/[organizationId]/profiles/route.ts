import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { hashPassword, isPasswordBreached, BREACHED_PASSWORD_MESSAGE } from "@/lib/password";
import {
  MAX_PROFILES_PER_ORG,
  candidateUsernames,
  createProfileSchema,
} from "@/lib/profiles";

type Params = { params: Promise<{ organizationId: string }> };

class ProfileError extends Error {}

// Create a class profile: a login for a classroom tablet with no email
// (Dylan, 4 Oct 2026). Same gate as inviting someone (MANAGE_TEAM). The
// profile is always a TEACHER of the chosen class, and getEffectivePermissions
// strips the sensitive permissions from it on every request.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_TEAM");

    const parsed = createProfileSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const [organization, category] = await Promise.all([
      db.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      db.category.findFirst({
        where: { id: body.categoryId, organizationId, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    if (!organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (!category) {
      return NextResponse.json({ error: "Class not found." }, { status: 400 });
    }

    const candidates = candidateUsernames(organization.name, body.name);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "Use at least one letter or number in the profile name." },
        { status: 400 }
      );
    }

    if (await isPasswordBreached(body.password)) {
      return NextResponse.json({ error: BREACHED_PASSWORD_MESSAGE }, { status: 400 });
    }
    const passwordHash = await hashPassword(body.password);

    let created: { membershipId: string; username: string };
    try {
      // Serializable so two admins creating profiles at once can't both
      // squeeze past the 10-profile limit.
      created = await db.$transaction(
        async (tx) => {
          const count = await tx.membership.count({
            where: { organizationId, user: { isProfile: true } },
          });
          if (count >= MAX_PROFILES_PER_ORG) {
            throw new ProfileError(
              `A school can have up to ${MAX_PROFILES_PER_ORG} profiles. Remove one first.`
            );
          }

          const taken = await tx.user.findMany({
            where: { username: { in: candidates } },
            select: { username: true },
          });
          const takenSet = new Set(taken.map((t) => t.username));
          const username = candidates.find((c) => !takenSet.has(c));
          if (!username) {
            throw new ProfileError(
              "That profile name is already in use. Pick a different name."
            );
          }

          const user = await tx.user.create({
            data: {
              email: null,
              username,
              isProfile: true,
              name: body.name,
              passwordHash,
              // No inbox to verify; the admin who made it vouches for it.
              emailVerified: new Date(),
            },
          });
          const membership = await tx.membership.create({
            data: {
              userId: user.id,
              organizationId,
              role: "TEACHER",
              assignedCategoryId: category.id,
            },
          });
          return { membershipId: membership.id, username };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err) {
      if (err instanceof ProfileError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2034")) {
        return NextResponse.json(
          { error: "Someone else just changed the profiles. Try again." },
          { status: 409 }
        );
      }
      throw err;
    }

    await logAudit({
      organizationId,
      userId,
      action: "profile.created",
      entityType: "Membership",
      entityId: created.membershipId,
      metadata: { profileName: body.name, username: created.username, className: category.name },
    });

    return NextResponse.json(
      { profile: { membershipId: created.membershipId, username: created.username, name: body.name } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
