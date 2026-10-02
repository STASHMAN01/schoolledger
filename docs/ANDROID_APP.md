# Crechely on Android (phones and tablets)

The Android app is **the website, installed**. It opens https://www.crechely.co.za
full-screen, so it is always exactly the app you see in the browser: when we
deploy a change to the site, every installed phone and tablet has it the next
time it is opened. There is nothing to rebuild or re-send per update.

Three steps. Step 1 is done in the code; steps 2 and 3 are yours.

## Step 1: Install from Chrome (free, works as soon as this is deployed)

Needs the site to be live with the manifest (push to `main`, wait for Vercel).

1. On the phone or tablet, open Chrome and go to `crechely.co.za`.
2. Menu (three dots) > **Install app** (or **Add to Home screen**).
3. Open **Crechely** from the home screen. It opens full-screen with the duck icon.

It starts on the login screen when signed out, and on the dashboard when signed in.
No internet shows a "You're offline" screen with a Try again button.

Check logged out first: `https://www.crechely.co.za/manifest.webmanifest`,
`/sw.js` and `/offline.html` must all open without sending you to login.

## Step 2: Make an APK to install without the Play Store (free)

The Play Store costs $25 once, so for now the app is packaged as a file you
send to the tablets. The Android SDK needed to build it can't be reached from
Claude's workspace, so this step is done on your side. The easiest way:

1. Go to **pwabuilder.com**, enter `https://www.crechely.co.za`, press Start.
2. When the report finishes, choose **Package for stores > Android**.
3. Use these settings (labels vary slightly):
   - Package ID: `za.co.crechely.app`
   - App name / short name: `Crechely`
   - Start URL: `/dashboard`
   - Signing key: **Create new**
4. Press Generate and download the zip. It contains the `.apk` (to install),
   the `.aab` (for the Play Store later), `signing.keystore` and
   `signing-key-info.txt`.
5. **Keep the keystore and its passwords safe** (a password manager plus one
   copy off your laptop). The Play Store version must be signed with the same
   key; if it is lost, installed apps can't be updated and the Play listing
   can't be continued.
6. Find the SHA-256 fingerprint (`signing-key-info.txt`, or
   `keytool -list -v -keystore signing.keystore`) and, from the project folder, run:

   ```
   node scripts/set-assetlinks.mjs za.co.crechely.app <SHA-256 fingerprint>
   ```

   This writes `public/.well-known/assetlinks.json`. Commit and push it. Without
   it the app still works but shows a browser address bar at the top.
7. Send the `.apk` to the tablet (WhatsApp, Google Drive, or a cable). Tap it
   and allow "Install unknown apps" for that app when Android asks.

## Step 3: Play Store (next month)

1. Pay the $25 developer fee and create the app in Play Console.
2. Upload the **same** `.aab`, signed with the **same** key.
3. If you let Play manage signing ("Play App Signing", the default), Google
   re-signs the app with its own key. Copy that key's SHA-256 from Play Console
   (Setup > App signing) and add it as a second fingerprint:

   ```
   node scripts/set-assetlinks.mjs za.co.crechely.app <your fingerprint> <Google's fingerprint>
   ```

## Tablet setup for teachers (no code needed)

- Turn on **screen pinning** so a tablet stays on Crechely: Settings > Security
  (or Biometrics and security > Other security settings) > App pinning / Pin
  windows. Open Crechely, open Recent apps, tap the Crechely icon > Pin this app.
  A free kiosk launcher also works if you want it locked down fully.
- Logins last 12 hours when idle (`maxAge` in `src/lib/auth.ts`), so teachers
  log in once each morning. Whether Teacher accounts should stay signed in
  longer is still your decision.
- Nothing from a signed-in session is stored on the device. Only the offline
  screen is cached (`public/sw.js`), because tablets are shared and hold
  children's information.

## What it does not do

- It needs internet. Taking the register offline and syncing later is a bigger
  piece of work; build it only if Wi-Fi at the school actually drops.
- No push notifications yet.
