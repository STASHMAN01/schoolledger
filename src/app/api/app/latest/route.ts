import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/apiError";
import { getJson, signView, storageConfigured } from "@/lib/storage";
import { LATEST_RELEASE_KEY, type AppRelease } from "@/lib/appRelease";

// The newest published Android app, for the dashboard's Updates page
// (Dylan, 9 Oct 2026: "i would go to the updates section in any role and
// account ... and download the app"). Any signed-in user, any role; the
// download link expires in a few minutes so the APK stays private.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!storageConfigured()) return NextResponse.json({ latest: null, downloadUrl: null });

    const latest = await getJson<AppRelease>(LATEST_RELEASE_KEY);
    if (!latest) return NextResponse.json({ latest: null, downloadUrl: null });

    return NextResponse.json({
      latest: {
        versionCode: latest.versionCode,
        versionName: latest.versionName,
        notes: latest.notes,
        sizeBytes: latest.sizeBytes,
        publishedAt: latest.publishedAt,
      },
      downloadUrl: await signView(latest.key, { downloadName: `Crechely-${latest.versionName}.apk` }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
