import { z } from "zod";

// In-app updates for the Android app (Dylan, 9 Oct 2026: "they will say new
// update available and when you click update it downloads directly from
// that app"). The app isn't in the Play Store, so the platform owner
// uploads each new APK to the private R2 bucket from /platform/app-updates,
// and a small app/latest.json next to it says which version is newest.
// No database table: there is only ever one "latest".

export const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
export const LATEST_RELEASE_KEY = "app/latest.json";
/** An APK is ~4 MB today; this is only a backstop. */
export const MAX_APK_BYTES = 100 * 1024 * 1024;

export type AppRelease = {
  versionCode: number;
  versionName: string;
  notes: string | null;
  key: string;
  sizeBytes: number;
  publishedAt: string;
};

export const releaseSchema = z.object({
  versionCode: z.coerce.number().int().min(1, "Version code must be 1 or more.").max(2_100_000_000),
  versionName: z.string().trim().min(1, "Give the version a name, e.g. 1.1.0.").max(40),
  notes: z.string().trim().max(500, "Keep the notes under 500 characters.").optional().or(z.literal("")),
});

export function apkKey(versionCode: number): string {
  return `app/crechely-${versionCode}.apk`;
}

/** True when `latest` is newer than the app version a tablet reports. */
export function isUpdateAvailable(latest: Pick<AppRelease, "versionCode"> | null, installedVersionCode: number): boolean {
  return !!latest && Number.isFinite(installedVersionCode) && latest.versionCode > installedVersionCode;
}

/** A new upload must have a higher version code, or tablets would never see it as an update. */
export function checkNewVersionCode(latest: Pick<AppRelease, "versionCode"> | null, versionCode: number): string | null {
  if (latest && versionCode <= latest.versionCode) {
    return `Version code must be higher than the current one (${latest.versionCode}). Bump versionCode in android/app/build.gradle.kts and rebuild.`;
  }
  return null;
}
