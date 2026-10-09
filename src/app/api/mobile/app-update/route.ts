import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/apiError";
import { getJson, signView, storageConfigured } from "@/lib/storage";
import { LATEST_RELEASE_KEY, isUpdateAvailable, type AppRelease } from "@/lib/appRelease";

// The Android app asks "is there a newer version than mine?" (see
// AppUpdateBanner). Any signed-in user may ask; the answer carries a
// download link that expires in a few minutes, so the APK itself stays
// private in the bucket.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!storageConfigured()) return NextResponse.json({ available: false });

    const installed = Number(req.nextUrl.searchParams.get("versionCode"));
    const latest = await getJson<AppRelease>(LATEST_RELEASE_KEY);
    if (!latest || !isUpdateAvailable(latest, installed)) return NextResponse.json({ available: false });

    return NextResponse.json({
      available: true,
      versionCode: latest.versionCode,
      versionName: latest.versionName,
      notes: latest.notes,
      sizeBytes: latest.sizeBytes,
      downloadUrl: await signView(latest.key),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
