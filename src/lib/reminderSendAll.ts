import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildReminderEmailHtml, buildReminderMessage } from "@/lib/billing/reminders";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/billing/reminderTemplates";
import { getOutstandingReminders } from "@/lib/billing/outstandingReminders";
import { sendSchoolMessages, schoolFromAddress, type SchoolMessage } from "@/lib/schoolMail";
import { buildStatementFilename, generateStatementPdf } from "@/lib/billing/statementPdf";
import { statementChildInclude, toStatementChild } from "@/lib/billing/statementData";
import { saDateParts } from "@/lib/autoReminders";

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
    select: { name: true, contactEmail: true, lastBulkReminderAt: true, attachStatementToReminders: true },
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
    attachStatement: org.attachStatementToReminders,
  };
}

export async function sendAllReminders(
  organizationId: string,
  opts: { userId: string | null; trigger: "manual" | "automatic" }
): Promise<SendAllResult> {
  // Full row: the statement PDF needs the school's address and bank details.
  const org = await db.organization.findUnique({ where: { id: organizationId } });
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

  // Each family's statement for the current (South African) year, when the
  // school has "attach statement" on. One query for all the children.
  const year = Number(saDateParts(new Date()).isoDate.slice(0, 4));
  const statementChildren = org.attachStatementToReminders && targets.length > 0
    ? await db.child.findMany({
        where: { id: { in: targets.map((t) => t.childId) }, organizationId },
        include: statementChildInclude(year),
      })
    : [];
  const childById = new Map(statementChildren.map((c) => [c.id, c]));

  const messages: SchoolMessage[] = [];
  for (const r of targets) {
    const input = {
      schoolName: org.name,
      parentName: r.parentName,
      childName: r.childName,
      outstandingCents: r.outstandingCents,
      currencyCode: org.currencyCode,
    };
    let text = buildReminderMessage(input, template);
    let html = buildReminderEmailHtml(input, template);
    let attachments: SchoolMessage["attachments"];
    const child = childById.get(r.childId);
    if (child) {
      try {
        const pdf = await generateStatementPdf(org, [toStatementChild(child)], year);
        attachments = [{ filename: buildStatementFilename(child.firstName, child.lastName), content: pdf }];
        text += "\n\nYour statement is attached.";
        html += "<p>Your statement is attached.</p>";
      } catch (err) {
        // A statement that fails to build must never stop the reminder itself.
        console.error("[reminders] statement PDF failed for", r.childId, err);
      }
    }
    messages.push({ to: r.parentEmail!, subject: `Payment reminder from ${org.name}`, html, text, attachments });
  }

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
    metadata: { trigger: opts.trigger, withStatements: org.attachStatementToReminders, ...result },
  });

  return result;
}
