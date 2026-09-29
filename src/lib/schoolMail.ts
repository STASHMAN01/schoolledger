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

export type SchoolMessage = { to: string; subject: string; html: string; text: string };
export type SchoolSender = { schoolName: string; replyTo: string | null };
export type SchoolSendResult = { index: number; sent: boolean; error?: string };

const RESEND_BATCH_LIMIT = 100;

export function sendingDomain(): string {
  return process.env.RESEND_FROM_DOMAIN || "mail.crechely.co.za";
}

/** "Sunny Smiles Pre-School (Pty) Ltd" -> "sunny-smiles-pre-school-pty-ltd" (never empty). */
export function schoolSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "school";
}

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

function resendErrorMessage(status: number, detail: unknown): string {
  const message =
    detail && typeof detail === "object" && "message" in detail ? String((detail as { message: unknown }).message) : "";
  if (status === 429) return "Daily email limit reached. Try again tomorrow.";
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
