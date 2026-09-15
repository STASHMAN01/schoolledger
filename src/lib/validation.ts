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
  role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER"]),
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

export const organizationProfileSchema = z.object({
  name: organizationNameSchema,
  addressLine1: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  addressLine2: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  province: z.preprocess(emptyStringToUndefined, z.string().trim().max(100).optional()),
  logoUrl: z.preprocess(emptyStringToUndefined, z.string().trim().url("Enter a valid URL").max(2000).optional()),
  letterheadUrl: z.preprocess(emptyStringToUndefined, z.string().trim().url("Enter a valid URL").max(2000).optional()),
  bankName: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  // Never validated as numeric-only: real account numbers can carry
  // branch/IBAN-style formatting depending on country.
  bankAccountNumber: z.preprocess(emptyStringToUndefined, z.string().trim().max(64).optional()),
  timezone: z.string().trim().min(1).max(100),
});

export const registerSchema = z.object({
  organizationName: organizationNameSchema,
  countryCode: countryCodeSchema,
  currencyCode: z.string().trim().toUpperCase().length(3),
  adminName: z.string().trim().min(1).max(200),
  email: emailSchema,
  password: passwordSchema,
});
