# Crechely Android app

A real (native Kotlin + Jetpack Compose) app, separate from the website. The screens are built into the app, so it opens fast and only fetches data from the server. Notifications and alarms work while the app is closed.

Package: `za.co.crechely.app`. Server address is set in `app/build.gradle.kts` (`BASE_URL`).

## What is in it (phase 1)
Sign-in (stays signed in for 60 days, revocable) · To-do · Register (take attendance) · Children (search, Quick add) · Files (open and share statements and documents) · Alarms (loud, set on the tablet, work offline) · Push notifications from the server (needs Firebase, below).

No child data is stored on the tablet. The sign-in token is kept encrypted. Documents are downloaded to the app's cache only to open or share, and only the latest one is kept.

## Build it (Android Studio, on the laptop)
1. Open Android Studio > Open > pick the `android` folder in this repo. Let it sync (it downloads Gradle and libraries the first time).
2. Plug in a tablet (Developer options > USB debugging on) and press Run. Or Build > Build APK(s) to get `app/build/outputs/apk/debug/app-debug.apk` and copy it to the tablet.
3. If the old "shortcut" Crechely app is installed, uninstall it first (same package name, different signing key).

## Turn on push notifications (one time, free)
1. https://console.firebase.google.com > Add project (name it Crechely; analytics off is fine).
2. Project overview > Add app > Android. Package name `za.co.crechely.app`. Download `google-services.json` and put it in `android/app/`. (It is git-ignored.) Rebuild the app.
3. Project settings > Service accounts > Generate new private key. Open the downloaded JSON, copy ALL of it, and add it in Vercel as an environment variable named `FIREBASE_SERVICE_ACCOUNT`. Redeploy.
4. `CRON_SECRET` must already exist in Vercel (the other crons use it).

Until step 3 is done the server skips sending, and the alarms you set on the tablet keep working.

## How the alarm works
It plays the tablet's alarm sound on the alarm volume, turns that volume to maximum, vibrates, and shows a full-screen Stop button over the lock screen. It rings until Stop is tapped, or for 5 minutes. Tablet speakers still have a hardware limit. For best results turn off battery saving for Crechely.

## Server side
- `POST /api/mobile/login` gives the app a token. `GET /api/mobile/me` lists schools and permissions. `PUT/DELETE /api/mobile/device` registers a push token / signs out.
- Every other call is the same school API the website uses, with `Authorization: Bearer <token>`.
- `GET /api/cron/todo-alerts` (weekdays 08:30 SA time, vercel.json) pushes an alarm to teachers whose register isn't taken.
- Needs the `MobileDevice` table: see the SQL in docs/PROGRESS.md (6-7 Oct entry), then `npx prisma db push`.
