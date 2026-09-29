import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildReminderEmailHtml, buildReminderMessage } from "@/lib/billing/reminders";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/billing/reminderTemplates";
import { getOutstandingReminders } from "@/lib/billing/outstandingReminders";
import { sendSchoolMessages, schoolFromAddress } from "@/lib/schoolMail";

// "Send all reminders" in one step (Dylan, 29 Sept 2026 -- the old
// two-approver request/approve flow was removed: a one-person school could
// never use it). Any ADMIN/ACCOUNTANT (VIEW_MONEY) can send; every send is
// in the Activity log. Also used by the daily automatic-reminders cron.

// A second bulk send within this window is refused (double-click guard,
// and stops a manual send landing right after an automatic one).
export const BULK_SEND_COOLDOWN_MS = 15 * 60 * 1000;
// Automatic runs skip anyone reminded in the last 2 days by any route.
const AUTO_SKIP_RECENT_MS = 2 * 24 * 60 * 60 * 1000;

export type SendAllResult = {
  sentCount: number;
  noEmailCount: number;
  skippedRecentCount: number;
  failedCount: number;
  firstError: string | null;
};

/** Where parents' replies go: the school's contact email, else its first admin's login email. */
export async function schoolReplyTo(organizationId: string, contactEmail: string | null): Promise<string | null> {
  if (contactEmail) return contactEmail;
  const admin = await db.membership.findFirst({
    where: { organizationId, role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { email: true } } },
  });
  return admin?.user.email ?? null;
}

export async function reminderSendPreview(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, contactEmail: true, lastBulkReminderAt: true },
  });
  if (!org) return null;
  const outstanding = await getOutstandingReminders(organizationId);
  const withEmail = outstanding.filter((r) => r.parentEmail);
  return {
    from: schoolFromAddress(org.name),
    replyTo: await schoolReplyTo(organizationId, org.contactEmail),
    replyToIsContactEmail: Boolean(org.contactEmail),
    withEmailCount: withEmail.length,
    noEmailCount: outstanding.length - withEmail.length,
    totalOutstandingCents: withEmail.reduce((s, r) => s + r.outstandingCents, 0),
    lastBulkReminderAt: org.lastBulkReminderAt,
  };
}

export async function sendAllReminders(
  organizationId: string,
  opts: { userId: string | null; trigger: "manual" | "automatic" }
): Promise<SendAllResult> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, currencyCode: true, reminderMessageTemplate: true, contactEmail: true },
  });
  if (!org) return { sentCount: 0, noEmailCount: 0, skippedRecentCount: 0, failedCount: 0, firstError: null };

  await db.organization.update({ where: { id: organizationId }, data: { lastBulkReminderAt: new Date() } });

  const template = org.reminderMessageTemplate ?? DEFAULT_REMINDER_TEMPLATE;
  const outstanding = await getOutstandingReminders(organizationId);
  const now = Date.now();

  let noEmailCount = 0;
  let skippedRecentCount = 0;
  const targets: typeof outstanding = [];
  for (const r of outstanding) {
    if (!r.parentEmail) {
      noEmailCount++;
    } else if (
      opts.trigger === "automatic" &&
      r.lastReminderSentAt &&
      now - r.lastReminderSentAt.getTime() < AUTO_SKIP_RECENT_MS
    ) {
      skippedRecentCount++;
    } else {
      targets.push(r);
    }
  }

  const messages = targets.map((r) => {
    const input = {
      schoolName: org.name,
      parentName: r.parentName,
      childName: r.childName,
      outstandingCents: r.outstandingCents,
      currencyCode: org.currencyCode,
    };
    return {
      to: r.parentEmail!,
      subject: `Payment reminder from ${org.name}`,
      html: buildReminderEmailHtml(input, template),
      text: buildReminderMessage(input, template),
    };
  });

  const replyTo = await schoolReplyTo(organizationId, org.contactEmail);
  const results = await sendSchoolMessages({ schoolName: org.name, replyTo }, messages);
  const sentChildIds = results.filter((r) => r.sent).map((r) => targets[r.index].childId);
  const failed = results.filter((r) => !r.sent);

  if (sentChildIds.length > 0) {
    await db.child.updateMany({
      where: { id: { in: sentChildIds }, organizationId },
      data: { lastReminderSentAt: new Date() },
    });
  }

  const result: SendAllResult = {
    sentCount: sentChildIds.length,
    noEmailCount,
    skippedRecentCount,
    failedCount: failed.length,
    firstError: failed[0]?.error ?? null,
  };

  await logAudit({
    organizationId,
    userId: opts.userId,
    action: "reminders.sendAllExecuted",
    entityType: "Reminder",
    metadata: { trigger: opts.trigger, ...result },
  });

  return result;
}
