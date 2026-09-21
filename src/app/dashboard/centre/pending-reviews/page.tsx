"use client";

// Pending reviews -- parent-submitted enrolment forms (Phase 2 Session 4)
// waiting on a staff approve/reject decision. Nothing a parent submits
// ever lands on a real Child/Guardian record until it's approved here;
// see the ParentSubmission model comment in schema.prisma.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Card, EmptyState, PageHeader } from "@/components/ui";

type SubmissionRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  child: { id: string; firstName: string; lastName: string };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PendingReviewsPage() {
  const { organizationId } = useOrg();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/parent-submissions`);
    const data = await res.json();
    if (res.ok) setSubmissions(data.submissions);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Pending reviews"
        description="Enrolment forms parents have submitted online, waiting on approval."
      />
      <Card as="div" className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : submissions.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            description="Submissions from a parent enrolment-form link (sent from a child's profile) will show up here."
          />
        ) : (
          <div className="divide-y divide-border">
            {submissions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/centre/pending-reviews/${s.id}`}
                className="transition-standard flex items-center justify-between gap-3 py-2.5 hover:bg-background"
              >
                <p className="truncate text-sm font-medium text-foreground">
                  {s.child.firstName} {s.child.lastName}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(s.submittedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
