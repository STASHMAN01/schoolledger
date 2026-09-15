import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin, isOwnerEmail } from "@/lib/platformAdmin";
import { createPlatformInviteSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";
import { generateInviteToken } from "@/lib/inviteToken";

const INVITE_EXPIRY_DAYS = 7;

export async function GET() {
  try {
    await requirePlatformAdmin();

    const [admins, invites] = await Promise.all([
      db.user.findMany({
        where: { isPlatformAdmin: true },
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.platformInvite.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // The env-configured owner(s) may not have isPlatformAdmin=true in the
    // database at all (that flag is only ever set via an accepted
    // PlatformInvite) — surface them in the list too so "who can see this
    // dashboard" is complete, not just "who was explicitly invited".
    const ownerUsers = await db.user.findMany({
      where: { email: { in: (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean) } },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    type AdminRow = { id: string; name: string; email: string; createdAt: Date };
    const byId = new Map<string, AdminRow>(admins.map((a) => [a.id, a]));
    for (const o of ownerUsers) byId.set(o.id, o);

    return NextResponse.json({
      admins: Array.from(byId.values()).map((a) => ({
        ...a,
        isOwner: isOwnerEmail(a.email),
      })),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePlatformAdmin();
    const body = createPlatformInviteSchema.parse(await req.json());

    const existingAdmin = await db.user.findFirst({
      where: { email: body.email, isPlatformAdmin: true },
    });
    if (existingAdmin || isOwnerEmail(body.email)) {
      return NextResponse.json(
        { error: "That email already has platform admin access." },
        { status: 400 }
      );
    }

    const { token, tokenHash } = generateInviteToken();

    const invite = await db.platformInvite.create({
      data: {
        email: body.email,
        tokenHash,
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    // Same pattern as org invites: the raw token is returned exactly once
    // here and never stored — no email-sending wired up, the owner copies
    // and sends this link themselves.
    return NextResponse.json(
      { invite: { id: invite.id, email: invite.email }, token },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
