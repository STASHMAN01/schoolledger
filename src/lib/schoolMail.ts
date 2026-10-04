import { sendMail } from "@/lib/mail";

// Email a school sends to its parents (fee reminders), as opposed to
// Crechely's own account email in mail.ts (password resets, invites).
//
// Sent through Resend (resend.com) when RESEND_API_KEY is set (Dylan, 29
// Sept 2026): from "<School name> <school-slug@mail.crechely.co.za>" with
// Reply-To set to the school's own address, so parents see the school and
// their replies land in the school's inbox. mail.crechely.co.za is a
// separate sending subdomain so a school's bounces never hurt the
// reputation of Crechely's own Zoho mailbox. Without RESEND_API_KEY it
// falls back to the SMTP account in mail.ts (fine for testing, not for
// volume).

export type SchoolAttachment = { filename: string; content: Uint8Array };
export type SchoolMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: SchoolAttachment[];
};
export type SchoolSender = { schoolName: string; replyTo: string | null };
export type SchoolSendResult = { index: number; sent: boolean; error?: string };

const RESEND_BATCH_LIMIT = 100;

export function sendingDomain(): string {
  return process.env.RESEND_FROM_DOMAIN || "mail.crechely.co.za";
}

import { schoolSlug } from "@/lib/slug";
export { schoolSlug };

/** A display name safe inside a From header: no quotes, angle brackets or line breaks. */
export function safeDisplayName(name: string): string {
  const clean = name.replace(/["<>\r\n]/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
  return clean || "Your school";
}

export function schoolFromAddress(schoolName: string): string {
  return `${safeDisplayName(schoolName)} <${schoolSlug(schoolName)}@${sendingDomain()}>`;
}

export async function sendSchoolMessages(
  sender: SchoolSender,
  messages: SchoolMessage[]
): Promise<SchoolSendResult[]> {
  if (messages.length === 0) return [];
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return sendViaSmtp(sender, messages);

  const from = schoolFromAddress(sender.schoolName);
  // Resend's batch endpoint can't carry attachments, so messages with a
  // statement go one at a time, paced under Resend's per-second rate limit.
  if (messages.some((m) => m.attachments?.length)) {
    return sendOneByOne(apiKey, from, sender.replyTo, messages);
  }
  const results: SchoolSendResult[] = [];
  for (let start = 0; start < messages.length; start += RESEND_BATCH_LIMIT) {
    const chunk = messages.slice(start, start + RESEND_BATCH_LIMIT);
    const body = chunk.map((m) => ({
      from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        chunk.forEach((_, i) => results.push({ index: start + i, sent: true }));
      } else {
        const detail = await res.json().catch(() => ({}));
        const error = resendErrorMessage(res.status, detail);
        console.error("[schoolMail] Resend batch failed", res.status, detail);
        chunk.forEach((_, i) => results.push({ index: start + i, sent: false, error }));
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[schoolMail] Resend request failed", err);
      chunk.forEach((_, i) => results.push({ index: start + i, sent: false, error }));
    }
  }
  return results;
}

const SINGLE_SEND_SPACING_MS = 550;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendOneByOne(
  apiKey: string,
  from: string,
  replyTo: string | null,
  messages: SchoolMessage[]
): Promise<SchoolSendResult[]> {
  const results: SchoolSendResult[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const body = JSON.stringify({
      from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(m.attachments?.length
        ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }
        : {}),
    });
    let outcome: SchoolSendResult = { index: i, sent: false, error: "Not sent." };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body,
        });
        if (res.ok) {
          outcome = { index: i, sent: true };
          break;
        }
        const detail = await res.json().catch(() => ({}));
        outcome = { index: i, sent: false, error: resendErrorMessage(res.status, detail) };
        // A per-second rate limit clears quickly; a daily quota doesn't.
        const isDailyQuota = JSON.stringify(detail).toLowerCase().includes("daily");
        if (res.status !== 429 || isDailyQuota) break;
        await sleep(1200);
      } catch (err) {
        outcome = { index: i, sent: false, error: err instanceof Error ? err.message : String(err) };
        break;
      }
    }
    results.push(outcome);
    if (i < messages.length - 1) await sleep(SINGLE_SEND_SPACING_MS);
  }
  return results;
}

function resendErrorMessage(status: number, detail: unknown): string {
  const message =
    detail && typeof detail === "object" && "message" in detail ? String((detail as { message: unknown }).message) : "";
  if (status === 429)
    return /daily/i.test(message) ? "Daily email limit reached. Try again tomorrow." : "Too many emails at once. Try again in a minute.";
  if (status === 403) return "Email sending isn't set up yet (domain not verified).";
  return message || `Email service error (${status}).`;
}

async function sendViaSmtp(sender: SchoolSender, messages: SchoolMessage[]): Promise<SchoolSendResult[]> {
  const results: SchoolSendResult[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const r = await sendMail({ ...m, replyTo: sender.replyTo ?? undefined, fromName: sender.schoolName });
    results.push(r.sent ? { index: i, sent: true } : { index: i, sent: false, error: r.error });
  }
  return results;
}
