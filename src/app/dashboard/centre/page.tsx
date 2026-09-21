"use client";

// Centre Management home. Deliberately close to empty in Phase 1 -- the
// real tiles (Admissions, Enrolled, Attendance, Staff, Upcoming Events,
// To-do) are Phase 2/3/5 per docs/PLAN.md. What it DOES do now: show
// that centre-side activity (children/classes) is tracked separately
// from Accounting's activity log, per the "activity feed splits by mode"
// Phase 1 requirement -- there just isn't much else to show here yet.
import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../OrgContext";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { CENTRE_ENTITY_TYPES } from "@/lib/activityArea";
import { describeAuditAction } from "@/lib/auditLabel";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  metadata: unknown;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

const ENTITY_LABEL: Record<string, string> = {
  Category: "Class",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CentreManagementHomePage() {
  const { organizationId } = useOrg();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      entityTypes: CENTRE_ENTITY_TYPES.join(","),
    });
    const res = await fetch(
      `/api/organizations/${organizationId}/audit?${params.toString()}`
    );
    const data = await res.json();
    if (res.ok) setEntries((data.entries ?? []).slice(0, 8));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Centre Management"
        description="Enrolment, attendance, staff and the rest of centre management are on the way. Billing lives under Accounting, top-left."
      />

      <Card as="div" className="mb-8 p-4">
        <h2 className="font-display mb-3 text-sm font-semibold text-foreground">
          Recent centre activity
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet — adding or editing a child or class will show up here.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5">
                <Badge variant="brand">
                  {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                </Badge>
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                  <span className="font-medium">
                    {entry.actor ? entry.actor.name : "System"}
                  </span>{" "}
                  {describeAuditAction(entry)}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatWhen(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EmptyState
        title="More is coming here"
        description="Admissions, enrolled learners, attendance, staff and events all move in over the next phases — see docs/PLAN.md."
      />
    </div>
  );
}
