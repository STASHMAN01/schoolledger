import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { publicUploadSchema, stagePendingUpload } from "@/lib/publicDocuments";

type Params = { params: Promise<{ token: string }> };

// A NEW family uploads one document while filling in the school's apply
// form. It waits (PENDING) with no child until staff approve the
// application; uploads never submitted are deleted after 2 days.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { allowed: ipAllowed } = await rateLimit(`apply-school-doc-ip:${clientIp(req.headers)}`, {
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }
    const { token } = await params;
    const org = await db.organization.findUnique({
      where: { applyTokenHash: hashInviteToken(token) },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: "This link is invalid or no longer in use." }, { status: 404 });
    }
    const { allowed: orgAllowed } = await rateLimit(`apply-school-doc-org:${org.id}`, {
      limit: 150,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!orgAllowed) {
      return NextResponse.json({ error: "Too many uploads today. Try again tomorrow." }, { status: 429 });
    }
    const body = publicUploadSchema.parse(await req.json());
    if (!body.uploadKey) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const doc = await stagePendingUpload(org.id, body);
    if (!doc) return NextResponse.json({ error: "Too many uploads on this form." }, { status: 429 });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
