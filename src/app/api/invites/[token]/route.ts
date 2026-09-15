import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken } from "@/lib/inviteToken";

type Params = { params: Promise<{ token: string }> };

// Deliberately public (no session required) — the whole point of an
// invite link is that the person clicking it hasn't logged in yet. The
// token itself, not a session, is what proves the request is legitimate;
// it's compared only by its hash, and a not-found/expired/used token all
// return the same generic response so a wrong guess learns nothing.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const tokenHash = hashInviteToken(token);

    const invite = await db.invite.findUnique({
      where: { tokenHash },
      include: { organization: { select: { name: true } } },
    });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 404 });
    }

    const existingUser = await db.user.findUnique({ where: { email: invite.email } });

    return NextResponse.json({
      organizationName: invite.organization.name,
      email: invite.email,
      role: invite.role,
      // Tells the accept page whether to show a "set a password" form
      // (brand new person) or just a "log in and accept" prompt (existing
      // TinyLedger user joining a second school).
      requiresNewAccount: !existingUser,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
