// File storage (Cloudflare R2, 8 Oct 2026).
//
// Photos and documents do NOT belong in Postgres: the old child-document
// rows keep the file itself as base64 text in the database, which is why
// uploads are capped at 2 MB and why the database grows so fast. Everything
// new goes to an object store instead; the database only remembers the key.
//
// R2 speaks the S3 protocol, so this is the standard AWS SDK pointed at
// Cloudflare. The bucket is private: the tablet uploads with a signed link
// that lasts a few minutes, and viewing goes through our own permission
// check which then hands out another short-lived signed link. Nothing is
// ever public, which matters because these are children's ID copies and
// injury photos (POPIA).
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_SECONDS = 5 * 60;
const VIEW_URL_SECONDS = 5 * 60;

/** What the tablet is allowed to send. */
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type UploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/** 10 MB: photos are shrunk on the tablet first, so this is only a backstop. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function isAllowedUploadType(value: string): value is UploadType {
  return (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(value);
}

export function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

type Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

function config(): Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** False until the four R2 environment variables are set in Vercel. */
export function storageConfigured(): boolean {
  return config() !== null;
}

let cached: { client: S3Client; bucket: string } | null = null;

function client(): { client: S3Client; bucket: string } {
  const c = config();
  if (!c) throw new StorageNotConfiguredError();
  if (!cached) {
    cached = {
      bucket: c.bucket,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      }),
    };
  }
  return cached;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("File storage isn't set up yet.");
    this.name = "StorageNotConfiguredError";
  }
}

/** Where a file lives in the bucket. Organisation first, so one school's files are easy to find or remove. */
export function buildKey(organizationId: string, kind: string, fileId: string, contentType: string): string {
  return `org/${organizationId}/${kind.toLowerCase()}/${fileId}.${extensionFor(contentType)}`;
}

/** A link the tablet can PUT the file to, valid for a few minutes. */
export async function signUpload(key: string, contentType: string): Promise<string> {
  const { client: s3, bucket } = client();
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_SECONDS,
  });
}

/** A link to view or download the file, valid for a few minutes. */
export async function signView(key: string, options: { downloadName?: string } = {}): Promise<string> {
  const { client: s3, bucket } = client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(options.downloadName
        ? { ResponseContentDisposition: `attachment; filename="${options.downloadName.replace(/"/g, "")}"` }
        : {}),
    }),
    { expiresIn: VIEW_URL_SECONDS }
  );
}

/** Confirms the upload actually arrived, and how big it is. Null if it isn't there. */
export async function statObject(key: string): Promise<{ sizeBytes: number; contentType: string } | null> {
  const { client: s3, bucket } = client();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      sizeBytes: Number(head.ContentLength ?? 0),
      contentType: head.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client: s3, bucket } = client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
}
