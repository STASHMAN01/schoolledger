import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken } from "@/lib/inviteToken";

type Params = { params: Promise<{ token: string }> };

// Public (no session required, same reasoning as GET /api/invites/[token]):
// the token itself is the proof. A missing/expired/already-used token all
// return the same generic response so a wrong guess learns nothing.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const tokenHash = hashInviteToken(token);

    const resetToken = await db.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired." },
        { status: 404 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    return handleApiError(err);
  }
}
