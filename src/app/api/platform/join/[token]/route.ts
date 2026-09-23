import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";

type Params = { params: Promise<{ token: string }> };

// Public (no session required) for the same reason as /api/invites/[token]:
// the token itself, compared only by its hash, is what proves the request
// is legitimate — see src/middleware.ts PUBLIC_PATHS.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    // Public token endpoints are rate-limited per IP (final inspection R9).
    const { allowed } = rateLimit(`platform-join-check:${clientIp(_req.headers)}`, { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const { token } = await params;
    const tokenHash = hashInviteToken(token);

    const invite = await db.platformInvite.findUnique({ where: { tokenHash } });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 404 });
    }

    const existingUser = await db.user.findUnique({ where: { email: invite.email } });

    return NextResponse.json({
      email: invite.email,
      requiresNewAccount: !existingUser,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
