import { randomInt } from "crypto";

// Pure helpers for the full-data backup (Phase 4). Kept free of any db /
// Prisma import so they can be unit tested without a database.

// No 0/O/o, 1/l/I -- the password is read off a screen and typed into
// 7-Zip by hand, so every ambiguous glyph is left out.
export const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const PASSWORD_LENGTH = 16;

export function generateBackupPassword(length = PASSWORD_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    // randomInt is CSPRNG-backed and unbiased (no modulo skew).
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

// Same cleaning rule as buildStatementFilename: decompose, strip accents,
// collapse anything outside [A-Za-z0-9] to single hyphens, trim hyphens.
export function sanitizeFilePart(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Last 6 characters of a cuid -- the first characters are timestamp-ish
// and near-identical between rows created around the same time.
export function shortId(id: string): string {
  return id.slice(-6);
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export function extForMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "bin";
}

/**
 * Decodes a `data:<mime>;base64,<payload>` URL. Returns null (never throws)
 * for anything malformed, so one corrupt stored image can't fail a whole
 * backup -- the caller counts the skip instead.
 */
export function decodeDataUrl(value: string | null | undefined): { mime: string; ext: string; bytes: Buffer } | null {
  if (!value) return null;
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value.trim());
  if (!m) return null;
  const payload = m[2].replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) return null;
  return { mime: m[1], ext: extForMime(m[1]), bytes };
}

// "MEDICAL_ALLERGY" -> "Medical-Allergy"
export function formTypeLabel(formType: string): string {
  return formType
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function childFolderName(child: { id: string; firstName: string; lastName: string }): string {
  const parts = [sanitizeFilePart(child.lastName), sanitizeFilePart(child.firstName), shortId(child.id)].filter(Boolean);
  return parts.join("-");
}

export function backupFilename(schoolName: string, at: Date = new Date()): string {
  const slug = sanitizeFilePart(schoolName).toLowerCase() || "school";
  return `crechely-backup-${slug}-${isoDate(at)}.zip`;
}
