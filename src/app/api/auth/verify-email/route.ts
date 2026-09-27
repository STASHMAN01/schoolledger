import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyEmailSchema } from "@/lib/validation";
import { hashInviteToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiError";

// Public (no session required, same reasoning as reset-password): the
// token itself is the proof of email ownership. Marks the user verified
// and consumes the token atomically -- same "claim by flipping usedAt
// from null" pattern as POST /api/auth/reset-password, so two simultaneous
// submits of the same link can't both succeed, and a token already used
// once can never verify a second time.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const { allowed } = rateLimit(`verify-email:${ip}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const tokenHash = hashInviteToken(parsed.data.token);

    const verifyToken = await db.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!verifyToken || verifyToken.usedAt || verifyToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired." },
        { status: 400 }
      );
    }

    const claimed = await db.$transaction(async (tx) => {
      const claim = await tx.emailVerificationToken.updateMany({
        where: { id: verifyToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claim.count === 0) return false;
      await tx.user.update({
        where: { id: verifyToken.userId },
        data: { emailVerified: new Date() },
      });
      // Any other still-pending verification tokens for this user (e.g.
      // an earlier email, before a resend) are now moot.
      await tx.emailVerificationToken.updateMany({
        where: { userId: verifyToken.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    });

    if (!claimed) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
