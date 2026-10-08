import { createSign } from "crypto";

// Sends a push notification through Firebase Cloud Messaging (HTTP v1).
// Needs the env var FIREBASE_SERVICE_ACCOUNT: the whole JSON key file from
// Firebase console > Project settings > Service accounts. Written with
// Node's own crypto so no extra package is needed.
//
// The message is a DATA message (no "notification" block) so the app always
// gets to run its own code, which is what lets it ring a loud alarm even
// when it is closed.

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export function loadServiceAccount(raw = process.env.FIREBASE_SERVICE_ACCOUNT): ServiceAccount | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (j.project_id && j.client_email && j.private_key) return j as ServiceAccount;
  } catch {
    // fall through
  }
  return null;
}

export function signServiceJwt(sa: ServiceAccount, nowSeconds: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claims = b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  });
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key).toString("base64url");
  return `${head}.${claims}.${sig}`;
}

let cached: { token: string; until: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signServiceJwt(sa, Math.floor(Date.now() / 1000)),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) throw new Error(`Firebase sign-in failed (${res.status})`);
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3000) * 1000 };
  return body.access_token;
}

export type PushResult = "sent" | "invalid-token" | "failed" | "not-configured";

export async function sendPush(
  fcmToken: string,
  message: { title: string; body: string; alarm?: boolean; screen?: string; channel?: "sales" }
): Promise<PushResult> {
  const sa = loadServiceAccount();
  if (!sa) {
    // Either FIREBASE_SERVICE_ACCOUNT is missing, or it isn't the whole
    // JSON key file (a common paste mistake). Logged so it isn't silent.
    console.warn(
      process.env.FIREBASE_SERVICE_ACCOUNT
        ? "[push] FIREBASE_SERVICE_ACCOUNT is set but isn't a valid service-account JSON key"
        : "[push] FIREBASE_SERVICE_ACCOUNT is not set; push skipped"
    );
    return "not-configured";
  }
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          data: {
            title: message.title,
            body: message.body,
            alarm: message.alarm ? "1" : "0",
            screen: message.screen ?? "todos",
            ...(message.channel ? { channel: message.channel } : {}),
          },
          android: { priority: "HIGH", ttl: "7200s" },
        },
      }),
    });
    if (res.ok) {
      console.log(`[push] sent "${message.title}" to token …${fcmToken.slice(-6)}`);
      return "sent";
    }
    // Google's error body says exactly why (wrong project, API disabled,
    // bad token...). The token tail only, never the whole token.
    const detail = await res.text().catch(() => "");
    console.error(`[push] FCM rejected send to …${fcmToken.slice(-6)}: ${res.status} ${detail.slice(0, 500)}`);
    // 404 UNREGISTERED / 400 INVALID_ARGUMENT: the app was uninstalled.
    return res.status === 404 || res.status === 400 ? "invalid-token" : "failed";
  } catch (err) {
    console.error("[push] send threw:", err instanceof Error ? err.message : err);
    return "failed";
  }
}
