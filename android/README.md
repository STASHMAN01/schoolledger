# Crechely Android app

The real Crechely website inside a native Android shell, so it always looks and works like the web app. The native part adds what a website cannot do: push notifications when the app is closed, really loud alarms, sharing files, file uploads and an offline page.

Package: `za.co.crechely.app`. Website address is set in `app/build.gradle.kts` (`BASE_URL`). Only crechely.co.za opens inside the app; other links open in the tablet's browser.

No child data is stored on the tablet. Downloaded files go to the app cache only to open or share, and only the latest is kept. Sign-in is the normal website login.

## Build it (Android Studio, on the laptop)
1. Open Android Studio > Open > pick the `android` folder in this repo. Let it sync.
2. Build > Generate App Bundles or APKs > Generate APKs to get `app-debug.apk`, copy it to the tablet.
3. If an older Crechely app is installed, uninstall it first.

## Turn on push notifications (one time, free)
1. https://console.firebase.google.com > Add project (name it Crechely).
2. Add app > Android, package `za.co.crechely.app`. Download `google-services.json` into `android/app/` (git-ignored). Rebuild the app.
3. Project settings > Service accounts > Generate new private key. Copy ALL of the JSON into Vercel as `FIREBASE_SERVICE_ACCOUNT`. Redeploy.
4. `CRON_SECRET` must already exist in Vercel.
5. The `PushDevice` table must exist: SQL in docs/PROGRESS.md (7 Oct entry), applied with `npx prisma db push`.

## Alarms
Open the menu > Alarms (only visible inside the app). They are stored on the tablet and ring with no internet. The alarm plays the alarm sound on the alarm volume at maximum, vibrates, and shows a full-screen Stop button over the lock screen, for up to 5 minutes. For best results turn off battery saving for Crechely. The server also pushes an alarm weekdays at 08:30 SA time to teachers whose register isn't taken (`/api/cron/todo-alerts`).
