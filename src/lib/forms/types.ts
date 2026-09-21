// The 7 pre-built form templates (Phase 2 Session 3, see docs/PLAN.md
// decision #6) -- shared types between the field-mapping builders
// (templates.ts) and the PDF renderer (formPdf.ts). Kept as a small,
// generic "sections of label/value fields" shape rather than bespoke
// layout code per template, per decision #8 (form builder approach).

export type FormType =
  | "ENROLMENT"
  | "RE_REGISTRATION"
  | "INDEMNITY"
  | "MEDICAL_ALLERGY"
  | "PHOTO_MEDIA_CONSENT"
  | "EMERGENCY_CONTACT_PICKUP"
  | "FEE_AGREEMENT";

// Display order for the "Generate a form" button row -- roughly the order
// a school would use them through a child's lifecycle (enrol, then the
// consent/info forms, then re-registration each year, fee agreement last
// since it's the one Teacher/Receptionist without VIEW_MONEY won't see).
export const FORM_TYPES: FormType[] = [
  "ENROLMENT",
  "MEDICAL_ALLERGY",
  "PHOTO_MEDIA_CONSENT",
  "EMERGENCY_CONTACT_PICKUP",
  "INDEMNITY",
  "RE_REGISTRATION",
  "FEE_AGREEMENT",
];

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  ENROLMENT: "Enrolment form",
  RE_REGISTRATION: "Re-registration form",
  INDEMNITY: "Indemnity form",
  MEDICAL_ALLERGY: "Medical & allergy information",
  PHOTO_MEDIA_CONSENT: "Photo & media consent",
  EMERGENCY_CONTACT_PICKUP: "Emergency contact & pickup authorization",
  FEE_AGREEMENT: "Fee agreement & payment mandate",
};

// Only FEE_AGREEMENT touches money -- gated behind VIEW_MONEY in the API
// route, same reasoning as everything else billing-shaped ("Learner
// profiles on the centre side show personal info only, never money").
export const MONEY_FORM_TYPES: FormType[] = ["FEE_AGREEMENT"];

export type FormField = { label: string; value: string | null };
export type FormSection = { heading: string; fields: FormField[] };

export type FormSpec = {
  title: string;
  // A short paragraph under the title explaining what the form is for.
  intro: string;
  sections: FormSection[];
  // Compliance-sensitive templates (indemnity, medical/allergy, photo/
  // media consent, fee agreement) carry a visible note that this is a
  // fill-in-the-blank draft, not reviewed legal wording -- Claude isn't a
  // lawyer, and the plan's own POPIA checklist already flags legal
  // wording generally as needing review before real use.
  disclaimer?: string;
  // Whether to print a signature/date line at the bottom -- true for
  // every template except none currently (kept as a field rather than a
  // hardcoded "always" in the renderer in case a future template doesn't
  // need one).
  signatureLine: boolean;
};
