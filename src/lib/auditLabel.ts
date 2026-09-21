// Turns a raw AuditLog row into the short, human phrase the activity feed
// shows — "Frank recorded a payment", not the raw action string. Kept in
// one place so every surface that renders AuditLog (today: the dashboard
// feed) reads the same way.

type AuditRow = {
  action: string;
  metadata: unknown;
};

function meta(row: AuditRow): Record<string, unknown> {
  return (row.metadata as Record<string, unknown>) ?? {};
}

export function describeAuditAction(row: AuditRow): string {
  const m = meta(row);
  switch (row.action) {
    case "organization.created":
      return "created the school account";
    case "category.created":
      return `added category "${m.name ?? ""}"`;
    case "category.updated":
      return "updated a category";
    case "category.archived":
      return "archived a category";
    case "category.restored":
      return "restored a category";
    case "child.created":
      return `added ${m.name ?? "a child"}`;
    case "child.updated":
      return "updated a child's details";
    case "child.archived":
      return "archived a child";
    case "child.restored":
      return "restored a child";
    case "guardian.created":
      return `added ${m.firstName ?? "a"} ${m.lastName ?? "guardian"} as a guardian`.trim();
    case "guardian.updated":
      return "updated a guardian's details";
    case "guardian.deleted":
      return "removed a guardian";
    case "child.idNumber.revealed":
      return `viewed a masked ID number`;
    case "form.generated":
      return `generated a ${m.formLabel ?? "form"}`;
    case "form.downloaded":
      return `downloaded a ${m.formLabel ?? "form"}`;
    case "children.imported": {
      const count = typeof m.created === "number" ? m.created : 0;
      const failed = typeof m.failed === "number" && m.failed > 0 ? ` (${m.failed} row${m.failed === 1 ? "" : "s"} skipped)` : "";
      return `imported ${count} ${count === 1 ? "child" : "children"} from a CSV${failed}`;
    }
    case "paymentType.created":
      return `added payment type "${m.name ?? ""}"`;
    case "paymentType.updated":
      return "updated a payment type";
    case "paymentType.deactivated":
      return "deactivated a payment type";
    case "payment.recorded": {
      const amount =
        typeof m.amountCents === "number" ? `R${(m.amountCents / 100).toFixed(2)}` : "a payment";
      const receipt = m.receiptNumber ? ` (${m.receiptNumber})` : "";
      return `recorded a payment of ${amount}${receipt}`;
    }
    case "statement.generated":
      return `generated a ${m.year ?? ""} statement`.trim();
    case "invite.created":
      return `invited ${m.email ?? "someone"} as ${m.role ?? "a team member"}`;
    case "invite.revoked":
      return "revoked a pending invite";
    case "invite.accepted":
      return "accepted an invite and joined the team";
    case "membership.updated": {
      const prev = m.previousRole ?? "";
      const next = m.newRole ?? "";
      const name = m.memberName ?? "a team member";
      return prev && next && prev !== next
        ? `changed ${name}'s role from ${prev} to ${next}`
        : `updated ${name}'s access`;
    }
    case "billing.subscriptionUpdated":
      return `updated the subscription (${m.status ?? ""})`.trim();
    case "credit.applied":
      return "applied a credit balance";
    case "financialPlan.cancelledAfterExit":
      return "cancelled future charges after a child's exit";
    case "event.created": {
      const count = typeof m.chargedChildCount === "number" ? m.chargedChildCount : 0;
      return `created event "${m.name ?? ""}" (charged ${count} ${count === 1 ? "child" : "children"})`;
    }
    case "event.childRemoved":
      return `removed a child from event "${m.eventName ?? ""}"`;
    case "reminder.sent":
      return `sent a payment reminder to ${m.childName ?? "a parent"}${m.channel && m.channel !== "manual" ? ` (${m.channel})` : ""}`;
    case "category.deletionRequested":
      return `requested deletion of category "${m.targetLabel ?? ""}"`;
    case "child.deletionRequested":
      return `requested deletion of ${m.targetLabel ?? "a child's records"}`;
    case "payment.deletionRequested":
      return `requested deletion of a payment (${m.targetLabel ?? ""})`;
    case "category.deletionApproved":
      return `approved deleting category "${m.targetLabel ?? ""}"`;
    case "child.deletionApproved":
      return `approved deleting ${m.targetLabel ?? "a child's records"}`;
    case "payment.deletionApproved":
      return `approved deleting a payment (${m.targetLabel ?? ""})`;
    case "category.deleted":
      return `deleted category "${m.targetLabel ?? ""}" (approved by ${typeof m.approvalCount === "number" ? m.approvalCount : "2"} admins)`;
    case "child.deleted":
      return `deleted ${m.targetLabel ?? "a child's records"} (approved by ${typeof m.approvalCount === "number" ? m.approvalCount : "2"} admins)`;
    case "payment.deleted":
      return `deleted a payment: ${m.targetLabel ?? ""} (approved by ${typeof m.approvalCount === "number" ? m.approvalCount : "2"} admins)`;
    case "category.deletionCancelled":
      return `cancelled a deletion request for category "${m.targetLabel ?? ""}"`;
    case "child.deletionCancelled":
      return `cancelled a deletion request for ${m.targetLabel ?? "a child's records"}`;
    case "payment.deletionCancelled":
      return `cancelled a deletion request for a payment (${m.targetLabel ?? ""})`;
    case "reminders.sendAllRequested":
      return `requested sending reminders to everyone owing (${typeof m.reminderCountAtRequest === "number" ? m.reminderCountAtRequest : ""} accounts)`;
    case "reminders.sendAllApproved":
      return `approved sending reminders to everyone owing`;
    case "reminders.sendAllExecuted": {
      const sent = typeof m.sentCount === "number" ? m.sentCount : 0;
      return `sent ${sent} reminder email${sent === 1 ? "" : "s"} to everyone owing`;
    }
    case "reminders.sendAllCancelled":
      return "cancelled a request to send reminders to everyone owing";
    case "reminders.templateUpdated":
      return "updated the reminder message template";
    default:
      return row.action;
  }
}
