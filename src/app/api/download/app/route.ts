import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { getJson, signView, storageConfigured } from "@/lib/storage";
import { LATEST_RELEASE_KEY, type AppRelease } from "@/lib/appRelease";

// Public download of the newest Crechely Android app (Dylan, 9 Oct 2026:
// "downloadable on the website ... whenever I upload a new update from the
// platform, it overrides the one that is public"). No login. It reads the
// same app/latest.json that /platform/app-updates writes, so publishing a
// new version there changes what this serves immediately -- nothing to
// redeploy. The APK bucket stays private: each visit gets a link that
// expires in a few minutes. Listed in PUBLIC_PATHS.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(`app-download:${clientIp(req.headers)}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many downloads from this connection. Try again in a little while." }, { status: 429 });
  }
  try {
    if (!storageConfigured()) return NextResponse.redirect(new URL("/download", req.url));
    const latest = await getJson<AppRelease>(LATEST_RELEASE_KEY);
    if (!latest) return NextResponse.redirect(new URL("/download", req.url));
    const url = await signView(latest.key, { downloadName: `Crechely-${latest.versionName}.apk` });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[app-download] failed", err);
    return NextResponse.redirect(new URL("/download", req.url));
  }
}
