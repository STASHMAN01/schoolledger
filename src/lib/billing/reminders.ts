import { formatMoneyCents } from "@/lib/money";

// Deliberately does NOT send anything itself. Per the original product
// spec (out of scope for v1: "automated WhatsApp/SMS sending... manual
// share is fine"), this generates the message text and a wa.me / mailto
// link so the admin sends it through whatever they already use — no email
// provider account, no per-message cost, nothing new to configure before a
// school can start using this. See PHASES.md for the tradeoff and what a
// real automated-sending feature would need later.

export function buildReminderMessage(input: {
  schoolName: string;
  parentName: string;
  childName: string;
  outstandingCents: number;
  currencyCode: string;
}): string {
  const amount = formatMoneyCents(input.outstandingCents, input.currencyCode);
  return `Hi ${input.parentName}, this is a friendly reminder from ${input.schoolName} that ${input.childName}'s account has an outstanding balance of ${amount}. Please let us know if you have any questions. Thank you!`;
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
