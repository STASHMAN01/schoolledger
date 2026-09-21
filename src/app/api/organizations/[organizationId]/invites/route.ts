import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { createInviteSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateInviteToken } from "@/lib/inviteToken";
import { getEffectivePermissions } from "@/lib/permissions";

type Params = { params: Promise<{ organizationId: string }> };

const INVITE_EXPIRY_DAYS = 7;

// Inviting is ADMIN-only — the only way anyone else ever joins an
// organization, per the original spec ("only the admin can add/invite
// other people and assign them roles").
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "MANAGE_TEAM");

    const [invites, members] = await Promise.all([
      db.invite.findMany({
        where: { organizationId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
      db.membership.findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          permissionOverrides: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return NextResponse.json({
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
      members: members.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        assignedCategoryId: m.assignedCategoryId,
        permissions: getEffectivePermissions(m.role, m.permissionOverrides),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_TEAM");

    const body = createInviteSchema.parse(await req.json());

    const existingMember = await db.membership.findFirst({
      where: { organizationId, user: { email: body.email } },
    });
    if (existingMember) {
      return NextResponse.json(
        { error: "That email is already part of this school." },
        { status: 400 }
      );
    }

    const { token, tokenHash } = generateInviteToken();

    const invite = await db.invite.create({
      data: {
        organizationId,
        email: body.email,
        role: body.role,
        tokenHash,
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "invite.created",
      entityType: "Invite",
      entityId: invite.id,
      metadata: { email: body.email, role: body.role },
    });

    // The raw token is returned exactly once, here — it is never stored
    // (only its hash is) and never retrievable again after this response.
    // No email-sending is wired up yet (see PHASES.md): the admin copies
    // this link and sends it themselves.
    return NextResponse.json(
      { invite: { id: invite.id, email: invite.email, role: invite.role }, token },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
