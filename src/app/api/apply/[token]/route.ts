import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken as hashFormToken } from "@/lib/inviteToken";
import { rateLimit } from "@/lib/rateLimit";
import { parentSubmissionSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ token: string }> };

// Public (no session required, same reasoning as GET /api/invites/[token]
// and GET /api/auth/reset-password/[token]): the token itself is the
// proof. A missing/expired/already-submitted token all return the same
// generic 404 so a wrong guess learns nothing. Returns only the minimum
// needed to render the form -- never any of the child's existing profile
// data, since this link may be sitting unopened in an email inbox.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = rateLimit(`apply-check:${ip}`, { limit: 30, windowMs: 60 * 60 * 1000 });
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const { token } = await params;
    const tokenHash = hashFormToken(token);

    const link = await db.parentFormLink.findUnique({
      where: { tokenHash },
      include: { child: { select: { firstName: true } }, organization: { select: { name: true } } },
    });

    if (!link || link.submittedAt || link.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This link is invalid, has expired, or has already been used." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      childFirstName: link.child.firstName,
      organizationName: link.organization.name,
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Public submission endpoint. Rate-limited on two axes (per-IP so one
// client can't hammer arbitrary tokens; per-token so even a correctly
// guessed/leaked token can't be resubmitted in a burst) the same way
// forgot-password rate-limits per-IP and per-email. Writes only a
// ParentSubmission (+ attachments) -- never touches Child/Guardian, see
// the ParentSubmission model comment for why.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed: ipAllowed } = rateLimit(`apply-submit-ip:${ip}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const { token } = await params;
    const tokenHash = hashFormToken(token);

    const { allowed: tokenAllowed } = rateLimit(`apply-submit-token:${tokenHash}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!tokenAllowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const link = await db.parentFormLink.findUnique({ where: { tokenHash } });
    if (!link || link.submittedAt || link.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This link is invalid, has expired, or has already been used." },
        { status: 404 }
      );
    }

    const body = parentSubmissionSchema.parse(await req.json());

    // Guardian ID-photo attachments must reference a guardian actually
    // present in this same submission -- reject anything else rather
    // than silently dropping it.
    for (const a of body.attachments ?? []) {
      if (a.kind === "GUARDIAN_ID") {
        if (a.guardianIndex === undefined || !body.guardians[a.guardianIndex]) {
          return NextResponse.json({ error: "Invalid input." }, { status: 400 });
        }
      }
    }

    await db.$transaction(async (tx) => {
      const submission = await tx.parentSubmission.create({
        data: {
          linkId: link.id,
          organizationId: link.organizationId,
          data: JSON.stringify({ child: body.child, guardians: body.guardians }),
        },
      });

      if (body.attachments?.length) {
        await tx.parentSubmissionAttachment.createMany({
          data: body.attachments.map((a) => ({
            submissionId: submission.id,
            kind: a.kind,
            label: a.label,
            image: a.image,
          })),
        });
      }

      await tx.parentFormLink.update({
        where: { id: link.id },
        data: { submittedAt: new Date() },
      });
    });

    await logAudit({
      organizationId: link.organizationId,
      action: "parentSubmission.submitted",
      entityType: "ParentFormLink",
      entityId: link.id,
      metadata: { childId: link.childId },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
