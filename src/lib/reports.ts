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

// Incident form fields from the school's own "Daycare Incident Report"
// template (Dylan, 4 Oct 2026). The values are stored as these codes; the
// labels are what the form and the PDF show.
export const INCIDENT_TYPES = [
  "MINOR_INJURY",
  "ILLNESS",
  "ALLERGIC_REACTION",
  "BEHAVIOURAL",
  "BITING_SCRATCHING",
  "CHOKING_RISK",
  "OTHER",
] as const;
export type IncidentTypeValue = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentTypeValue, string> = {
  MINOR_INJURY: "Minor injury",
  ILLNESS: "Illness / symptoms",
  ALLERGIC_REACTION: "Allergic reaction",
  BEHAVIOURAL: "Behavioural issue",
  BITING_SCRATCHING: "Biting / scratching",
  CHOKING_RISK: "Choking risk",
  OTHER: "Other",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "3 years, 2 months" as at `asOf`, or null when there is no usable date of birth. */
export function ageAt(dateOfBirth: Date | string | null | undefined, asOf: Date = new Date()): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let months = (asOf.getUTCFullYear() - dob.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - dob.getUTCMonth());
  if (asOf.getUTCDate() < dob.getUTCDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} year${years === 1 ? "" : "s"}`;
  const m = `${rest} month${rest === 1 ? "" : "s"}`;
  if (years === 0) return m;
  return rest === 0 ? y : `${y}, ${m}`;
}

const baseReportFields = {
  childId: z.string().cuid(),
  type: z.enum(REPORT_TYPES),
  occurredAt: z.coerce.date(),
  summary: z.string().trim().min(1, "Describe what happened.").max(10_000),
  parentNotified: z.boolean().default(false),
  // INCIDENT
  injury: z.boolean().optional(),
  firstAidGiven: z.boolean().nullable().optional(),
  witnesses: z.string().trim().max(2_000).optional().or(z.literal("")),
  actionTaken: z.string().trim().max(5_000).optional().or(z.literal("")),
  incidentTime: z.string().regex(TIME_RE, "Use a time like 14:30.").optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  incidentTypes: z.array(z.enum(INCIDENT_TYPES)).max(INCIDENT_TYPES.length).optional(),
  incidentTypeOther: z.string().trim().max(200).optional().or(z.literal("")),
  caregiver: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyCareRequired: z.boolean().nullable().optional(),
  staffConsulted: z.boolean().nullable().optional(),
  witnessesPresent: z.boolean().nullable().optional(),
  // ACADEMIC
  term: z.string().trim().max(100).optional().or(z.literal("")),
  developmentArea: z.string().trim().max(100).optional().or(z.literal("")),
  rating: z.string().trim().max(100).optional().or(z.literal("")),
  // DISCIPLINARY
  behaviour: z.string().trim().max(5_000).optional().or(z.literal("")),
  followUp: z.string().trim().max(5_000).optional().or(z.literal("")),
};

// A NEW incident report must carry what the paper template asks for; other
// types, and edits to older reports, stay as they were.
export const reportCreateSchema = z.object(baseReportFields).superRefine((v, ctx) => {
  if (v.type !== "INCIDENT") return;
  if (!v.incidentTime) {
    ctx.addIssue({ code: "custom", path: ["incidentTime"], message: "Enter the time it happened." });
  }
  if (!v.incidentTypes || v.incidentTypes.length === 0) {
    ctx.addIssue({ code: "custom", path: ["incidentTypes"], message: "Tick at least one type of incident." });
  }
  if (v.incidentTypes?.includes("OTHER") && !v.incidentTypeOther?.trim()) {
    ctx.addIssue({ code: "custom", path: ["incidentTypeOther"], message: "Say what the other type of incident was." });
  }
  if (!v.caregiver?.trim()) {
    ctx.addIssue({ code: "custom", path: ["caregiver"], message: "Enter the caregiver's name." });
  }
});
export const reportUpdateSchema = z.object(baseReportFields).partial({ childId: true, type: true });

// Empty-string optional text fields (from form inputs) should be stored as
// null, not "" -- keeps "not set" consistent for the PDF/UI to check.
export function blankToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}
