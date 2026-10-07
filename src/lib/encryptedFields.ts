import { Prisma } from "@prisma/client";
import { decryptField, encryptField } from "@/lib/fieldCrypto";

// Encryption at rest for the most sensitive columns (security review #15
// and #21, 7 Oct 2026): ID numbers, ID-document photos, parents' online
// form answers, children's allergies and the medicine register. Anyone who
// gets a copy of the database (a leaked backup, a stolen password) sees
// only ciphertext for these; the key (FIELD_ENCRYPTION_KEY) lives only in
// Vercel.
//
// It is transparent to the rest of the app: src/lib/db.ts wraps Prisma with
// encryptionExtension, which
//  - encrypts these fields on every write, including nested writes
//    (child.create({ data: { guardians: { create: [...] } } })), and
//  - decrypts them on every read, including relations pulled in with
//    include/select.
//
// Stored values carry a prefix ("enc:v1:"), so encrypted and old plaintext
// rows can be read side by side. scripts/encrypt-existing-fields.mjs
// encrypts the rows written before this existed.
//
// LIMITS -- read before adding a field here:
//  - A field listed here can't be searched or sorted in the database
//    (where: { idNumber: "..." }, contains, orderBy): every encryption of
//    the same value is different. None of the fields below is queried that
//    way today; checking `not: null` still works.
//  - Raw SQL ($queryRaw) bypasses this entirely.
//  - Losing FIELD_ENCRYPTION_KEY makes these fields unreadable forever.
//    Keep a copy in a password manager, apart from the database backup.

export const ENCRYPTED_PREFIX = "enc:v1:";

/** Model name (as in schema.prisma) -> its encrypted string fields. */
export const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
  Child: ["childIdNumber", "parentIdNumber", "allergies"],
  Guardian: ["idNumber"],
  ChildDocument: ["fileData"],
  ParentSubmission: ["data"],
  ParentSubmissionAttachment: ["image"],
  MedicineRecord: [
    "medicineName",
    "reason",
    "prescriberName",
    "lastDoseAtHome",
    "specialInstructions",
    "signatureImage",
  ],
  MedicineDose: ["note"],
};

let warnedMissingKey = false;

function keyConfigured(): boolean {
  if (process.env.FIELD_ENCRYPTION_KEY) return true;
  if (!warnedMissingKey) {
    warnedMissingKey = true;
    console.error("[encryptedFields] FIELD_ENCRYPTION_KEY is not set: sensitive fields are being stored UNENCRYPTED.");
  }
  return false;
}

export function isSealed(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/** Encrypt one value for storage. Idempotent; null/undefined/non-strings pass through. */
export function sealValue(value: unknown): unknown {
  if (typeof value !== "string" || value === "" || isSealed(value)) return value;
  if (!keyConfigured()) return value;
  return ENCRYPTED_PREFIX + encryptField(value);
}

/** Decrypt one stored value. Plaintext (old rows) passes through unchanged. */
export function openValue(value: unknown): unknown {
  if (!isSealed(value)) return value;
  return decryptField((value as string).slice(ENCRYPTED_PREFIX.length));
}

// --- write side -----------------------------------------------------------

type ModelInfo = { relations: Map<string, string> };
let modelInfo: Map<string, ModelInfo> | null = null;

function models(): Map<string, ModelInfo> {
  if (modelInfo) return modelInfo;
  modelInfo = new Map();
  for (const m of Prisma.dmmf.datamodel.models) {
    const relations = new Map<string, string>();
    for (const f of m.fields) if (f.kind === "object") relations.set(f.name, f.type);
    modelInfo.set(m.name, { relations });
  }
  return modelInfo;
}

function sealScalar(value: unknown): unknown {
  // Prisma update syntax: { set: "..." }
  if (value && typeof value === "object" && !Array.isArray(value) && "set" in (value as object)) {
    return { ...(value as object), set: sealValue((value as { set: unknown }).set) };
  }
  return sealValue(value);
}

/** Encrypts the listed fields in a `data` object for `model`, recursing into nested writes. */
export function sealData(model: string, data: unknown): unknown {
  if (Array.isArray(data)) return data.map((d) => sealData(model, d));
  if (!data || typeof data !== "object") return data;
  const fields = ENCRYPTED_FIELDS[model] ?? [];
  const relations = models().get(model)?.relations ?? new Map<string, string>();
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (fields.includes(key)) out[key] = sealScalar(value);
    else if (relations.has(key) && value && typeof value === "object") {
      out[key] = sealNestedWrite(relations.get(key)!, value as Record<string, unknown>);
    }
  }
  return out;
}

// The operations inside a relation field: { create, createMany, update, upsert, ... }
function sealNestedWrite(model: string, ops: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ops };
  if ("create" in out) out.create = sealData(model, out.create);
  if ("createMany" in out && out.createMany && typeof out.createMany === "object") {
    const cm = out.createMany as { data?: unknown };
    out.createMany = { ...cm, data: sealData(model, cm.data) };
  }
  if ("connectOrCreate" in out) {
    out.connectOrCreate = mapOneOrMany(out.connectOrCreate, (c) => ({ ...c, create: sealData(model, c.create) }));
  }
  if ("update" in out) {
    // To-one: the data itself, or { where, data }. To-many: [{ where, data }].
    out.update = mapOneOrMany(out.update, (u) => ("data" in u && "where" in u ? { ...u, data: sealData(model, u.data) } : (sealData(model, u) as Record<string, unknown>)));
  }
  if ("updateMany" in out) {
    out.updateMany = mapOneOrMany(out.updateMany, (u) => ({ ...u, data: sealData(model, u.data) }));
  }
  if ("upsert" in out) {
    out.upsert = mapOneOrMany(out.upsert, (u) => ({ ...u, create: sealData(model, u.create), update: sealData(model, u.update) }));
  }
  return out;
}

function mapOneOrMany(
  value: unknown,
  fn: (v: Record<string, unknown>) => Record<string, unknown>
): unknown {
  if (Array.isArray(value)) return value.map((v) => (v && typeof v === "object" ? fn(v) : v));
  if (value && typeof value === "object") return fn(value as Record<string, unknown>);
  return value;
}

/** Applies sealing to a top-level operation's args. Exported for tests. */
export function sealArgs(model: string, operation: string, args: Record<string, unknown>): Record<string, unknown> {
  switch (operation) {
    case "create":
    case "update":
    case "createMany":
    case "createManyAndReturn":
    case "updateMany":
    case "updateManyAndReturn":
      return "data" in args ? { ...args, data: sealData(model, args.data) } : args;
    case "upsert":
      return { ...args, create: sealData(model, args.create), update: sealData(model, args.update) };
    default:
      return args;
  }
}

// --- read side -------------------------------------------------------------

/** Same type out as in, so Prisma's result types stay string / string | null. */
function open<T>(value: T): T {
  return openValue(value) as T;
}

export const encryptionExtension = Prisma.defineExtension({
  name: "encrypted-fields",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model && args && typeof args === "object") {
          return query(sealArgs(model, operation, args as Record<string, unknown>) as typeof args);
        }
        return query(args);
      },
    },
  },
  // Spelled out per field (not generated from ENCRYPTED_FIELDS) so each
  // keeps its real type; encryptedFields.test.ts checks the lists match.
  result: {
    child: {
      childIdNumber: { needs: { childIdNumber: true }, compute: (row) => open(row.childIdNumber) },
      parentIdNumber: { needs: { parentIdNumber: true }, compute: (row) => open(row.parentIdNumber) },
      allergies: { needs: { allergies: true }, compute: (row) => open(row.allergies) },
    },
    guardian: {
      idNumber: { needs: { idNumber: true }, compute: (row) => open(row.idNumber) },
    },
    childDocument: {
      fileData: { needs: { fileData: true }, compute: (row) => open(row.fileData) },
    },
    parentSubmission: {
      data: { needs: { data: true }, compute: (row) => open(row.data) },
    },
    parentSubmissionAttachment: {
      image: { needs: { image: true }, compute: (row) => open(row.image) },
    },
    medicineRecord: {
      medicineName: { needs: { medicineName: true }, compute: (row) => open(row.medicineName) },
      reason: { needs: { reason: true }, compute: (row) => open(row.reason) },
      prescriberName: { needs: { prescriberName: true }, compute: (row) => open(row.prescriberName) },
      lastDoseAtHome: { needs: { lastDoseAtHome: true }, compute: (row) => open(row.lastDoseAtHome) },
      specialInstructions: { needs: { specialInstructions: true }, compute: (row) => open(row.specialInstructions) },
      signatureImage: { needs: { signatureImage: true }, compute: (row) => open(row.signatureImage) },
    },
    medicineDose: {
      note: { needs: { note: true }, compute: (row) => open(row.note) },
    },
  },
});

/** The read-side field list, for the consistency test. */
export const DECRYPTED_RESULT_FIELDS: Record<string, readonly string[]> = {
  Child: ["childIdNumber", "parentIdNumber", "allergies"],
  Guardian: ["idNumber"],
  ChildDocument: ["fileData"],
  ParentSubmission: ["data"],
  ParentSubmissionAttachment: ["image"],
  MedicineRecord: ["medicineName", "reason", "prescriberName", "lastDoseAtHome", "specialInstructions", "signatureImage"],
  MedicineDose: ["note"],
};
