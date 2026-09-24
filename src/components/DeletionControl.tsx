"use client";

import { useState } from "react";
import { REQUIRED_DELETION_APPROVALS } from "@/lib/deletion";
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
 * The "Delete" control for a category, child, or payment row: requests
 * deletion, or — while a request is pending — shows how many admins have
 * approved it and offers Approve/Cancel to whoever's allowed. No single
 * click ever deletes anything; see prisma/schema.prisma's DeletionRequest
 * comment. Requesting always requires a written reason — not optional,
 * per the org owner's own instruction.
 */
export function DeletionControl({
  organizationId,
  targetType,
  targetId,
  targetLabel,
  deletionRequest,
  canRequest,
  isAdmin,
  onChanged,
  confirm,
}: {
  organizationId: string;
  targetType: "CATEGORY" | "CHILD" | "PAYMENT";
  targetId: string;
  targetLabel: string;
  deletionRequest: DeletionRequestInfo | null;
  canRequest: boolean;
  isAdmin: boolean;
  onChanged: () => void | Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function submitRequest() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/deletion-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not request deletion.");
        return;
      }
      setPromptOpen(false);
      setReason("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/deletion-requests/${deletionRequest!.id}/approve`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not approve.");
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
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

  if (!deletionRequest) {
    if (!canRequest) return null;
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
                Delete &quot;{targetLabel}&quot;?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This needs approval from {REQUIRED_DELETION_APPROVALS} admins before anything
                happens.
              </p>
              <label className="mt-4 block text-xs font-medium text-muted-foreground">
                Reason for deleting (required)
              </label>
              <Textarea
                className="mt-1"
                rows={3}
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
                  onClick={submitRequest}
                  disabled={busy || !reason.trim()}
                >
                  Request deletion
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
        <span className="text-accent-soft-foreground">
          Deletion requested ({deletionRequest.approvalsCount}/{REQUIRED_DELETION_APPROVALS})
        </span>
        {isAdmin && !deletionRequest.approvedByMe && (
          <button
            onClick={approve}
            disabled={busy}
            className="text-brand underline transition-standard hover:brightness-90 disabled:opacity-50 inline-flex min-h-11 items-center px-1 sm:min-h-0 sm:px-0"
          >
            Approve
          </button>
        )}
        {(isAdmin || deletionRequest.requestedByMe) && (
          <button
            onClick={cancel}
            disabled={busy}
            className="text-muted-foreground underline transition-standard hover:text-foreground disabled:opacity-50 inline-flex min-h-11 items-center px-1 sm:min-h-0 sm:px-0"
          >
            Cancel
          </button>
        )}
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
