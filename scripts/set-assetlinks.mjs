// Writes public/.well-known/assetlinks.json, the file that proves the
// Android app belongs to crechely.co.za (so it opens full-screen with no
// browser address bar).
//
//   node scripts/set-assetlinks.mjs <package-name> <SHA-256 fingerprint> [more fingerprints...]
//
// e.g. node scripts/set-assetlinks.mjs za.co.crechely.app 14:6D:E9:...:A2
//
// Use the SHA-256 fingerprint of the key the app is signed with (PWABuilder
// shows it, or: keytool -list -v -keystore signing.keystore). Once the app
// is on the Play Store with "Play App Signing", add Google's fingerprint
// as a second argument (Play Console > Setup > App signing).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [pkg, ...fingerprints] = process.argv.slice(2);
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

if (!pkg || fingerprints.length === 0) {
  console.error("Usage: node scripts/set-assetlinks.mjs <package-name> <SHA-256 fingerprint> [more...]");
  process.exit(1);
}
if (!PACKAGE.test(pkg)) {
  console.error(`"${pkg}" is not a valid Android package name (e.g. za.co.crechely.app).`);
  process.exit(1);
}
const cleaned = fingerprints.map((f) => f.trim().toUpperCase().replace(/^SHA-?256:?\s*/i, ""));
for (const f of cleaned) {
  if (!FINGERPRINT.test(f)) {
    console.error(`"${f}" is not a SHA-256 fingerprint (32 pairs of hex digits separated by colons).`);
    process.exit(1);
  }
}

const out = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: cleaned },
  },
];
const file = resolve(dirname(fileURLToPath(import.meta.url)), "../public/.well-known/assetlinks.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${file}`);
