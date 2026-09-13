import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Application-layer encryption for the small number of fields that are
// sensitive but need to be recovered in plaintext later (currently: bank
// account number, printed on statements). Everything else sensitive
// (passwords) is hashed, not encrypted, because it never needs to be
// recovered — see password.ts.
//
// AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
// decrypt rather than silently returning garbage.
//
// FIELD_ENCRYPTION_KEY must be a 32-byte key, base64-encoded, kept only in
// the deployment environment's secrets (never in git, never logged). Losing
// this key makes encrypted data permanently unrecoverable — back it up
// alongside (not inside) the database backup, in a password manager or
// secrets vault, not in a text file next to the code.

function getKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and set it in your environment before storing any encrypted field."
    );
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return buf;
}

// Stored format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptField(stored: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted field value.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
