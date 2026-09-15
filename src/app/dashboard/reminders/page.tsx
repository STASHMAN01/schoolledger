"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg } from "../OrgContext";
import { Button, Card, EmptyState, PageHeader, Textarea } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { canHandleReminderSend, REQUIRED_REMINDER_SEND_APPROVALS } from "@/lib/reminderSend";

type Reminder = {
  childId: string;
  childName: string;
  categoryName: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  lastReminderSentAt: string | null;
  outstandingCents: number;
  message: string;
};

function waLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
}
function mailLink(email: string, message: string) {
  return `mailto:${email}?subject=${encodeURIComponent("Payment reminder")}&body=${encodeURIComponent(message)}`;
}

export default function RemindersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
      <RemindersPageInner />
    </Suspense>
  );
}

type SendRequest = {
  id: string;
  reminderCountAtRequest: number;
  approvalsCount: number;
  approvedByMe: boolean;
  requestedByMe: boolean;
};

function RemindersPageInner() {
  const { organizationId, role, currencyCode } = useOrg();
  const canSend = role !== "VIEWER";
  const canHandleSendAll = canHandleReminderSend(role);
  const { confirm, dialog } = useConfirmDialog();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter"); // "sent" | "unsent" | null
  const [filter, setFilter] = useState<"all" | "sent" | "unsent">(
    filterParam === "sent" || filterParam === "unsent" ? filterParam : "all"
  );

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sendRequest, setSendRequest] = useState<SendRequest | null>(null);
  const [sendRequestLoading, setSendRequestLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/reminders`);
    const data = await res.json();
    if (res.ok) setReminders(data.reminders);
    else setError(data.error ?? "Could not load reminders.");
    setLoading(false);
  }, [organizationId]);

  const loadSendRequest = useCallback(async () => {
    setSendRequestLoading(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/send-request`);
      const data = await res.json();
      if (res.ok) setSendRequest(data.request);
    } finally {
      setSendRequestLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
    loadSendRequest();
  }, [load, loadSendRequest]);

  async function requestSendAll() {
    const confirmed = await confirm({
      title: "Send all reminders?",
      description:
        "Are you sure you have recorded everything correctly before sending? This will email every parent with an outstanding balance once a second admin or accountant approves it.",
      confirmLabel: "Yes, request it",
    });
    if (!confirmed) return;
    setSendBusy(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/send-request`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Could not request this.");
        return;
      }
      setSendRequest(data.request);
    } finally {
      setSendBusy(false);
    }
  }

  async function approveSendAll() {
    if (!sendRequest) return;
    setSendBusy(true);
    setSendError(null);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/reminders/send-request/${sendRequest.id}/approve`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Could not approve.");
        return;
      }
      if (data.executed) {
        setSendResult(
          `Sent ${data.sentCount} reminder email${data.sentCount === 1 ? "" : "s"}.` +
            (data.skippedNoEmailCount
              ? ` ${data.skippedNoEmailCount} skipped (no email on file, or email isn't set up yet).`
              : "") +
            (data.failedCount ? ` ${data.failedCount} failed to send.` : "")
        );
        setSendRequest(null);
        await load();
      } else {
        setSendRequest((r) => (r ? { ...r, approvalsCount: data.approvalCount, approvedByMe: true } : r));
      }
    } finally {
      setSendBusy(false);
    }
  }

  async function cancelSendAll() {
    if (!sendRequest) return;
    const confirmed = await confirm({
      title: "Cancel this request?",
      description: "No reminder emails will be sent.",
      confirmLabel: "Cancel request",
    });
    if (!confirmed) return;
    setSendBusy(true);
    setSendError(null);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/reminders/send-request/${sendRequest.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Could not cancel.");
        return;
      }
      setSendRequest(null);
    } finally {
      setSendBusy(false);
    }
  }

  async function markSent(childId: string, channel: "whatsapp" | "email" | "manual") {
    setBusyId(childId);
    await fetch(`/api/organizations/${organizationId}/reminders/${childId}/mark-sent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
    setBusyId(null);
    await load();
  }

  function messageFor(r: Reminder) {
    return editedMessages[r.childId] ?? r.message;
  }

  const visibleReminders = reminders.filter((r) => {
    if (filter === "sent") return Boolean(r.lastReminderSentAt);
    if (filter === "unsent") return !r.lastReminderSentAt;
    return true;
  });

  async function copyMessage(r: Reminder) {
    try {
      await navigator.clipboard.writeText(messageFor(r));
    } catch {
      // Clipboard API can fail (e.g. no permission) — not worth a hard error
      // for what's a convenience shortcut; the text is still selectable in
      // the textarea below.
    }
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Payment reminders"
        description="Every child with an outstanding balance, with a ready-to-send message. Nothing is sent automatically — click WhatsApp or Email to open it in your own app with the message pre-filled, edit it first if you like, then mark it as sent so you can see who's already been reminded."
      />

      {dialog}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {canHandleSendAll && !sendRequestLoading && (
        <Card className="mb-4 p-4">
          {sendResult ? (
            <p className="text-sm text-foreground">{sendResult}</p>
          ) : sendRequest ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Send-all requested ({sendRequest.approvalsCount}/{REQUIRED_REMINDER_SEND_APPROVALS}{" "}
                  approvals)
                </p>
                <p className="text-xs text-muted-foreground">
                  Covers {sendRequest.reminderCountAtRequest} outstanding account
                  {sendRequest.reminderCountAtRequest === 1 ? "" : "s"} as of when it was
                  requested — the live list is re-checked right before sending.
                </p>
              </div>
              <div className="flex gap-2">
                {!sendRequest.approvedByMe && (
                  <Button size="sm" onClick={approveSendAll} disabled={sendBusy}>
                    Approve &amp; send
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={cancelSendAll} disabled={sendBusy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Email every parent above with an outstanding balance in one go — needs{" "}
                {REQUIRED_REMINDER_SEND_APPROVALS} approvals from admins or accountants.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={requestSendAll}
                disabled={sendBusy || reminders.length === 0}
              >
                Send all…
              </Button>
            </div>
          )}
          {sendError && <p className="mt-2 text-xs text-danger">{sendError}</p>}
        </Card>
      )}

      {!loading && reminders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {(["all", "unsent", "sent"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`transition-standard rounded-lg px-3 py-1.5 font-medium ${
                filter === f
                  ? "bg-brand-soft text-brand-soft-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "unsent" ? "Never reminded" : "Already reminded"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : reminders.length === 0 ? (
        <EmptyState
          title="No outstanding balances"
          description="Nothing to remind."
        />
      ) : visibleReminders.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={filter === "sent" ? "No one has been reminded yet." : "Everyone owing has already been reminded."}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visibleReminders.map((r) => (
            <Card key={r.childId} as="div" className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium text-foreground">{r.childName}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{r.categoryName}</span>
                </div>
                <span className="font-medium text-danger">
                  {formatCents(r.outstandingCents, currencyCode)} outstanding
                </span>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                {r.parentName}
                {r.parentPhone ? ` · ${r.parentPhone}` : ""}
                {r.parentEmail ? ` · ${r.parentEmail}` : ""}
                {!r.parentPhone && !r.parentEmail && " · no contact details on file"}
              </p>
              <Textarea
                className="mb-2"
                rows={3}
                value={messageFor(r)}
                onChange={(e) =>
                  setEditedMessages((m) => ({ ...m, [r.childId]: e.target.value }))
                }
              />
              {r.lastReminderSentAt && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Last reminded {new Date(r.lastReminderSentAt).toLocaleDateString()}
                </p>
              )}
              {canSend && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {r.parentPhone && (
                    <a
                      href={waLink(r.parentPhone, messageFor(r))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markSent(r.childId, "whatsapp")}
                      className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg bg-success px-3 py-1.5 font-medium text-white hover:brightness-95"
                    >
                      WhatsApp
                    </a>
                  )}
                  {r.parentEmail && (
                    <a
                      href={mailLink(r.parentEmail, messageFor(r))}
                      onClick={() => markSent(r.childId, "email")}
                      className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-foreground hover:bg-brand-hover"
                    >
                      Email
                    </a>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => copyMessage(r)}>
                    Copy message
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => markSent(r.childId, "manual")}
                    disabled={busyId === r.childId}
                  >
                    Mark as sent
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
