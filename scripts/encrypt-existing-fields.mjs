// Encrypts the sensitive fields of rows written BEFORE field encryption
// existed (security review #15/#21, 7 Oct 2026). New writes are already
// encrypted by src/lib/encryptedFields.ts; this catches up the old ones.
//
// Run it ONLY after:
//   1. the database is on a paid plan with backups, and a fresh pg_dump exists;
//   2. this branch is deployed (so the app can read encrypted values);
//   3. FIELD_ENCRYPTION_KEY in your .env is EXACTLY the one in Vercel
//      (a different key = data nobody can read).
//
//   node --env-file=.env scripts/encrypt-existing-fields.mjs            # dry run: counts only
//   node --env-file=.env scripts/encrypt-existing-fields.mjs --apply    # encrypt
//
// Safe to run again: values that are already encrypted ("enc:v1:...") are
// skipped. Each row is updated on its own; stopping half-way is fine. The
// field list must match ENCRYPTED_FIELDS in src/lib/encryptedFields.ts.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const PREFIX = "enc:v1:";
const FIELDS = {
  child: ["childIdNumber", "parentIdNumber", "allergies"],
  guardian: ["idNumber"],
  childDocument: ["fileData"],
  parentSubmission: ["data"],
  parentSubmissionAttachment: ["image"],
  medicineRecord: ["medicineName", "reason", "prescriberName", "lastDoseAtHome", "specialInstructions", "signatureImage"],
  medicineDose: ["note"],
};
// Rows with big files (photos, PDFs) are fetched a few at a time.
const BATCH = { childDocument: 10, parentSubmissionAttachment: 10, medicineRecord: 25 };

const apply = process.argv.includes("--apply");

const keyB64 = process.env.FIELD_ENCRYPTION_KEY;
const key = keyB64 ? Buffer.from(keyB64, "base64") : null;
if (!key || key.length !== 32) {
  console.error("FIELD_ENCRYPTION_KEY is missing or not 32 bytes. Copy it from Vercel into .env first.");
  process.exit(1);
}

// Same format as src/lib/fieldCrypto.ts: base64(iv):base64(tag):base64(ciphertext)
function seal(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64")).join(":");
}
function open(stored) {
  const [iv, tag, ct] = stored.slice(PREFIX.length).split(":");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}

// Prove the key can read what the app already wrote before touching anything.
const db = new PrismaClient();
try {
  for (const [model, fields] of Object.entries(FIELDS)) {
    for (const field of fields) {
      const sample = await db[model].findFirst({
        where: { [field]: { startsWith: PREFIX } },
        select: { [field]: true },
      });
      if (sample) {
        try {
          open(sample[field]);
        } catch {
          console.error(`FIELD_ENCRYPTION_KEY can't decrypt existing ${model}.${field} values. Wrong key: stopping.`);
          process.exit(1);
        }
      }
    }
  }

  let total = 0;
  for (const [model, fields] of Object.entries(FIELDS)) {
    const select = { id: true, ...Object.fromEntries(fields.map((f) => [f, true])) };
    const take = BATCH[model] ?? 200;
    let cursor;
    let modelCount = 0;
    for (;;) {
      const rows = await db[model].findMany({
        select,
        take,
        orderBy: { id: "asc" },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        const data = {};
        for (const f of fields) {
          const v = row[f];
          if (typeof v === "string" && v !== "" && !v.startsWith(PREFIX)) data[f] = seal(v);
        }
        if (Object.keys(data).length > 0) {
          modelCount++;
          if (apply) await db[model].update({ where: { id: row.id }, data });
        }
      }
      cursor = rows[rows.length - 1].id;
    }
    total += modelCount;
    console.log(`${model.padEnd(28)} ${modelCount} row(s) ${apply ? "encrypted" : "to encrypt"}`);
  }
  console.log(apply ? `Done: ${total} row(s) encrypted.` : `Dry run: ${total} row(s) would be encrypted. Re-run with --apply.`);
} finally {
  await db.$disconnect();
}
