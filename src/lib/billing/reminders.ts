import { formatMoneyCents } from "@/lib/money";
import { DEFAULT_REMINDER_TEMPLATE, renderReminderTemplate } from "./reminderTemplates";

// Pure, DB-free helpers only in this file, deliberately — see
// reminders.test.ts. getOutstandingReminders() (the "who currently owes
// money" query) lives in outstandingReminders.ts instead, specifically so
// this file can be imported in a test without pulling in @/lib/db →
// PrismaClient, which fails to construct in any environment that hasn't
// run `prisma generate` (this sandbox can't — see AGENTS.md/session notes
// — but a contributor's local machine without a fresh `npm install` could
// hit the same thing). Keep it this way: if a future change here needs the
// database, put it in outstandingReminders.ts, not here.

// Deliberately does NOT send anything itself, for the on-demand/manual
// per-child flow below (buildReminderMessage + the WhatsApp/mailto link
// helpers). Per the original product spec (out of scope for v1: "automated
// WhatsApp/SMS sending... manual share is fine"), that flow generates the
// message text and a wa.me / mailto link so the admin sends it through
// whatever they already use — no email provider account, no per-message
// cost, nothing new to configure before a school can start using this.
//
// The "Send all" 2-approval flow (see ReminderSendRequest in
// prisma/schema.prisma and the send-request API routes) is the one
// exception — it DOES actually send, via sendMail() in src/lib/mail.ts,
// but only once two distinct ADMIN/ACCOUNTANT people have approved it.

// `template` defaults to the built-in "Friendly" wording when omitted, but
// every real call site should pass the organization's actual saved
// template (Organization.reminderMessageTemplate ?? the default) — see
// reminderTemplates.ts for the placeholder tokens and the 5 built-in
// options, and the org's own "Message template" editor on the Reminders
// page for where this is customized.
export function buildReminderMessage(
  input: {
    schoolName: string;
    parentName: string;
    childName: string;
    outstandingCents: number;
    currencyCode: string;
  },
  template: string = DEFAULT_REMINDER_TEMPLATE
): string {
  const amount = formatMoneyCents(input.outstandingCents, input.currencyCode);
  return renderReminderTemplate(template, {
    schoolName: input.schoolName,
    parentName: input.parentName,
    childName: input.childName,
    amount,
  });
}

export function buildReminderEmailHtml(
  input: {
    schoolName: string;
    parentName: string;
    childName: string;
    outstandingCents: number;
    currencyCode: string;
  },
  template: string = DEFAULT_REMINDER_TEMPLATE
): string {
  const text = buildReminderMessage(input, template);
  return `<p>${text.replace(/\n/g, "<br />")}</p>`;
}

// wa.me needs digits only (no leading +) — parentPhone is stored E.164
// (e.g. "+27821234567") per src/lib/validation.ts.
export function whatsAppLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(email: string, subject: string, message: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
