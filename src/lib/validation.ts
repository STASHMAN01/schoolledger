import { z } from "zod";

// Server-side validation schemas. These run on every mutating API route —
// never trust client-side form validation alone, since the API is what an
// attacker actually talks to.

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address, e.g. name@example.com");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters");

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "School name is required")
  .max(200);

// ISO 3166-1 alpha-2 country code, e.g. ZA, ZW, US.
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(2, "Use a 2-letter country code (e.g. ZA)");

// Very deliberately loose E.164 check (leading + and 8-15 digits) rather
// than a per-country regex table baked into this file: the source of truth
// for "is this a valid South African / Zimbabwean / ... number" is a
// maintained library (e.g. libphonenumber-js) wired up in the phone input
// component, which also normalizes the raw input to E.164 before it ever
// reaches this schema. This schema is the last-line server-side guard.
export const phoneE164Schema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number including country code");

export const moneyCentsSchema = z
  .number()
  .int("Amounts must not have sub-cent precision")
  .min(0, "Amount cannot be negative");

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  parentId: z.string().cuid().optional().nullable(),
  monthlyFeeCents: moneyCentsSchema.optional().nullable(),
});

// Treats "" the same as not provided, so an empty form field doesn't fail
// the stricter format checks below.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const childSchema = z.object({
  categoryId: z.string().cuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  parentName: z.string().trim().min(1).max(200),
  parentPhone: z.preprocess(emptyToUndefined, phoneE164Schema.optional()),
  parentEmail: z.preprocess(emptyToUndefined, emailSchema.optional()),
  enrollmentDate: z.coerce.date(),
  exitDate: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  feeOverrideCents: moneyCentsSchema.optional().nullable(),
  childIdNumber: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  parentIdNumber: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
});

// One row of a children CSV bulk-import. Deliberately looser than
// childSchema on contact info (a whole batch shouldn't fail — or every
// row silently need both phone and email — just because one parent only
// gave a phone number), and category/enrollment date are optional here
// because the import UI lets the person pick a default for the whole
// file when a row doesn't specify its own.
export const childImportRowSchema = z.object({
  firstName: z.string().trim().min(1, "Missing child first name"),
  lastName: z.string().trim().min(1, "Missing child last name"),
  parentName: z.string().trim().min(1, "Missing parent name"),
  parentPhone: z.preprocess(emptyToUndefined, phoneE164Schema.optional()),
  parentEmail: z.preprocess(emptyToUndefined, emailSchema.optional()),
  categoryName: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  enrollmentDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  childIdNumber: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  parentIdNumber: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
});

export const childImportSchema = z.object({
  defaultCategoryId: z.string().cuid(),
  defaultEnrollmentDate: z.coerce.date(),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(1000),
});

export const paymentTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  isRecurring: z.boolean(),
  defaultAmountCents: moneyCentsSchema.optional().nullable(),
  active: z.boolean().optional(),
});

export const recordPaymentSchema = z.object({
  childId: z.string().cuid(),
  amountCents: moneyCentsSchema.refine((v) => v > 0, "Amount must be greater than zero"),
  method: z.enum(["CASH", "EFT", "CARD", "OTHER"]),
  date: z.coerce.date(),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  // When set, the payment applies directly to that one-time PaymentType's
  // outstanding entry instead of running the general oldest-first waterfall
  // — e.g. a payment tagged specifically as "Uniform".
  paymentTypeId: z.string().cuid().optional(),
});

export const eventSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  date: z.coerce.date(),
  amountCents: moneyCentsSchema.refine((v) => v > 0, "Amount must be greater than zero"),
  categoryIds: z
    .array(z.string().cuid())
    .min(1, "Select at least one category/class"),
});

export const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
});

export const createInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER", "TEACHER", "RECEPTIONIST"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  // Only required when the accepting browser has no existing session —
  // the route itself enforces that, this schema just allows both shapes.
  name: z.string().trim().min(1).max(200).optional(),
  password: passwordSchema.optional(),
});

export const createPlatformInviteSchema = z.object({
  email: emailSchema,
});

export const acceptPlatformInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  password: passwordSchema.optional(),
});

// Treats "" the same as not provided for every optional profile field below,
// so clearing a field in the form (rather than leaving it untouched) saves
// as null instead of an empty string.
const emptyStringToUndefined = (v: unknown) => (v === "" ? undefined : v);

// An uploaded logo/letterhead, as a base64 data: URL — see Organization's
// logoImage/letterheadImage comment for why this is stored directly rather
// than in separate blob storage. The upload UI (general/page.tsx) always
// resizes/re-compresses an image client-side before it ever reaches this
// schema — this max is a server-side safety net for that, not something a
// person is expected to hit or work around themselves.
const imageDataUrlSchema = z
  .string()
  .trim()
  .regex(
    /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/,
    "That doesn't look like an image file."
  )
  .max(1_400_000, "Image is too large. Please try uploading it again.");

export const organizationProfileSchema = z.object({
  name: organizationNameSchema,
  addressLine1: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  addressLine2: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  province: z.preprocess(emptyStringToUndefined, z.string().trim().max(100).optional()),
  // null explicitly clears an uploaded image (the "Remove" button);
  // undefined/omitted leaves whatever's already stored untouched.
  logoImage: z.preprocess(emptyStringToUndefined, imageDataUrlSchema.optional().nullable()),
  letterheadImage: z.preprocess(emptyStringToUndefined, imageDataUrlSchema.optional().nullable()),
  contactName: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  contactEmail: z.preprocess(emptyStringToUndefined, emailSchema.optional()),
  contactPhone: z.preprocess(emptyStringToUndefined, z.string().trim().max(40).optional()),
  bankName: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  // Never validated as numeric-only: real account numbers can carry
  // branch/IBAN-style formatting depending on country.
  bankAccountNumber: z.preprocess(emptyStringToUndefined, z.string().trim().max(64).optional()),
  timezone: z.string().trim().min(1).max(100),
});

// Phase 2 (centre management) child profile fields -- separate from
// childSchema above (which stays the Accounting-side create/edit form).
// dateOfBirth/photoImage/photoConsentGiven are all optional at the schema
// level; the API route enforces the actual rule ("can't set/change a
// photo without consent") since that's a cross-field check, not something
// zod expresses cleanly here.
export const childProfileSchema = z.object({
  dateOfBirth: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  photoImage: z.preprocess(emptyStringToUndefined, imageDataUrlSchema.optional().nullable()),
  photoConsentGiven: z.boolean().optional(),
});

// A child's parent/guardian, mirroring the paper enrolment form. See the
// Guardian model comment in schema.prisma for why this is a separate
// table from Child.parentName/parentPhone/parentEmail.
export const guardianSchema = z.object({
  relationship: z.string().trim().min(1, "Relationship is required").max(100),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  idNumber: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  occupation: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  // Looser than phoneE164Schema deliberately -- this is a paper-form
  // contact field for the centre-management profile, not a number the
  // billing/reminders system will text or call programmatically.
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  email: z.preprocess(emptyToUndefined, emailSchema.optional()),
  photoImage: z.preprocess(emptyStringToUndefined, imageDataUrlSchema.optional().nullable()),
});

export const guardianUpdateSchema = guardianSchema.partial();

export const deletionRequestSchema = z.object({
  targetType: z.enum(["CATEGORY", "CHILD", "PAYMENT"]),
  targetId: z.string().cuid(),
  // Not optional — every deletion request must say why, per the org
  // owner's explicit instruction ("the user has to give a reason why they
  // are deleting this is not optional").
  reason: z
    .string()
    .trim()
    .min(1, "Please explain why this is being deleted.")
    .max(500, "Keep the reason under 500 characters."),
});

// The three placeholder tokens below are enforced here (not just as a UI
// hint) because this schema is what actually gets saved and later used to
// build every outbound reminder — see reminderTemplates.ts, which owns the
// canonical placeholder list so this can't silently drift out of sync
// with it.
export const reminderTemplateSchema = z.object({
  template: z
    .string()
    .trim()
    .min(1, "The message can't be empty.")
    .max(2000, "Keep the message under 2000 characters.")
    .refine(
      (t) => t.includes("{{childName}}") && t.includes("{{parentName}}") && t.includes("{{amount}}"),
      "The message must include {{childName}}, {{parentName}}, and {{amount}}."
    ),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const registerSchema = z.object({
  organizationName: organizationNameSchema,
  countryCode: countryCodeSchema,
  currencyCode: z.string().trim().toUpperCase().length(3),
  adminName: z.string().trim().min(1).max(200),
  email: emailSchema,
  password: passwordSchema,
});

// Public testimonial submission (no login required) — see Testimonial in
// schema.prisma. "website" is a honeypot: real visitors never see or fill
// this field (hidden via CSS in the form), so anything filling it in is
// almost certainly a bot and gets silently dropped rather than told why,
// same principle as forgotPasswordSchema's generic response above.
export const testimonialSubmissionSchema = z.object({
  authorName: z.string().trim().min(2, "Enter your name").max(120),
  schoolName: z.string().trim().max(200).optional().or(z.literal("")),
  quote: z
    .string()
    .trim()
    .min(20, "A few sentences helps — at least 20 characters")
    .max(1000, "Keep it under 1000 characters"),
  website: z.string().max(0, "").optional().or(z.literal("")),
});
