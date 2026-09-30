import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken as hashFormToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { parentSubmissionSchema } from "@/lib/validation";
import { emergencyContactProblem } from "@/lib/emergencyContact";
import { logAudit } from "@/lib/audit";
import { missingForChild } from "@/lib/childDocuments";
import { documentTypeDef } from "@/lib/documents";
import { attachStaged, findStaged, requiredDocInfo, uncoveredRequirements } from "@/lib/publicDocuments";

class StagedDocumentsGone extends Error {}

// A "documents" link (upload missing documents only) is never used up by a
// submission -- it stays open until it expires.
function linkUsable(link: { submittedAt: Date | null; expiresAt: Date; purpose: string } | null) {
  return Boolean(link && link.expiresAt >= new Date() && (link.purpose === "documents" || !link.submittedAt));
}

type Params = { params: Promise<{ token: string }> };

// Public (no session required, same reasoning as GET /api/invites/[token]
// and GET /api/auth/reset-password/[token]): the token itself is the
// proof. A missing/expired/already-submitted token all return the same
// generic 404 so a wrong guess learns nothing. Returns only the minimum
// needed to render the form -- never any of the child's existing profile
// data, since this link may be sitting unopened in an email inbox.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ip = clientIp(req.headers);
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

    if (!link || !linkUsable(link)) {
      return NextResponse.json(
        { error: "This link is invalid, has expired, or has already been used." },
        { status: 404 }
      );
    }

    // Documents this school requires, and which the child still lacks.
    const { required, missing } = await missingForChild(link.organizationId, link.childId);
    return NextResponse.json({
      childFirstName: link.child.firstName,
      organizationName: link.organization.name,
      expiresAt: link.expiresAt,
      purpose: link.purpose,
      requiredDocuments: requiredDocInfo(required),
      // Once-per-child documents not on file yet (a details form asks for these).
      stillNeeded: missing.filter((m) => !documentTypeDef(m.type)?.perGuardian).map((m) => m.type),
      // The documents-only page lists exactly what is missing, per parent.
      missing: link.purpose === "documents" ? missing : [],
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
    const ip = clientIp(req.headers);
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
    if (!link || link.purpose !== "details" || link.submittedAt || link.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This link is invalid, has expired, or has already been used." },
        { status: 404 }
      );
    }

    const body = parentSubmissionSchema.parse(await req.json());

    // Emergency contact must be someone other than the parents/guardians.
    const ecProblem = emergencyContactProblem(
      {
        name: body.child.emergencyContactName,
        relationship: body.child.emergencyContactRelationship,
        phone: body.child.emergencyContactPhone,
      },
      body.guardians
    );
    if (ecProblem) {
      return NextResponse.json({ error: ecProblem }, { status: 400 });
    }

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

    // Required documents (uploaded one by one before this submit).
    const staged = await findStaged(link.organizationId, body.uploadKey, body.documentIds);
    if (!staged || staged.some((d) => d.guardianIndex !== null && d.guardianIndex >= body.guardians.length)) {
      return NextResponse.json({ error: "Some uploaded documents couldn't be found. Please upload them again." }, { status: 400 });
    }
    const { required, missing } = await missingForChild(link.organizationId, link.childId);
    const stillNeeded = missing.filter((m) => !documentTypeDef(m.type)?.perGuardian).map((m) => m.type);
    const uncovered = uncoveredRequirements(required, stillNeeded, body.guardians.length, staged);
    if (uncovered.length) {
      return NextResponse.json({ error: `Please upload: ${uncovered.join(", ")}.` }, { status: 400 });
    }

    try {
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

        if (!(await attachStaged(tx, staged, submission.id))) {
          throw new StagedDocumentsGone();
        }

        // One submission per link, even if two arrive at the same moment.
        const { count } = await tx.parentFormLink.updateMany({
          where: { id: link.id, submittedAt: null },
          data: { submittedAt: new Date() },
        });
        if (count !== 1) throw new StagedDocumentsGone();
      });
    } catch (e) {
      if (e instanceof StagedDocumentsGone) {
        return NextResponse.json(
          { error: "This form was already sent, or some uploads were lost. Please reload the page and try again." },
          { status: 409 }
        );
      }
      throw e;
    }

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
