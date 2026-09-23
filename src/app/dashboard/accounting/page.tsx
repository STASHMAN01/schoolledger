"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useOrg } from "../OrgContext";
import { TodoList } from "../TodoList";
import { DrilldownTree } from "./DrilldownTree";
import { formatCents } from "@/lib/formatMoney";
import type { CategoryNode } from "@/lib/billing/dashboard";
import { Card } from "@/components/ui";
import { describeAuditAction } from "@/lib/auditLabel";

type ActivityItem = { id: string; userName: string; label: string; createdAt: string };

type DashboardData = {
  childrenCount: number;
  canViewMoney: boolean;
  activity: ActivityItem[];
  outstandingTotalCents?: number;
  outstandingTree?: CategoryNode[];
  paidThisMonthTotalCents?: number;
  paidThisMonthTree?: CategoryNode[];
  accountsDue?: { childId: string; name: string; amountCents: number }[];
  remindersSentCount?: number;
  remindersUnsentCount?: number;
};

type AuditApiEntry = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: string;
  actor: { name: string } | null;
};

// The 5-item view uses whatever the dashboard endpoint already fetched
// (cheap, no extra request). "This month" and "Lifetime" can both be
// larger than that endpoint's own 20-row cap, so those call the same
// paginated /audit endpoint the Settings → Activity log page uses.
type ActivityView = "recent" | "month" | "lifetime";

export default function DashboardPage() {
  const { organizationId, organizationName, hasActiveAccess, currencyCode } = useOrg();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [showAccountsDue, setShowAccountsDue] = useState(false);
  const [activityView, setActivityView] = useState<ActivityView>("recent");
  const [expandedActivity, setExpandedActivity] = useState<ActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/dashboard`);
    const json = await res.json();
    if (res.ok) {
      setData(json);
    } else {
      setError(json.error ?? "Could not load the dashboard.");
    }
  }, [organizationId]);

  useEffect(() => {
    if (!hasActiveAccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load, hasActiveAccess]);

  async function loadExpandedActivity(view: "month" | "lifetime") {
    setActivityLoading(true);
    try {
      const params = new URLSearchParams();
      if (view === "month") {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        params.set("since", startOfMonth.toISOString());
      }
      const res = await fetch(
        `/api/organizations/${organizationId}/audit?${params.toString()}`
      );
      const json = await res.json();
      if (res.ok) {
        setExpandedActivity(
          (json.entries as AuditApiEntry[]).map((e) => ({
            id: e.id,
            userName: e.actor?.name ?? "Someone",
            label: describeAuditAction(e),
            createdAt: e.createdAt,
          }))
        );
      }
    } finally {
      setActivityLoading(false);
    }
  }

  // Chevron button: recent (5 items) <-> this month.
  function toggleActivityDropdown() {
    setActivityView((v) => {
      const next = v === "recent" ? "month" : "recent";
      if (next === "month") loadExpandedActivity("month");
      return next;
    });
  }

  // Clicking the "Recent activity" label itself: this month/recent <-> lifetime.
  function toggleActivityLifetime() {
    setActivityView((v) => {
      const next = v === "lifetime" ? "recent" : "lifetime";
      if (next === "lifetime") loadExpandedActivity("lifetime");
      return next;
    });
  }

  const visibleActivity =
    activityView === "recent" ? (data?.activity.slice(0, 5) ?? []) : (expandedActivity ?? []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="animate-in">
      <h1 className="font-display mb-1 text-2xl font-semibold text-foreground">
        {greeting}, {session?.user?.name ?? ""}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">{organizationName}</p>

      {!hasActiveAccess ? (
        <p className="text-sm text-muted-foreground">
          Subscribe above to see your dashboard again.
        </p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <TodoList mode="accounting" />

          {!data.canViewMoney && (
            <p className="text-sm text-muted-foreground">
              Financial figures are hidden for your role. Ask an admin if you need to see them.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {data.canViewMoney && (
              <>
                <Card
                  as="button"
                  onClick={() => setShowOutstanding((v) => !v)}
                  className="transition-standard p-4 text-left hover:border-border-strong"
                >
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="font-display mt-1 text-2xl font-semibold text-foreground">
                    {formatCents(data.outstandingTotalCents ?? 0, currencyCode)}
                  </p>
                  <p className="mt-1 text-xs text-muted">Click to break down</p>
                </Card>
                <Card
                  as="button"
                  onClick={() => setShowPaid((v) => !v)}
                  className="transition-standard p-4 text-left hover:border-border-strong"
                >
                  <p className="text-xs text-muted-foreground">Paid this month</p>
                  <p className="font-display mt-1 text-2xl font-semibold text-success">
                    {formatCents(data.paidThisMonthTotalCents ?? 0, currencyCode)}
                  </p>
                  <p className="mt-1 text-xs text-muted">Click to break down</p>
                </Card>
              </>
            )}
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Children</p>
              <p className="font-display mt-1 text-2xl font-semibold text-foreground">
                {data.childrenCount}
              </p>
            </Card>
          </div>

          {data.canViewMoney && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link
                href="/dashboard/accounting/reminders?filter=unsent"
                className="transition-standard block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
              >
                <p className="text-xs text-muted-foreground">Reminders unsent</p>
                <p className="font-display mt-1 text-2xl font-semibold text-danger">
                  {data.remindersUnsentCount ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted">Owing parents never reminded — click to send</p>
              </Link>
              <Link
                href="/dashboard/accounting/reminders?filter=sent"
                className="transition-standard block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
              >
                <p className="text-xs text-muted-foreground">Reminders sent</p>
                <p className="font-display mt-1 text-2xl font-semibold text-foreground">
                  {data.remindersSentCount ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted">Owing parents already reminded at least once</p>
              </Link>
            </div>
          )}

          {showOutstanding && data.outstandingTree && (
            <Card className="animate-in p-4">
              <h2 className="mb-2 text-sm font-medium text-foreground">
                Outstanding by class
              </h2>
              <DrilldownTree tree={data.outstandingTree} currencyCode={currencyCode} />
            </Card>
          )}

          {showPaid && data.paidThisMonthTree && (
            <Card className="animate-in p-4">
              <h2 className="mb-2 text-sm font-medium text-foreground">
                Paid this month by class
              </h2>
              <DrilldownTree tree={data.paidThisMonthTree} currencyCode={currencyCode} />
            </Card>
          )}

          {data.canViewMoney && (
            <Card className="p-4">
              <button
                onClick={() => setShowAccountsDue((v) => !v)}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <h2 className="text-sm font-medium text-foreground">Accounts due</h2>
                <span className="text-xs text-muted">
                  {(data.accountsDue ?? []).length} account
                  {(data.accountsDue ?? []).length === 1 ? "" : "s"}
                </span>
              </button>
              {showAccountsDue && (
                <div className="animate-in divide-y divide-border">
                  {(data.accountsDue ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing owing right now.</p>
                  ) : (
                    (data.accountsDue ?? []).map((a) => (
                      <Link
                        key={a.childId}
                        href={`/dashboard/accounting/children/${a.childId}`}
                        className="transition-standard flex items-center justify-between py-2 text-sm text-foreground hover:text-brand"
                      >
                        <span className="underline">{a.name}</span>
                        <span>{formatCents(a.amountCents, currencyCode)}</span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </Card>
          )}

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleActivityLifetime}
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                Recent activity
                {activityView === "lifetime" && " — lifetime"}
                {activityView === "month" && " — this month"}
              </button>
              <button
                type="button"
                onClick={toggleActivityDropdown}
                aria-label={activityView === "recent" ? "Show this month's activity" : "Show fewer"}
                className="transition-standard rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${activityView !== "recent" ? "rotate-180" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M2.5 4.5L6 8l3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {activityLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : visibleActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {visibleActivity.map((a) => (
                  <li key={a.id} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{a.userName}</span>{" "}
                    {a.label}{" "}
                    <span className="text-xs text-muted">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
