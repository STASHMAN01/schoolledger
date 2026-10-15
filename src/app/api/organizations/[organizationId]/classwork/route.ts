import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { CLASSWORK_HISTORY_DAYS, addDays, classworkSchema } from "@/lib/lessonPlan";
import { notifyOrgAdmins } from "@/lib/notifyTeachers";
import { checkClassworkPhotos, stagedCutoff } from "@/lib/classwork";
import { presentToday } from "@/lib/classworkStaging";
import { z } from "zod";

type Params = { params: Promise<{ organizationId: string }> };

const entrySelect = {
  id: true,
  date: true,
  activityType: true,
  description: true,
  createdAt: true,
  createdBy: { select: { name: true } },
  photos: {
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, caption: true, contentType: true, childId: true },
  },
} as const;

const photoSelect = { id: true, caption: true, contentType: true, childId: true } as const;

// Photos first, then the description (Dylan, 15 Oct 2026): the photo ids
// come from uploads the teacher already staged. The description is checked
// separately, after the photos, so the teacher is told about missing photos
// first.
const classworkPostSchema = z.object({
  activityType: classworkSchema.shape.activityType,
  description: z.string().max(5_000, "Keep it under 5,000 characters.").default(""),
  photoIds: z.array(z.string().min(1)).max(100).default([]),
});

class PhotosGoneError extends Error {}

async function schoolToday(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  return schoolClock(org?.timezone ?? "Africa/Johannesburg");
}

// Classwork (Dylan, 5 Oct 2026): what the class did today. A teacher sees
// their own class; anyone else with Centre access picks a class.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const scope = resolveAttendanceScope(role, assignedCategoryId, req.nextUrl.searchParams.get("categoryId"));
    if (scope.mode === "none") return NextResponse.json({ error: "No class assigned yet." }, { status: 400 });
    if (scope.mode === "all") return NextResponse.json({ error: "categoryId is required." }, { status: 400 });

    const category = await db.category.findFirst({
      where: { id: scope.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const clock = await schoolToday(organizationId);
    const entries = await db.classworkEntry.findMany({
      where: {
        organizationId,
        categoryId: category.id,
        date: { gte: schoolDateValue(addDays(clock.date, -CLASSWORK_HISTORY_DAYS)) },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: entrySelect,
    });

    // The current user's staged photos (taken, not yet submitted), so a page
    // refresh doesn't lose them, and today's register for the individual rule.
    const [staged, register] = await Promise.all([
      db.storedFile.findMany({
        where: {
          organizationId,
          kind: "CLASSWORK",
          status: "ACTIVE",
          classworkEntryId: null,
          uploadedByUserId: userId,
          createdAt: { gte: stagedCutoff() },
        },
        orderBy: { createdAt: "asc" },
        select: photoSelect,
      }),
      presentToday(organizationId, category.id, clock.date),
    ]);

    return NextResponse.json({
      category,
      today: clock.date,
      entries: entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })),
      staged,
      presentChildren: register.presentChildren,
      registerTaken: register.registerTaken,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// A class teacher adds an entry for today. Add-only: there is no edit.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (role !== "TEACHER" || !assignedCategoryId) {
      return NextResponse.json({ error: "Only a class teacher records classwork." }, { status: 403 });
    }

    const body = classworkPostSchema.parse(await req.json());
    const clock = await schoolToday(organizationId);

    // 1. Every photo must be this teacher's own confirmed, staged upload.
    const photoIds = body.photoIds;
    const files =
      photoIds.length === 0
        ? []
        : await db.storedFile.findMany({
            where: {
              id: { in: photoIds },
              organizationId,
              kind: "CLASSWORK",
              status: "ACTIVE",
              classworkEntryId: null,
              uploadedByUserId: userId,
            },
            select: { id: true, childId: true },
          });
    if (new Set(photoIds).size !== photoIds.length || files.length !== photoIds.length) {
      return NextResponse.json({ error: "Some photos couldn't be found. Please add them again." }, { status: 400 });
    }

    // 2. Enough photos for this kind of activity (GROUP: some; INDIVIDUAL:
    // one of every child marked present today).
    const register = await presentToday(organizationId, assignedCategoryId, clock.date);
    const check = checkClassworkPhotos({
      activityType: body.activityType,
      photos: files,
      presentChildren: register.presentChildren,
      registerTaken: register.registerTaken,
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    // 3. Then the description.
    const description = classworkSchema.shape.description.safeParse(body.description);
    if (!description.success) {
      return NextResponse.json({ error: description.error.issues[0]?.message ?? "Describe what you did." }, { status: 400 });
    }

    // 4. The entry and its photos are saved together, or not at all.
    let entry;
    try {
      entry = await db.$transaction(async (tx) => {
        const created = await tx.classworkEntry.create({
          data: {
            organizationId,
            categoryId: assignedCategoryId,
            date: schoolDateValue(clock.date),
            activityType: body.activityType,
            description: description.data,
            createdByUserId: userId,
          },
          select: { id: true },
        });
        // Still unattached and still ours, or someone submitted these twice.
        const attached = await tx.storedFile.updateMany({
          where: {
            id: { in: photoIds },
            organizationId,
            kind: "CLASSWORK",
            status: "ACTIVE",
            classworkEntryId: null,
            uploadedByUserId: userId,
          },
          data: { classworkEntryId: created.id },
        });
        if (attached.count !== photoIds.length) throw new PhotosGoneError();
        return tx.classworkEntry.findUniqueOrThrow({ where: { id: created.id }, select: entrySelect });
      });
    } catch (err) {
      if (err instanceof PhotosGoneError) {
        return NextResponse.json({ error: "Some photos couldn't be found. Please add them again." }, { status: 400 });
      }
      throw err;
    }

    await logAudit({
      organizationId,
      userId,
      action: "classwork.added",
      entityType: "ClassworkEntry",
      entityId: entry.id,
      metadata: { date: clock.date, photos: photoIds.length },
    });

    const category = await db.category.findUnique({
      where: { id: assignedCategoryId },
      select: { name: true },
    });
    await notifyOrgAdmins(organizationId, {
      title: "New activity logged",
      body: category ? `${category.name} recorded today's activity.` : "A class recorded today's activity.",
      screen: "classwork",
    }).catch(() => {});

    return NextResponse.json({ entry: { ...entry, date: clock.date } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
