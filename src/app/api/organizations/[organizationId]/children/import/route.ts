import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childImportSchema, childImportRowSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateAnnualPlanForChild } from "@/lib/billing/financialPlan";

type Params = { params: Promise<{ organizationId: string }> };

// Every possible header spelling this accepts for a given field, matched
// case-insensitively (csvRowsToRecords on the client already lowercases
// and trims headers before this ever sees them). Deliberately generous —
// a school pasting from whatever spreadsheet they already had shouldn't
// have to rename their columns to match this app exactly.
const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ["child first name", "childfirstname", "first name", "firstname", "child name"],
  lastName: ["child last name", "childlastname", "last name", "lastname", "surname", "child surname"],
  parentName: ["parent name", "parentname", "parent full name"],
  parentFirstName: ["parent first name", "parentfirstname"],
  parentLastName: ["parent last name", "parentlastname", "parent surname"],
  parentPhone: ["parent phone", "phone", "parent contact", "contact", "parent contact details", "cell", "mobile"],
  parentEmail: ["parent email", "email"],
  categoryName: ["category", "class", "grade"],
  enrollmentDate: ["enrollment date", "enrollmentdate", "start date"],
  childIdNumber: ["child id", "childid", "child id number", "child's id"],
  parentIdNumber: ["parent id", "parentid", "parent id number", "parent's id"],
};

function pick(row: Record<string, string>, field: keyof typeof FIELD_ALIASES): string {
  for (const alias of FIELD_ALIASES[field]) {
    const v = row[alias];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_CHILDREN");

    const body = childImportSchema.parse(await req.json());

    const defaultCategory = await db.category.findFirst({
      where: { id: body.defaultCategoryId, organizationId, deletedAt: null },
    });
    if (!defaultCategory) {
      return NextResponse.json({ error: "Default class not found." }, { status: 400 });
    }

    const categories = await db.category.findMany({
      where: { organizationId, deletedAt: null },
    });
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));

    let created = 0;
    const errors: { row: number; error: string }[] = [];

    // One transaction per row rather than one for the whole file: a
    // typo in row 40 of a 60-row import should not undo rows 1–39. Each
    // row's failure is reported back with its (1-based, header excluded)
    // row number so it reads the same way a spreadsheet row would.
    for (let i = 0; i < body.rows.length; i++) {
      const raw = body.rows[i];
      const rowNumber = i + 2; // header is row 1 in the source file

      try {
        const firstName = pick(raw, "firstName");
        const lastName = pick(raw, "lastName");
        const parentNameDirect = pick(raw, "parentName");
        const parentFirstName = pick(raw, "parentFirstName");
        const parentLastName = pick(raw, "parentLastName");
        const parentName =
          parentNameDirect || `${parentFirstName} ${parentLastName}`.trim();
        const categoryName = pick(raw, "categoryName");
        const enrollmentDateRaw = pick(raw, "enrollmentDate");

        const parsed = childImportRowSchema.parse({
          firstName,
          lastName,
          parentName,
          parentPhone: pick(raw, "parentPhone"),
          parentEmail: pick(raw, "parentEmail"),
          categoryName: categoryName || undefined,
          enrollmentDate: enrollmentDateRaw || undefined,
          childIdNumber: pick(raw, "childIdNumber"),
          parentIdNumber: pick(raw, "parentIdNumber"),
        });

        let category = defaultCategory;
        if (parsed.categoryName) {
          const match = categoryByName.get(parsed.categoryName.trim().toLowerCase());
          if (!match) {
            errors.push({
              row: rowNumber,
              error: `Class "${parsed.categoryName}" doesn't match any existing class — fix the name or leave it blank to use the default.`,
            });
            continue;
          }
          category = match;
        }

        const enrollmentDate = parsed.enrollmentDate ?? body.defaultEnrollmentDate;

        await db.$transaction(async (tx) => {
          const child = await tx.child.create({
            data: {
              organizationId,
              categoryId: category.id,
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              parentName: parsed.parentName,
              parentPhone: parsed.parentPhone ?? null,
              parentEmail: parsed.parentEmail ?? null,
              enrollmentDate,
              childIdNumber: parsed.childIdNumber ?? null,
              parentIdNumber: parsed.parentIdNumber ?? null,
            },
          });
          await generateAnnualPlanForChild(
            tx,
            organizationId,
            child,
            category,
            enrollmentDate.getUTCFullYear(),
            userId
          );
        });

        created++;
      } catch (rowErr) {
        const message =
          rowErr instanceof ZodError
            ? rowErr.issues.map((i) => i.message).join("; ")
            : rowErr instanceof Error
              ? rowErr.message
              : "Could not import this row.";
        errors.push({ row: rowNumber, error: message });
      }
    }

    if (created > 0) {
      await logAudit({
        organizationId,
        userId,
        action: "children.imported",
        entityType: "Child",
        entityId: organizationId,
        metadata: { created, failed: errors.length },
      });
    }

    return NextResponse.json({ created, errors });
  } catch (err) {
    return handleApiError(err);
  }
}
