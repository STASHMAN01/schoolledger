import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { newApplicantSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ token: string }> };

// Public (no session): the school's permanent apply link for NEW families
// (fix session B, Dylan 23 Sept). The link is reusable by design, so the
// protection is (a) nothing is created until staff approve it, and (b)
// rate limits per IP and per school. A wrong or replaced token gets the
// same generic 404.

async function findOrg(token: string) {
  return db.organization.findUnique({
    where: { applyTokenHash: hashInviteToken(token) },
    select: { id: true, name: true },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { allowed } = rateLimit(`apply-school-check:${clientIp(req.headers)}`, {
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const { token } = await params;
    const org = await findOrg(token);
    if (!org) {
      return NextResponse.json({ error: "This link is invalid or no longer in use." }, { status: 404 });
    }
    return NextResponse.json({ organizationName: org.name });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { allowed: ipAllowed } = rateLimit(`apply-school-submit-ip:${clientIp(req.headers)}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const { token } = await params;
    const org = await findOrg(token);
    if (!org) {
      return NextResponse.json({ error: "This link is invalid or no longer in use." }, { status: 404 });
    }

    // Caps a runaway/spam burst against one school even across many IPs.
    const { allowed: orgAllowed } = rateLimit(`apply-school-submit-org:${org.id}`, {
      limit: 50,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!orgAllowed) {
      return NextResponse.json({ error: "Too many applications today. Try again tomorrow." }, { status: 429 });
    }

    const body = newApplicantSchema.parse(await req.json());

    for (const a of body.attachments ?? []) {
      if (a.kind === "GUARDIAN_ID" && (a.guardianIndex === undefined || !body.guardians[a.guardianIndex])) {
        return NextResponse.json({ error: "Invalid input." }, { status: 400 });
      }
    }

    const submission = await db.$transaction(async (tx) => {
      const created = await tx.parentSubmission.create({
        data: {
          organizationId: org.id,
          isNewApplicant: true,
          data: JSON.stringify({ child: body.child, guardians: body.guardians }),
        },
      });
      if (body.attachments?.length) {
        await tx.parentSubmissionAttachment.createMany({
          data: body.attachments.map((a) => ({
            submissionId: created.id,
            kind: a.kind,
            label: a.label,
            image: a.image,
          })),
        });
      }
      return created;
    });

    await logAudit({
      organizationId: org.id,
      action: "parentSubmission.newApplicant",
      entityType: "ParentSubmission",
      entityId: submission.id,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
