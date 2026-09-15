"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { REQUIRED_DELETION_APPROVALS } from "@/lib/deletion";

type TrashItem = {
  targetType: "CATEGORY" | "CHILD";
  id: string;
  label: string;
  deletedAt: string;
  daysRemaining: number;
};

type PendingRequest = {
  id: string;
  targetType: "CATEGORY" | "CHILD";
  targetId: string;
  targetLabel: string;
  createdAt: string;
  requestedBy: string;
  approvals: string[];
};

export default function TrashPage() {
  const { organizationId, role } = useOrg();
  const isAdmin = role === "ADMIN";
  const [items, setItems] = useState<TrashItem[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trashRes, pendingRes] = await Promise.all([
        fetch(`/api/organizations/${organizationId}/trash`),
        fetch(`/api/organizations/${organizationId}/deletion-requests`),
      ]);
      const trashData = await trashRes.json();
      const pendingData = await pendingRes.json();
      if (!trashRes.ok) {
        setError(trashData.error ?? "Could not load trash.");
        return;
      }
      setItems(trashData.items);
      if (pendingRes.ok) setPending(pendingData.requests);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function approve(requestId: string) {
    setBusyId(requestId);
    try {
      await fetch(`/api/organizations/${organizationId}/deletion-requests/${requestId}/approve`, {
        method: "POST",
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function cancelRequest(requestId: string) {
    setBusyId(requestId);
    try {
      await fetch(`/api/organizations/${organizationId}/deletion-requests/${requestId}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function restore(item: TrashItem) {
    setBusyId(item.id);
    try {
      await fetch(`/api/organizations/${organizationId}/trash/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: item.targetType, targetId: item.id }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="animate-in max-w-3xl">
        <PageHeader title="Trash" />
        <Card className="p-4 text-sm text-muted-foreground">
          Only an admin can view the trash and pending deletions.
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Trash"
        description={`Deleted categories and children are kept here for 30 days before they're gone for good. Deleting either always needs ${REQUIRED_DELETION_APPROVALS} admins to approve first.`}
      />

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && (
        <>
          <h2 className="font-display mb-3 text-sm font-semibold text-foreground">
            Pending deletion requests
          </h2>
          {pending.length === 0 ? (
            <p className="mb-8 text-sm text-muted-foreground">Nothing waiting on approval.</p>
          ) : (
            <Card className="mb-8 divide-y divide-border">
              {pending.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <Badge variant={r.targetType === "CATEGORY" ? "accent" : "brand"}>
                        {r.targetType === "CATEGORY" ? "Category" : "Child"}
                      </Badge>{" "}
                      <span className="font-medium">{r.targetLabel}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Requested by {r.requestedBy} · {r.approvals.length}/
                      {REQUIRED_DELETION_APPROVALS} approved
                      {r.approvals.length > 0 && ` (${r.approvals.join(", ")})`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => approve(r.id)}
                      disabled={busyId === r.id}
                      className="text-xs text-brand underline transition-standard hover:brightness-90 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => cancelRequest(r.id)}
                      disabled={busyId === r.id}
                      className="text-xs text-muted-foreground underline transition-standard hover:text-foreground disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <h2 className="font-display mb-3 text-sm font-semibold text-foreground">
            Deleted items
          </h2>
          {items.length === 0 ? (
            <EmptyState
              title="Trash is empty"
              description="Deleted categories and children (once approved) show up here for 30 days."
            />
          ) : (
            <Card className="divide-y divide-border">
              {items.map((item) => (
                <div
                  key={`${item.targetType}-${item.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <Badge variant={item.targetType === "CATEGORY" ? "accent" : "brand"}>
                        {item.targetType === "CATEGORY" ? "Category" : "Child"}
                      </Badge>{" "}
                      <span className="font-medium">{item.label}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.daysRemaining === 0
                        ? "Purged very soon"
                        : `${item.daysRemaining} day${item.daysRemaining === 1 ? "" : "s"} left before it's gone for good`}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => restore(item)}
                    disabled={busyId === item.id}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
