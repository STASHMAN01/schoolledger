import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acceptPlatformInviteSchema } from "@/lib/validation";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { hashInviteToken } from "@/lib/inviteToken";
import { handleApiError } from "@/lib/apiError";

// Public route, same shape as /api/invites/accept: either a session already
// signed in as the invited email, or a brand-new password set right here.
// There is no path that grants isPlatformAdmin to an email the caller
// doesn't control.
export async function POST(req: NextRequest) {
  try {
    const body = acceptPlatformInviteSchema.parse(await req.json());
    const tokenHash = hashInviteToken(body.token);

    const invite = await db.platformInvite.findUnique({ where: { tokenHash } });
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
        await tx.user.update({ where: { id: signedInUser.id }, data: { isPlatformAdmin: true } });
        await tx.platformInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      });

      return NextResponse.json({ requiresSignIn: false });
    }

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
      return NextResponse.json({ error: "Name and password are required." }, { status: 400 });
    }
    if (!isPasswordStrongEnough(body.password)) {
      return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
    }

    const passwordHash = await hashPassword(body.password);

    const newUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: invite.email, passwordHash, name: body.name!, isPlatformAdmin: true },
      });
      await tx.platformInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      return user;
    });

    return NextResponse.json({ requiresSignIn: true, email: newUser.email });
  } catch (err) {
    return handleApiError(err);
  }
}
