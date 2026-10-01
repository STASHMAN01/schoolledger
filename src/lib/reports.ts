import { z } from "zod";
import type { Role } from "@prisma/client";

// Centre Management Reports (Dylan, 1 Oct 2026 to-do): incident, academic
// and disciplinary/behaviour reports. One Prisma model (ChildReport) with
// a `type` discriminator -- see the schema comment for why -- so this file
// is the one place that knows which fields belong to which type, same
// role src/lib/documents.ts plays for ChildDocument.

export const REPORT_TYPES = ["INCIDENT", "ACADEMIC", "DISCIPLINARY"] as const;
export type ReportTypeValue = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_INFO: Record<ReportTypeValue, { label: string; plural: string; hint: string }> = {
  INCIDENT: {
    label: "Incident report",
    plural: "Incident reports",
    hint: "An injury, accident or health event -- what happened, first aid given, parent notified.",
  },
  ACADEMIC: {
    label: "Academic report",
    plural: "Academic reports",
    hint: "A term's progress against development areas, for parents.",
  },
  DISCIPLINARY: {
    label: "Disciplinary report",
    plural: "Disciplinary reports",
    hint: "A behaviour incident -- what happened, action taken, follow-up.",
  },
};

// Mirrors resolveAttendanceScope (src/lib/attendanceScope.ts): a TEACHER's
// own assigned class always wins over whatever categoryId the client
// asked for, it never widens it.
export type ReportScope =
  | { mode: "single"; categoryId: string }
  | { mode: "all" }
  | { mode: "none" };

export function resolveReportScope(
  role: Role,
  assignedCategoryId: string | null,
  requestedCategoryId: string | null | undefined
): ReportScope {
  if (role === "TEACHER") {
    if (!assignedCategoryId) return { mode: "none" };
    return { mode: "single", categoryId: assignedCategoryId };
  }
  if (requestedCategoryId) {
    return { mode: "single", categoryId: requestedCategoryId };
  }
  return { mode: "all" };
}

const baseReportFields = {
  childId: z.string().cuid(),
  type: z.enum(REPORT_TYPES),
  occurredAt: z.coerce.date(),
  summary: z.string().trim().min(1, "Describe what happened.").max(10_000),
  parentNotified: z.boolean().default(false),
  // INCIDENT
  injury: z.boolean().optional(),
  firstAidGiven: z.boolean().optional(),
  witnesses: z.string().trim().max(2_000).optional().or(z.literal("")),
  actionTaken: z.string().trim().max(5_000).optional().or(z.literal("")),
  // ACADEMIC
  term: z.string().trim().max(100).optional().or(z.literal("")),
  developmentArea: z.string().trim().max(100).optional().or(z.literal("")),
  rating: z.string().trim().max(100).optional().or(z.literal("")),
  // DISCIPLINARY
  behaviour: z.string().trim().max(5_000).optional().or(z.literal("")),
  followUp: z.string().trim().max(5_000).optional().or(z.literal("")),
};

export const reportCreateSchema = z.object(baseReportFields);
export const reportUpdateSchema = z.object(baseReportFields).partial({ childId: true, type: true });

// Empty-string optional text fields (from form inputs) should be stored as
// null, not "" -- keeps "not set" consistent for the PDF/UI to check.
export function blankToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}
