"use client";

// Online submissions (was the "Pending reviews" tab -- moved into
// Admissions and renamed, Dylan 23 Sept). Forms parents filled in online:
// updates for an existing child (one-time link) and applications from NEW
// families (the school's permanent link). Nothing is saved to a child until
// staff approve it.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Badge, Card } from "@/components/ui";

type SubmissionRow = {
  id: string;
  submittedAt: string;
  isNewApplicant: boolean;
  child: { id: string | null; firstName: string; lastName: string };
};

export function OnlineSubmissions() {
  const { organizationId } = useOrg();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/parent-submissions`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRows(data.submissions ?? []);
      else setError(data.error ?? "Couldn't load online submissions.");
    } catch {
      setError("Couldn't load online submissions. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  return (
    <Card as="div" id="submissions" className="mb-8 scroll-mt-24 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Online submissions{!loading && !error ? ` (${rows.length})` : ""}
        </h2>
        <Link href="/dashboard/centre/forms" className="text-xs font-medium text-brand hover:underline">
          Get the online form link →
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing waiting. When a parent fills in an online form, it shows up here for you to approve.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/centre/pending-reviews/${s.id}`}
              className="transition-standard flex min-h-11 items-center justify-between gap-3 py-2 hover:bg-background"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <span className="truncate">
                  {s.child.firstName} {s.child.lastName}
                </span>
                <Badge variant={s.isNewApplicant ? "accent" : "neutral"}>
                  {s.isNewApplicant ? "New family" : "Details update"}
                </Badge>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(s.submittedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
