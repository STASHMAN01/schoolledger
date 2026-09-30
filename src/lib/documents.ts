import { z } from "zod";

// Documents a school keeps on file for each child (Dylan, 30 Sept 2026).
// A school chooses which are REQUIRED (Organization.requiredDocuments);
// the default is the three every creche asks for. Missing required
// documents show on the Centre dashboard, the child's profile and the
// "Missing documents" page, and parents can upload them through a link.
//
// `perGuardian` documents are needed once for every parent/guardian on
// file (an ID for each); the rest are needed once per child.

export type DocumentTypeDef = {
  type: string;
  label: string;
  hint: string;
  perGuardian?: boolean;
};

export const DOCUMENT_TYPES: DocumentTypeDef[] = [
  { type: "BIRTH_CERTIFICATE", label: "Birth certificate", hint: "The child's birth certificate (unabridged if you have it)." },
  {
    type: "CLINIC_CARD",
    label: "Clinic card",
    hint: "Road to Health booklet or clinic card showing immunisations.",
  },
  {
    type: "GUARDIAN_ID",
    label: "Parent/guardian ID",
    hint: "ID document, smart ID card or passport for each parent/guardian.",
    perGuardian: true,
  },
  { type: "PROOF_OF_ADDRESS", label: "Proof of address", hint: "A utility bill or bank statement from the last 3 months." },
  { type: "MEDICAL_AID_CARD", label: "Medical aid card", hint: "Front of the medical aid card, if the child is on one." },
  {
    type: "HEALTH_CERTIFICATE",
    label: "Doctor's health certificate",
    hint: "A letter from a doctor or clinic that the child is healthy enough to attend.",
  },
  {
    type: "CUSTODY_ORDER",
    label: "Custody or court order",
    hint: "Only if a court order says who may or may not collect the child.",
  },
  {
    type: "SIGNED_ENROLMENT_FORM",
    label: "Signed enrolment/indemnity form",
    hint: "The school's enrolment agreement, signed by a parent.",
  },
];

export const DOCUMENT_TYPE_KEYS = DOCUMENT_TYPES.map((d) => d.type);
export const DEFAULT_REQUIRED_DOCUMENTS = ["BIRTH_CERTIFICATE", "CLINIC_CARD", "GUARDIAN_ID"];

export function documentTypeDef(type: string): DocumentTypeDef | undefined {
  return DOCUMENT_TYPES.find((d) => d.type === type);
}

export function documentLabel(type: string): string {
  return documentTypeDef(type)?.label ?? type;
}

/** Only known types, in catalogue order, no duplicates. */
export function normaliseRequired(types: readonly string[] | null | undefined): string[] {
  const set = new Set(types ?? []);
  return DOCUMENT_TYPE_KEYS.filter((t) => set.has(t));
}

export type MissingDocument = {
  type: string;
  label: string;
  /** Set for a per-guardian document: whose document is missing. */
  guardianId?: string;
  guardianName?: string;
};

type GuardianLite = { id: string; firstName: string; lastName: string };
type DocLite = { type: string; guardianId: string | null };

/**
 * What a child is still missing. A per-guardian document counts as on file
 * for a guardian only when it is linked to that guardian; a child with no
 * guardians on file still needs one "Parent/guardian ID".
 */
export function missingDocuments(
  guardians: GuardianLite[],
  documents: DocLite[],
  required: readonly string[]
): MissingDocument[] {
  const missing: MissingDocument[] = [];
  for (const type of normaliseRequired(required)) {
    const def = documentTypeDef(type)!;
    const ofType = documents.filter((d) => d.type === type);
    if (def.perGuardian) {
      if (guardians.length === 0) {
        if (ofType.length === 0) missing.push({ type, label: def.label });
        continue;
      }
      for (const g of guardians) {
        if (!ofType.some((d) => d.guardianId === g.id)) {
          const name = `${g.firstName} ${g.lastName}`.trim();
          missing.push({ type, label: `${def.label} (${name})`, guardianId: g.id, guardianName: name });
        }
      }
    } else if (ofType.length === 0) {
      missing.push({ type, label: def.label });
    }
  }
  return missing;
}

// An uploaded document as a data: URL -- a photo (already shrunk in the
// browser) or a PDF. One document per request, so this stays well under
// the hosting request-size limit.
export const MAX_DOCUMENT_DATA_URL_CHARS = 3_000_000;

export const documentFileSchema = z
  .string()
  .trim()
  .regex(
    /^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,[A-Za-z0-9+/]+=*$/,
    "Upload a photo (JPG or PNG) or a PDF."
  )
  .max(MAX_DOCUMENT_DATA_URL_CHARS, "That file is too large. Take a photo instead, or use a PDF under 2 MB.");

export const documentUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_KEYS as [string, ...string[]]),
  guardianId: z.string().cuid().optional(),
  // Position of the parent in a form that hasn't created guardians yet.
  guardianIndex: z.number().int().min(0).max(5).optional(),
  fileName: z.string().trim().max(200).optional(),
  file: documentFileSchema,
});

export const requiredDocumentsSchema = z.object({
  requiredDocuments: z.array(z.enum(DOCUMENT_TYPE_KEYS as [string, ...string[]])).max(DOCUMENT_TYPES.length),
});

/** "data:application/pdf;base64,...." -> { contentType, bytes }. */
export function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  return { contentType: m[1], bytes: Buffer.from(m[2], "base64") };
}

export function contentTypeOf(dataUrl: string): string {
  return /^data:([^;]+);/.exec(dataUrl)?.[1] ?? "application/octet-stream";
}
