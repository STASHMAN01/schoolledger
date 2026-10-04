"use client";

import { useState } from "react";
import { Button, Card, Textarea } from "@/components/ui";
import type { ConfirmOptions } from "@/components/useConfirmDialog";

export type DeletionRequestInfo = {
  id: string;
  approvalsCount: number;
  approvedByMe: boolean;
  requestedByMe: boolean;
  reason?: string;
};

/**
 * The "Delete" control for a class, child or payment row. One step for an
 * admin since 4 Oct 2026 (Dylan): a class or child goes straight to Trash
 * for 30 days (restorable, with a final-review to-do on the last day); a
 * payment is reversed at once and needs a reason, because it can't be
 * restored. Only shown to people with "Approve deletion" (admins).
 *
 * A request left over from the old two-approval flow shows as "Deletion
 * requested" with Delete now / Cancel until someone finishes it.
 */
export function DeletionControl({
  organizationId,
  targetType,
  targetId,
  targetLabel,
  deletionRequest,
  isAdmin,
  onChanged,
  confirm,
}: {
  organizationId: string;
  targetType: "CATEGORY" | "CHILD" | "PAYMENT";
  targetId: string;
  targetLabel: string;
  deletionRequest: DeletionRequestInfo | null;
  isAdmin: boolean;
  onChanged: () => void | Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [reason, setReason] = useState("");
  const isPayment = targetType === "PAYMENT";

  async function submitDelete() {
    if (isPayment && !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/deletion-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete.");
        return;
      }
      setPromptOpen(false);
      setReason("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function finishOldRequest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/deletion-requests/${deletionRequest!.id}/approve`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete.");
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function cancelOldRequest() {
    const confirmed = await confirm({
      title: "Cancel this deletion request?",
      description: `"${targetLabel}" will stay as-is — nothing will be deleted.`,
      confirmLabel: "Cancel request",
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/deletion-requests/${deletionRequest!.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel.");
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return null;

  if (!deletionRequest) {
    return (
      <>
        <button
          onClick={() => setPromptOpen(true)}
          disabled={busy}
          className="text-xs text-danger underline transition-standard hover:brightness-90 disabled:opacity-50 inline-flex min-h-11 items-center px-1 sm:min-h-0 sm:px-0"
        >
          Delete…
        </button>
        {promptOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !busy && setPromptOpen(false)}
          >
            <Card className="animate-in w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-base font-semibold text-foreground">
                {isPayment ? `Delete this payment?` : `Move "${targetLabel}" to Trash?`}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isPayment
                  ? `${targetLabel}. It's reversed straight away and can't be restored: anything it paid becomes owing again.`
                  : "You can restore it from Settings → Trash for 30 days. On the last day you'll get a to-do to review it before it's removed for good."}
              </p>
              <label className="mt-4 block text-xs font-medium text-muted-foreground">
                {isPayment ? "Reason (required)" : "Reason (optional)"}
              </label>
              <Textarea
                className="mt-1"
                rows={2}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. duplicate entry, entered in error…"
              />
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPromptOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={submitDelete}
                  disabled={busy || (isPayment && !reason.trim())}
                >
                  {busy ? "Deleting…" : isPayment ? "Delete payment" : "Move to Trash"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-accent-soft-foreground">Deletion requested</span>
        <button
          onClick={finishOldRequest}
          disabled={busy}
          className="text-danger underline transition-standard hover:brightness-90 disabled:opacity-50 inline-flex min-h-11 items-center px-1 sm:min-h-0 sm:px-0"
        >
          Delete now
        </button>
        <button
          onClick={cancelOldRequest}
          disabled={busy}
          className="text-muted-foreground underline transition-standard hover:text-foreground disabled:opacity-50 inline-flex min-h-11 items-center px-1 sm:min-h-0 sm:px-0"
        >
          Cancel
        </button>
      </div>
      {deletionRequest.reason && (
        <p className="max-w-[220px] text-right text-xs text-muted">
          &quot;{deletionRequest.reason}&quot;
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
