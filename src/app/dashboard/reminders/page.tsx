"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../OrgContext";

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
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Payment reminders</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Every child with an outstanding balance, with a ready-to-send message.
        Nothing is sent automatically — click WhatsApp or Email to open it in
        your own app with the message pre-filled, edit it first if you like,
        then mark it as sent so you can see who&apos;s already been reminded.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : reminders.length === 0 ? (
        <p className="text-sm text-neutral-500">No outstanding balances — nothing to remind.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reminders.map((r) => (
            <div key={r.childId} className="rounded border border-neutral-200 p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{r.childName}</span>
                  <span className="ml-2 text-sm text-neutral-500">{r.categoryName}</span>
                </div>
                <span className="font-medium text-red-700">
                  R{(r.outstandingCents / 100).toFixed(2)} outstanding
                </span>
              </div>
              <p className="mb-2 text-sm text-neutral-600">
                {r.parentName}
                {r.parentPhone ? ` · ${r.parentPhone}` : ""}
                {r.parentEmail ? ` · ${r.parentEmail}` : ""}
                {!r.parentPhone && !r.parentEmail && " · no contact details on file"}
              </p>
              <textarea
                className="mb-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                rows={3}
                value={messageFor(r)}
                onChange={(e) =>
                  setEditedMessages((m) => ({ ...m, [r.childId]: e.target.value }))
                }
              />
              {r.lastReminderSentAt && (
                <p className="mb-2 text-xs text-neutral-500">
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
                      className="rounded bg-green-600 px-3 py-1.5 text-white"
                    >
                      WhatsApp
                    </a>
                  )}
                  {r.parentEmail && (
                    <a
                      href={mailLink(r.parentEmail, messageFor(r))}
                      onClick={() => markSent(r.childId, "email")}
                      className="rounded bg-neutral-700 px-3 py-1.5 text-white"
                    >
                      Email
                    </a>
                  )}
                  <button
                    onClick={() => copyMessage(r)}
                    className="rounded border border-neutral-300 px-3 py-1.5"
                  >
                    Copy message
                  </button>
                  <button
                    onClick={() => markSent(r.childId, "manual")}
                    disabled={busyId === r.childId}
                    className="rounded border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
                  >
                    Mark as sent
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
