"use client";

import { useState } from "react";
import { REQUIRED_DELETION_APPROVALS } from "@/lib/deletion";
import type { ConfirmOptions } from "@/components/useConfirmDialog";

export type DeletionRequestInfo = {
  id: string;
  approvalsCount: number;
  approvedByMe: boolean;
  requestedByMe: boolean;
};

/**
 * The "Delete" control for a category or child row: requests deletion,
 * or — while a request is pending — shows how many admins have approved
 * it and offers Approve/Cancel to whoever's allowed. No single click ever
 * deletes anything; see prisma/schema.prisma's DeletionRequest comment.
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
  targetType: "CATEGORY" | "CHILD";
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

  async function requestDeletion() {
    const confirmed = await confirm({
      title: `Delete "${targetLabel}"?`,
      description: `This needs approval from ${REQUIRED_DELETION_APPROVALS} admins before anything happens. Once approved it moves to Trash for 30 days (restorable), then it's gone for good.`,
      confirmLabel: "Request deletion",
      variant: "danger",
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/deletion-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not request deletion.");
        return;
      }
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
      const data = await res.json();
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
      const data = await res.json();
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
      <button
        onClick={requestDeletion}
        disabled={busy}
        className="text-xs text-danger underline transition-standard hover:brightness-90 disabled:opacity-50"
      >
        Delete…
      </button>
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
            className="text-brand underline transition-standard hover:brightness-90 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {(isAdmin || deletionRequest.requestedByMe) && (
          <button
            onClick={cancel}
            disabled={busy}
            className="text-muted-foreground underline transition-standard hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
