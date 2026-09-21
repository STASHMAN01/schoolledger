import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateFormPdf } from "@/lib/forms/formPdf";
import { buildFormSpec } from "@/lib/forms/templates";
import { FORM_TYPES, FORM_TYPE_LABELS, MONEY_FORM_TYPES, type FormType } from "@/lib/forms/types";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

async function findAccessibleChild(organizationId: string, childId: string, role: string, assignedCategoryId: string | null) {
  const child = await db.child.findFirst({
    where: { id: childId, organizationId },
    include: { category: true, guardians: { orderBy: { createdAt: "asc" } } },
  });
  if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) return null;
  return child;
}

// List of previously-generated forms for this child -- metadata only
// (formType, when, who), never the PDF bytes: fetching the actual
// document is its own audited endpoint (forms/[formId]/download), same
// separation as the ID-number reveal endpoint.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);

    const child = await findAccessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const documents = await db.formDocument.findMany({
      where: { childId, organizationId },
      orderBy: { generatedAt: "desc" },
      select: {
        id: true,
        formType: true,
        generatedAt: true,
        generatedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ documents });
  } catch (err) {
    return handleApiError(err);
  }
}

const bodySchema = z.object({ formType: z.enum(FORM_TYPES as [FormType, ...FormType[]]) });

// Generates a new form-template PDF for this child and stores it as its
// own dated record -- never overwrites a previous generation of the same
// formType, per Dylan's explicit choice (these are dated records of what
// was handed to a parent, not a "current state" toggle).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const { formType } = bodySchema.parse(await req.json());

    // Fee Agreement is the one template that shows a fee amount -- the
    // plan's own principle is "Centre Management shows personal info
    // only, never money", so this one extra template needs VIEW_MONEY on
    // top of MANAGE_CHILDREN (a TEACHER/RECEPTIONIST without VIEW_MONEY
    // can generate the other 6 but not this one).
    if (MONEY_FORM_TYPES.includes(formType) && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const child = await findAccessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const organization = await db.organization.findUnique({ where: { id: organizationId } });
    if (!organization) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const spec = buildFormSpec(formType, {
      organizationName: organization.name,
      currencyCode: organization.currencyCode,
      child: {
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        enrollmentDate: child.enrollmentDate,
        parentName: child.parentName,
        parentPhone: child.parentPhone,
        parentEmail: child.parentEmail,
        childIdNumber: child.childIdNumber,
        parentIdNumber: child.parentIdNumber,
        feeOverrideCents: child.feeOverrideCents,
        photoConsentGiven: child.photoConsentGiven,
        photoConsentAt: child.photoConsentAt,
        category: { name: child.category.name, monthlyFeeCents: child.category.monthlyFeeCents },
      },
      guardians: child.guardians,
    });

    const pdfBytes = await generateFormPdf(organization, spec);
    const pdfDataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`;

    const document = await db.formDocument.create({
      data: {
        organizationId,
        childId,
        formType,
        pdf: pdfDataUrl,
        generatedByUserId: userId,
      },
      select: { id: true, formType: true, generatedAt: true, generatedBy: { select: { name: true } } },
    });

    await logAudit({
      organizationId,
      userId,
      action: "form.generated",
      entityType: "Child",
      entityId: childId,
      metadata: { formType, formLabel: FORM_TYPE_LABELS[formType], documentId: document.id },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
