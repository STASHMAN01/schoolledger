import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { attendanceNotifySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { sendMail } from "@/lib/mail";
import { resolveAttendanceScope } from "@/lib/attendanceScope";

type Params = { params: Promise<{ organizationId: string }> };

// "Absent parents are emailed in one tap" per docs/PLAN.md -- one request
// emails every not-yet-notified absent child's parent in scope (today, or
// whatever date/class the caller passed) and marks each notifiedAt, so a
// second tap never double-emails the same parent. Deliberately no 2-person
// approval gate here (unlike the money-reminders "send all") -- this is a
// same-day informational notice, not a request for money, and the plan
// calls for it to be a single immediate tap.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_ATTENDANCE"
    );

    const body = attendanceNotifySchema.parse(await req.json());

    if (role === "TEACHER" && body.categoryId && body.categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not allowed for your class." }, { status: 403 });
    }
    const scope = resolveAttendanceScope(role, assignedCategoryId, body.categoryId);
    if (scope.mode === "none") {
      return NextResponse.json({ notifiedCount: 0, skippedNoEmailCount: 0, failedCount: 0 });
    }

    const organization = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });

    const records = await db.attendanceRecord.findMany({
      where: {
        organizationId,
        date: body.date,
        status: "ABSENT",
        notifiedAt: null,
        child: {
          categoryId: scope.mode === "single" ? scope.categoryId : undefined,
          archived: false,
          deletedAt: null,
        },
      },
      include: { child: { select: { firstName: true, parentEmail: true } } },
    });

    const dateLabel = body.date.toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

    let notifiedCount = 0;
    let skippedNoEmailCount = 0;
    let failedCount = 0;
    const notifiedRecordIds: string[] = [];

    for (const r of records) {
      if (!r.child.parentEmail) {
        skippedNoEmailCount++;
        continue;
      }
      try {
        const result = await sendMail({
          to: r.child.parentEmail,
          subject: `${r.child.firstName} was marked absent today at ${organization.name}`,
          text: `${organization.name} has marked ${r.child.firstName} absent for ${dateLabel}. If this isn't right, or your child will be away for longer, please let the school know.`,
          html: `<p>${organization.name} has marked <strong>${r.child.firstName}</strong> absent for ${dateLabel}.</p><p style="color:#666;font-size:13px">If this isn't right, or your child will be away for longer, please let the school know.</p>`,
        });
        if (result.sent) {
          notifiedCount++;
          notifiedRecordIds.push(r.id);
        } else {
          skippedNoEmailCount++;
        }
      } catch (err) {
        console.error("Failed to send attendance-absence email", r.id, err);
        failedCount++;
      }
    }

    if (notifiedRecordIds.length > 0) {
      await db.attendanceRecord.updateMany({
        where: { id: { in: notifiedRecordIds } },
        data: { notifiedAt: new Date() },
      });
    }

    await logAudit({
      organizationId,
      userId,
      action: "attendance.absentParentsNotified",
      entityType: "Attendance",
      metadata: {
        date: body.date.toISOString().slice(0, 10),
        categoryId: scope.mode === "single" ? scope.categoryId : null,
        notifiedCount,
        skippedNoEmailCount,
        failedCount,
      },
    });

    return NextResponse.json({ notifiedCount, skippedNoEmailCount, failedCount });
  } catch (err) {
    return handleApiError(err);
  }
}
