import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ inviteId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin();
    const { inviteId } = await params;

    await db.platformInvite.updateMany({
      where: { id: inviteId, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
