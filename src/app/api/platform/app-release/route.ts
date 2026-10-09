import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import { getJson, putJson, signUpload, statObject, storageConfigured } from "@/lib/storage";
import {
  APK_CONTENT_TYPE,
  LATEST_RELEASE_KEY,
  MAX_APK_BYTES,
  apkKey,
  checkNewVersionCode,
  releaseSchema,
  type AppRelease,
} from "@/lib/appRelease";

// Publishing a new Android app version (platform owner only). Three steps,
// same shape as photo uploads: POST asks for a signed upload link, the
// browser PUTs the APK straight to R2, then PUT here checks it arrived and
// makes it the latest. See src/lib/appRelease.ts.

function notConfigured() {
  return NextResponse.json({ error: "File storage isn't set up yet." }, { status: 503 });
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    if (!storageConfigured()) return notConfigured();
    return NextResponse.json({ latest: await getJson<AppRelease>(LATEST_RELEASE_KEY) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin();
    if (!storageConfigured()) return notConfigured();
    const body = releaseSchema.extend({ sizeBytes: z.number().int().min(1).max(MAX_APK_BYTES) }).parse(await req.json());
    const latest = await getJson<AppRelease>(LATEST_RELEASE_KEY);
    const problem = checkNewVersionCode(latest, body.versionCode);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const key = apkKey(body.versionCode);
    return NextResponse.json({ uploadUrl: await signUpload(key, APK_CONTENT_TYPE), contentType: APK_CONTENT_TYPE });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requirePlatformAdmin();
    if (!storageConfigured()) return notConfigured();
    const body = releaseSchema.parse(await req.json());
    const latest = await getJson<AppRelease>(LATEST_RELEASE_KEY);
    const problem = checkNewVersionCode(latest, body.versionCode);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const key = apkKey(body.versionCode);
    const stat = await statObject(key);
    if (!stat || stat.sizeBytes === 0) {
      return NextResponse.json({ error: "The APK didn't arrive. Try the upload again." }, { status: 400 });
    }
    const release: AppRelease = {
      versionCode: body.versionCode,
      versionName: body.versionName,
      notes: body.notes || null,
      key,
      sizeBytes: stat.sizeBytes,
      publishedAt: new Date().toISOString(),
    };
    await putJson(LATEST_RELEASE_KEY, release);
    return NextResponse.json({ latest: release });
  } catch (err) {
    return handleApiError(err);
  }
}
