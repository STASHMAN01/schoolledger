import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childImportSchema, childImportRowSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateAnnualPlanForChild } from "@/lib/billing/financialPlan";
import { readImportRow } from "@/lib/childImport";
import { normalizePhone } from "@/lib/phone";

type Params = { params: Promise<{ organizationId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const body = childImportSchema.parse(await req.json());

    // A TEACHER can only import into their own class -- every row lands
    // there regardless of any class column in the file.
    const teacherOnly = role === "TEACHER";
    if (teacherOnly && body.defaultCategoryId !== assignedCategoryId) {
      return NextResponse.json(
        { error: "You can only import children into your own class." },
        { status: 403 }
      );
    }

    const defaultCategory = await db.category.findFirst({
      where: { id: body.defaultCategoryId, organizationId, deletedAt: null },
    });
    if (!defaultCategory) {
      return NextResponse.json({ error: "Default class not found." }, { status: 400 });
    }

    const categories = teacherOnly
      ? [defaultCategory]
      : await db.category.findMany({ where: { organizationId, deletedAt: null } });
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
        // Heading matching (Child's Name, ID No., Parent 1 Name, ...) lives
        // in src/lib/childImport.ts. Parent 1 becomes the billing contact
        // (fees, statements, reminders); every parent in the row is also
        // saved to the child's profile as a guardian.
        const row = readImportRow(raw);
        const billingParent = row.parents[0];

        const parsed = childImportRowSchema.parse({
          firstName: row.firstName,
          lastName: row.lastName,
          parentName: billingParent ? `${billingParent.firstName} ${billingParent.lastName}`.trim() : "",
          parentPhone: billingParent?.phone ?? "",
          parentEmail: billingParent?.email ?? "",
          categoryName: row.className || undefined,
          enrollmentDate: row.enrollmentDate || undefined,
          childIdNumber: row.idNumber,
          parentIdNumber: billingParent?.idNumber ?? "",
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
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
              dateOfBirth: parsed.dateOfBirth ?? null,
              gender: parsed.gender ?? null,
            },
          });
          for (const p of row.parents) {
            const phone = normalizePhone(p.phone);
            await tx.guardian.create({
              data: {
                organizationId,
                childId: child.id,
                relationship: (p.relationship || "Parent").slice(0, 100),
                firstName: p.firstName.slice(0, 100),
                lastName: p.lastName.slice(0, 100),
                idNumber: p.idNumber ? p.idNumber.slice(0, 64) : null,
                occupation: p.occupation ? p.occupation.slice(0, 120) : null,
                phone: typeof phone === "string" && phone ? phone.slice(0, 40) : null,
                email: p.email ? p.email.slice(0, 200) : null,
              },
            });
          }
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
