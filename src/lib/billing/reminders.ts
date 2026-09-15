import { db } from "@/lib/db";
import { formatMoneyCents } from "@/lib/money";

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
// getOutstandingReminders() below is shared by both: the read-only GET
// /reminders list and the send-request execution path, so there's exactly
// one place that decides "who currently owes money".

export type OutstandingReminder = {
  childId: string;
  childName: string;
  categoryName: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  lastReminderSentAt: Date | null;
  outstandingCents: number;
};

export async function getOutstandingReminders(
  organizationId: string
): Promise<OutstandingReminder[]> {
  const entries = await db.financialPlanEntry.findMany({
    where: {
      organizationId,
      status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] },
      child: { archived: false },
    },
    select: {
      childId: true,
      amountDueCents: true,
      amountPaidCents: true,
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          parentName: true,
          parentPhone: true,
          parentEmail: true,
          lastReminderSentAt: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  const byChild = new Map<string, OutstandingReminder>();
  for (const e of entries) {
    const outstanding = e.amountDueCents - e.amountPaidCents;
    if (outstanding <= 0) continue;
    const existing = byChild.get(e.childId);
    if (existing) {
      existing.outstandingCents += outstanding;
    } else {
      byChild.set(e.childId, {
        childId: e.child.id,
        childName: `${e.child.firstName} ${e.child.lastName}`,
        categoryName: e.child.category.name,
        parentName: e.child.parentName,
        parentPhone: e.child.parentPhone,
        parentEmail: e.child.parentEmail,
        lastReminderSentAt: e.child.lastReminderSentAt,
        outstandingCents: outstanding,
      });
    }
  }

  return Array.from(byChild.values()).sort(
    (a, b) => b.outstandingCents - a.outstandingCents
  );
}

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

export function buildReminderEmailHtml(input: {
  schoolName: string;
  parentName: string;
  childName: string;
  outstandingCents: number;
  currencyCode: string;
}): string {
  const text = buildReminderMessage(input);
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
