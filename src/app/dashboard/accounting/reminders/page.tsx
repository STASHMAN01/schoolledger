"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, PageHeader, Textarea } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { REQUIRED_REMINDER_SEND_APPROVALS } from "@/lib/reminderSend";
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_TEMPLATES,
  missingRequiredPlaceholders,
  renderReminderTemplate,
} from "@/lib/billing/reminderTemplates";
import { formatMoneyCents } from "@/lib/money";
import { formatDateZA } from "@/lib/date";

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
  const { organizationId, organizationName, permissions, currencyCode } = useOrg();
  const canSend = permissions.includes("SEND_REMINDERS");
  const canHandleSendAll = permissions.includes("VIEW_MONEY");
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

  // Message template (customizable wording, with {{childName}}/
  // {{parentName}}/{{amount}}/{{schoolName}} placeholders). null = not
  // loaded yet, in which case each card falls back to the server-computed
  // r.message so there's no flash of "wrong" text while this loads.
  const [templateBody, setTemplateBody] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const canEditTemplate = permissions.includes("VIEW_MONEY");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/reminders`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setReminders(data.reminders);
    else setError(data.error ?? "Could not load reminders.");
    setLoading(false);
  }, [organizationId]);

  const loadSendRequest = useCallback(async () => {
    setSendRequestLoading(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/send-request`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSendRequest(data.request);
      else setSendError(data.error ?? "Couldn't check for a pending send request.");
    } finally {
      setSendRequestLoading(false);
    }
  }, [organizationId]);

  const loadTemplate = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/reminders/template`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setTemplateBody(data.template);
    else setTemplateError(data.error ?? "Couldn't load your reminder message.");
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
    loadSendRequest();
    loadTemplate();
  }, [load, loadSendRequest, loadTemplate]);

  function applyBuiltInTemplate(id: string) {
    const t = REMINDER_TEMPLATES.find((t) => t.id === id);
    if (t) {
      setTemplateBody(t.body);
      setTemplateError(null);
      setTemplateSaved(false);
    }
  }

  async function saveTemplate() {
    if (templateBody === null) return;
    const missing = missingRequiredPlaceholders(templateBody);
    if (missing.length > 0) {
      setTemplateError(`Your message must include ${missing.join(", ")}.`);
      return;
    }
    setTemplateSaving(true);
    setTemplateError(null);
    setTemplateSaved(false);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTemplateError(data.error ?? "Could not save this template.");
        return;
      }
      setTemplateBody(data.template);
      setTemplateSaved(true);
    } finally {
      setTemplateSaving(false);
    }
  }

  const selectedTemplateId =
    REMINDER_TEMPLATES.find((t) => t.body === templateBody)?.id ?? "custom";

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
      const data = await res.json().catch(() => ({}));
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
      const data = await res.json().catch(() => ({}));
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
      const data = await res.json().catch(() => ({}));
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
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/${childId}/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That reminder couldn't be marked as sent. Please try again.");
        return;
      }
      await load();
    } catch {
      setError("That reminder couldn't be marked as sent — check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  function messageFor(r: Reminder) {
    if (editedMessages[r.childId] !== undefined) return editedMessages[r.childId];
    if (templateBody === null) return r.message;
    return renderReminderTemplate(templateBody, {
      schoolName: organizationName,
      parentName: r.parentName,
      childName: r.childName,
      amount: formatMoneyCents(r.outstandingCents, currencyCode),
    });
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

  // Fallback for the "Email" mailto: link, which does nothing at all —
  // silently, no error — on any device without a default mail app
  // configured. Copies just the address, so it can be pasted straight
  // into Gmail/webmail/whatever the person actually uses.
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  async function copyEmailAddress(r: Reminder) {
    if (!r.parentEmail) return;
    try {
      await navigator.clipboard.writeText(r.parentEmail);
      setCopiedEmailId(r.childId);
      setTimeout(() => setCopiedEmailId((id) => (id === r.childId ? null : id)), 2000);
    } catch {
      // Same reasoning as copyMessage above — not worth a hard error.
    }
  }

  if (!canHandleSendAll) {
    // canHandleSendAll === permissions.includes("VIEW_MONEY") here -- the
    // reminders list shows exactly what each parent owes, so it needs the
    // same gate as Payments. A role with SEND_REMINDERS but not VIEW_MONEY
    // (e.g. MANAGER by default) can still mark things sent from elsewhere
    // once Centre Management grows its own reminders view -- not built yet.
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to view reminders. Ask an admin.
      </p>
    );
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Payment reminders"
        description="Every child with an outstanding balance, with a ready-to-send message. Nothing is sent automatically — click WhatsApp or Email to open it in your own app with the message pre-filled, edit it first if you like, then mark it as sent so you can see who's already been reminded."
      />

      {dialog}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {canEditTemplate && (
        <Card className="mb-4 p-4">
          <button
            type="button"
            onClick={() => setTemplateOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-foreground">Message template</span>
            <span className="text-xs text-muted-foreground">
              {templateOpen ? "Hide" : "Customize the wording used below"}
            </span>
          </button>
          {templateOpen && (
            <div className="animate-in mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyBuiltInTemplate(t.id)}
                    className={`transition-standard rounded-lg px-2.5 py-1 text-xs font-medium ${
                      selectedTemplateId === t.id
                        ? "bg-brand-soft text-brand-soft-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                {selectedTemplateId === "custom" && (
                  <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-foreground">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Write it however you like — {"{{childName}}"}, {"{{parentName}}"}, and{" "}
                {"{{amount}}"} must always appear somewhere in the message; {"{{schoolName}}"} is
                available too but optional.
              </p>
              <Textarea
                rows={4}
                value={templateBody ?? DEFAULT_REMINDER_TEMPLATE}
                onChange={(e) => {
                  setTemplateBody(e.target.value);
                  setTemplateSaved(false);
                }}
              />
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={saveTemplate} disabled={templateSaving}>
                  {templateSaving ? "Saving…" : "Save as default"}
                </Button>
                {templateSaved && (
                  <span className="text-xs text-success">
                    Saved — this is now the default for everyone in your school.
                  </span>
                )}
              </div>
              {templateError && <p className="text-xs text-danger">{templateError}</p>}
            </div>
          )}
        </Card>
      )}

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
                  Last reminded {formatDateZA(r.lastReminderSentAt)}
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
                  {r.parentEmail && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyEmailAddress(r)}
                      title="If clicking Email above doesn't open anything, your device likely has no default mail app set — copy the address and paste it into Gmail/webmail instead."
                    >
                      {copiedEmailId === r.childId ? "Copied!" : "Copy email address"}
                    </Button>
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
