import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { buildFormSpec } from "@/lib/forms/templates";
import { generateFormPdf } from "@/lib/forms/formPdf";
import { FORM_TYPES, FORM_TYPE_LABELS, type FormType } from "@/lib/forms/types";

type Params = { params: Promise<{ organizationId: string }> };

// A BLANK copy of one of the form templates, on the school's letterhead,
// to print and hand out (Forms page, Dylan 23 Sept). No child data at all,
// so nothing is stored or audit-logged. The Fee Agreement blank has no
// amount filled in, but stays with the money roles like the filled one.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { permissions } = await requireMembership(organizationId, "MANAGE_CHILDREN");

    const formType = req.nextUrl.searchParams.get("formType") as FormType | null;
    if (!formType || !FORM_TYPES.includes(formType)) {
      return NextResponse.json({ error: "Unknown form." }, { status: 400 });
    }
    if (formType === "FEE_AGREEMENT" && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const organization = await db.organization.findUnique({ where: { id: organizationId } });
    if (!organization) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const spec = buildFormSpec(formType, {
      organizationName: organization.name,
      currencyCode: organization.currencyCode,
      child: {
        firstName: "",
        lastName: "",
        dateOfBirth: null,
        gender: null,
        enrollmentDate: null,
        parentName: "",
        parentPhone: null,
        parentEmail: null,
        childIdNumber: null,
        parentIdNumber: null,
        feeOverrideCents: null,
        photoConsentGiven: false,
        photoConsentAt: null,
        category: { name: "", monthlyFeeCents: null },
      },
      guardians: [],
    });

    const bytes = await generateFormPdf(organization, spec);
    const filename = `${FORM_TYPE_LABELS[formType].replace(/[^A-Za-z0-9]+/g, "-")}-blank.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
