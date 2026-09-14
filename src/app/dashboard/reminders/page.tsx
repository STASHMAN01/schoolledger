"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../OrgContext";
import { Button, Card, EmptyState, PageHeader, Textarea } from "@/components/ui";

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
  const { organizationId, role } = useOrg();
  const canSend = role !== "VIEWER";

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/reminders`);
    const data = await res.json();
    if (res.ok) setReminders(data.reminders);
    else setError(data.error ?? "Could not load reminders.");
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

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

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : reminders.length === 0 ? (
        <EmptyState
          title="No outstanding balances"
          description="Nothing to remind."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {reminders.map((r) => (
            <Card key={r.childId} as="div" className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium text-foreground">{r.childName}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{r.categoryName}</span>
                </div>
                <span className="font-medium text-danger">
                  R{(r.outstandingCents / 100).toFixed(2)} outstanding
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
