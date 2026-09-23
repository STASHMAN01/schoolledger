import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateInviteToken as generateFormToken } from "@/lib/inviteToken";
import { sendMail } from "@/lib/mail";
import { publicBaseUrl } from "@/lib/applyLink";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

const LINK_EXPIRY_DAYS = 7;

// Same "does this child exist, and if I'm a TEACHER is it my own class"
// check every other children/[childId]/* route makes.
async function findAccessibleChild(
  organizationId: string,
  childId: string,
  role: string,
  assignedCategoryId: string | null
) {
  const child = await db.child.findFirst({ where: { id: childId, organizationId } });
  if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) {
    return null;
  }
  return child;
}

// List past links generated for this child (dated history, same pattern
// as the form-document Forms card) -- never the raw token, which only
// ever appears once, in the create response.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);

    const child = await findAccessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const links = await db.parentFormLink.findMany({
      where: { childId, organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        submission: { select: { id: true, status: true, submittedAt: true } },
      },
    });

    return NextResponse.json({
      links: links.map((l) => ({
        id: l.id,
        createdAt: l.createdAt,
        expiresAt: l.expiresAt,
        createdBy: l.createdBy,
        submission: l.submission,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Generate a new one-time link for this child. The raw token is returned
// exactly once here and never stored (only its hash) -- same pattern as
// password-reset/invite links. Optionally emails it straight to the
// child's billing contact email if one is on file.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const child = await findAccessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const sendEmail = body?.sendEmail === true;

    if (sendEmail && !child.parentEmail) {
      return NextResponse.json(
        { error: "This child has no parent email on file to send to." },
        { status: 400 }
      );
    }

    const organization = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });

    const { token, tokenHash } = generateFormToken();
    const expiresAt = new Date(Date.now() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const link = await db.parentFormLink.create({
      data: {
        organizationId,
        childId,
        tokenHash,
        createdByUserId: userId,
        expiresAt,
      },
    });

    // Public site address, not the request's Host header (final inspection R11).
    const url = `${publicBaseUrl(req.nextUrl.origin)}/apply/${token}`;

    let emailSent = false;
    if (sendEmail && child.parentEmail) {
      const result = await sendMail({
        to: child.parentEmail,
        subject: `Enrolment form for ${child.firstName} at ${organization.name}`,
        text: `${organization.name} has asked you to complete an enrolment form for ${child.firstName}. This link works once and expires in ${LINK_EXPIRY_DAYS} days:\n\n${url}\n\nYou'll need photos of your ID document and ${child.firstName}'s ID document (if available) to complete it on your phone.`,
        html: `
          <p>${organization.name} has asked you to complete an enrolment form for ${child.firstName}.</p>
          <p><a href="${url}">Complete the form</a></p>
          <p style="color:#666;font-size:13px">This link works once and expires in ${LINK_EXPIRY_DAYS} days. You'll need photos of your ID document and ${child.firstName}'s ID document (if available) to complete it on your phone.</p>
        `,
      });
      emailSent = result.sent;
    }

    await logAudit({
      organizationId,
      userId,
      action: "parentFormLink.created",
      entityType: "ParentFormLink",
      entityId: link.id,
      metadata: { childId, emailSent },
    });

    return NextResponse.json({ url, expiresAt, emailSent }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
