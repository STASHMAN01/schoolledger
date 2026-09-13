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
    default:
      return row.action;
  }
}
