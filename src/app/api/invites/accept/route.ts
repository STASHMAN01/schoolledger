import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acceptInviteSchema } from "@/lib/validation";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { hashInviteToken } from "@/lib/inviteToken";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

// Public route (no session required to call it) but every path through it
// ends up requiring proof of the invited email: either a session already
// signed in as that exact email, or a brand-new password set right here —
// there is no path that lets someone attach a Membership to an email they
// don't control.
export async function POST(req: NextRequest) {
  try {
    const body = acceptInviteSchema.parse(await req.json());
    const tokenHash = hashInviteToken(body.token);

    const invite = await db.invite.findUnique({ where: { tokenHash } });
    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invite link is invalid or has expired." },
        { status: 400 }
      );
    }

    const session = await auth();

    if (session?.user?.id) {
      const signedInUser = await db.user.findUnique({ where: { id: session.user.id } });
      if (!signedInUser || signedInUser.email.toLowerCase() !== invite.email.toLowerCase()) {
        return NextResponse.json(
          {
            error:
              "You're signed in as a different account. Log out first, then open this invite link again.",
          },
          { status: 400 }
        );
      }

      await db.$transaction(async (tx) => {
        await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId: signedInUser.id,
              organizationId: invite.organizationId,
            },
          },
          create: {
            userId: signedInUser.id,
            organizationId: invite.organizationId,
            role: invite.role,
          },
          update: {},
        });
        await tx.invite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      });

      await logAudit({
        organizationId: invite.organizationId,
        userId: signedInUser.id,
        action: "invite.accepted",
        entityType: "Invite",
        entityId: invite.id,
      });

      return NextResponse.json({ organizationId: invite.organizationId, requiresSignIn: false });
    }

    // No session: this must be a brand-new person setting a password for
    // the first time. If an account with this email already exists, they
    // need to log in with their existing password instead — silently
    // taking over an existing account via an invite link would be a
    // serious account-takeover hole.
    const existingUser = await db.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Log in, then open this invite link again.",
        },
        { status: 400 }
      );
    }

    if (!body.name || !body.password) {
      return NextResponse.json(
        { error: "Name and password are required." },
        { status: 400 }
      );
    }
    if (!isPasswordStrongEnough(body.password)) {
      return NextResponse.json(
        { error: "Password must be at least 10 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(body.password);

    const newUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: invite.email, passwordHash, name: body.name! },
      });
      await tx.membership.create({
        data: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
      });
      await tx.invite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      return user;
    });

    await logAudit({
      organizationId: invite.organizationId,
      userId: newUser.id,
      action: "invite.accepted",
      entityType: "Invite",
      entityId: invite.id,
    });

    return NextResponse.json({
      organizationId: invite.organizationId,
      requiresSignIn: true,
      email: newUser.email,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
