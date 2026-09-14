"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

// action strings look like "payment.created", "child.archived" — split on
// the dot to get a badge variant + a human verb without maintaining a giant
// switch statement that drifts out of sync with every new logAudit() call
// site added elsewhere in the app.
const VERB_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  archived: "archived",
  restored: "restored",
  deleted: "deleted",
  recorded: "recorded",
  profileUpdated: "updated the school profile",
  removed: "removed",
  childRemoved: "removed a child",
  accepted: "accepted an invite",
  revoked: "revoked an invite",
  deactivated: "deactivated",
  generated: "generated",
  sent: "sent",
  subscriptionUpdated: "updated the subscription",
};

const ENTITY_BADGE: Record<string, "brand" | "accent" | "success" | "danger" | "neutral"> = {
  Payment: "success",
  Child: "brand",
  Category: "accent",
  Event: "accent",
  Invite: "neutral",
  Membership: "neutral",
  Organization: "brand",
  PaymentType: "accent",
  Statement: "accent",
  Reminder: "neutral",
};

function describeAction(action: string): string {
  const [, verb] = action.split(".");
  return VERB_LABELS[verb] ?? verb ?? action;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ActivityLogPage() {
  const { organizationId } = useOrg();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/audit`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load activity.");
        return;
      }
      setEntries(data.entries);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    loadFirstPage();
  }, [loadFirstPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/audit?cursor=${cursor}`
      );
      const data = await res.json();
      if (res.ok) {
        setEntries((prev) => [...prev, ...data.entries]);
        setCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Activity log"
        description="A record of changes made in this school's account — payments, children, settings, and more."
      />

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          title="No activity yet"
          description="Actions like recording a payment or updating a child's details will show up here."
        />
      )}

      {!loading && entries.length > 0 && (
        <Card className="divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
              <Badge variant={ENTITY_BADGE[entry.entityType] ?? "neutral"}>
                {entry.entityType}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">
                    {entry.actor ? entry.actor.name : "System"}
                  </span>{" "}
                  {describeAction(entry.action)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatWhen(entry.createdAt)}
                  {entry.actor && ` · ${entry.actor.email}`}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {cursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
