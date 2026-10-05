import { z } from "zod";
import { DATE_RE } from "@/lib/lessonPlan";

// Medicine register (Dylan, 5 Oct 2026). Pure helpers and the consent
// wording, no db. What a medicine consent has to cover comes from childcare
// medication guidance (US state licensing forms, Victoria's early-learning
// procedure): who the child is, exactly what/how much/when/how/for how long,
// that it arrives in the original labelled container and is in date, the
// parent's signed permission, and a record of every dose given.

export const CONSENT_VERSION = 1;

export const ROUTES = ["ORAL", "TOPICAL", "INHALER", "EYE_EAR_NOSE", "OTHER"] as const;
export const ROUTE_LABELS: Record<(typeof ROUTES)[number], string> = {
  ORAL: "By mouth (liquid, tablet, spoon)",
  TOPICAL: "On the skin (cream, ointment)",
  INHALER: "Inhaler or nebuliser",
  EYE_EAR_NOSE: "Eye, ear or nose drops",
  OTHER: "Other",
};

export const STORAGE = ["ROOM", "FRIDGE", "CHILD_CARRIES"] as const;
export const STORAGE_LABELS: Record<(typeof STORAGE)[number], string> = {
  ROOM: "Locked cupboard, room temperature",
  FRIDGE: "Fridge",
  CHILD_CARRIES: "Kept near the child (inhaler, EpiPen)",
};

export const DOSE_OUTCOMES = ["GIVEN", "REFUSED", "VOMITED", "NOT_GIVEN"] as const;
export const DOSE_OUTCOME_LABELS: Record<(typeof DOSE_OUTCOMES)[number], string> = {
  GIVEN: "Given",
  REFUSED: "Child refused",
  VOMITED: "Child vomited it up",
  NOT_GIVEN: "Not given",
};

export const RELATIONSHIPS = ["Mother", "Father", "Grandparent", "Legal guardian", "Other"] as const;

/** Longest course one form can cover. A longer course needs a fresh form. */
export const MAX_COURSE_DAYS = 60;

/**
 * The words the parent agrees to. Shown above the signature box and printed
 * on the PDF. Changing them means bumping CONSENT_VERSION.
 */
export function consentStatements(schoolName: string): string[] {
  return [
    `I am the parent or legal guardian of the child named on this form, and I give ${schoolName} permission to give my child the medicine described above, exactly as written here and on the label.`,
    "The details I gave are correct. The medicine is in its original container, the label matches this form, and it is not past its expiry date. If it is a new medicine, my child has already had a dose at home without a bad reaction.",
    "I understand the school will only give what is written on this form. I must tell the school in writing if the dose changes or the medicine is stopped, and I must not send my child to school if they are too unwell to join in.",
    "If my child reacts badly to the medicine or becomes seriously unwell, the school may phone me, call a doctor or call emergency services. I will be reachable on the number below, or on my emergency contact's number.",
    "Unused medicine will be handed back to me when the course ends. The school records every dose it gives and keeps this form.",
    "I agree that the school may record my child's health information on this form for giving this medicine only, in line with POPIA.",
  ];
}

const dateStr = z.string().regex(DATE_RE, "Choose a date.");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 10:30.");

/** Signature pad output: a small PNG data URL. */
export const SIGNATURE_MIN = 600; // an empty canvas encodes to far less than this
export const SIGNATURE_MAX = 250_000;
export function isSignatureImage(v: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length >= SIGNATURE_MIN && v.length <= SIGNATURE_MAX;
}

const signatureField = z
  .string()
  .refine(isSignatureImage, "Ask the parent to sign in the box.");

export const parentSignSchema = z.object({
  parentName: z.string().trim().min(2, "Enter the parent's full name.").max(120),
  parentRelationship: z.string().trim().min(2, "Choose how they are related to the child.").max(60),
  parentPhone: z.string().trim().min(7, "Enter a phone number we can reach today.").max(30),
  signature: signatureField,
  agreed: z.literal(true, { error: "The parent must tick that they agree." }),
});

const text = (max: number) => z.string().trim().max(max);

export const medicineCreateSchema = z
  .object({
    childId: z.string().min(1, "Choose a child."),
    medicineName: text(120).min(2, "Enter the medicine's name."),
    reason: text(200).min(2, "Say what the medicine is for."),
    isPrescribed: z.boolean(),
    prescriberName: text(120).optional().or(z.literal("")),
    dose: text(80).min(1, "Enter the dose, e.g. 5 ml."),
    route: z.enum(ROUTES),
    frequency: text(160).min(2, "Say how often, e.g. twice a day."),
    scheduledTimes: z.array(timeStr).max(8).default([]),
    startDate: dateStr,
    endDate: dateStr,
    lastDoseAtHome: text(120).optional().or(z.literal("")),
    storage: z.enum(STORAGE),
    expiryDate: dateStr.optional().or(z.literal("")),
    originalContainer: z.boolean(),
    labelMatches: z.boolean(),
    notExpired: z.boolean(),
    specialInstructions: text(2_000).optional().or(z.literal("")),
    // The parent may sign now, on the tablet, or later.
    sign: parentSignSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The last day can't be before the first day." });
    }
    if (daysBetween(v.startDate, v.endDate) + 1 > MAX_COURSE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `One form covers up to ${MAX_COURSE_DAYS} days. Make a new form for a longer course.`,
      });
    }
    if (!v.originalContainer) {
      ctx.addIssue({
        code: "custom",
        path: ["originalContainer"],
        message: "We can only take medicine in its original container.",
      });
    }
    if (!v.labelMatches) {
      ctx.addIssue({ code: "custom", path: ["labelMatches"], message: "Check the label matches this form." });
    }
    if (!v.notExpired) {
      ctx.addIssue({ code: "custom", path: ["notExpired"], message: "Check the expiry date." });
    }
    if (v.expiryDate && v.expiryDate < v.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "The medicine expires before the last day of the course.",
      });
    }
  });

export const doseSchema = z.object({
  outcome: z.enum(DOSE_OUTCOMES),
  doseGiven: text(80).optional().or(z.literal("")),
  note: text(1_000).optional().or(z.literal("")),
  witnessName: text(120).optional().or(z.literal("")),
});

export const medicineReturnSchema = z.object({
  note: text(500).optional().or(z.literal("")),
});

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Does a form running from startDate to endDate cover `date`? */
export function coversDate(r: { startDate: string; endDate: string }, date: string): boolean {
  return date >= r.startDate && date <= r.endDate;
}

export type DoseCheck = { ok: true } | { ok: false; error: string };

/**
 * The rules before staff may give a dose: signed, in the course dates, in
 * date, and not already handed back.
 */
export function canGiveDose(
  r: {
    signedAt: Date | null;
    returnedAt: Date | null;
    startDate: string;
    endDate: string;
    expiryDate: string | null;
  },
  today: string
): DoseCheck {
  if (!r.signedAt) return { ok: false, error: "The parent hasn't signed yet. Don't give this medicine until they have." };
  if (r.returnedAt) return { ok: false, error: "This medicine was handed back to the parent." };
  if (today < r.startDate) return { ok: false, error: "This course hasn't started yet." };
  if (today > r.endDate) return { ok: false, error: "This course has finished." };
  if (r.expiryDate && today > r.expiryDate) return { ok: false, error: "This medicine is past its expiry date." };
  return { ok: true };
}

/** "Given 1 of 2" style progress for the doses due today. */
export function dosesDue(scheduledTimes: string[], givenToday: number): { due: number; given: number; allDone: boolean } {
  const due = scheduledTimes.length;
  return { due, given: givenToday, allDone: due > 0 && givenToday >= due };
}
