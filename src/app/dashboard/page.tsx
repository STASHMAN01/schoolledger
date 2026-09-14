"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useOrg } from "./OrgContext";
import { DrilldownTree } from "./DrilldownTree";
import { formatCents } from "@/lib/formatMoney";
import type { CategoryNode } from "@/lib/billing/dashboard";
import { Card } from "@/components/ui";

type DashboardData = {
  childrenCount: number;
  outstandingTotalCents: number;
  outstandingTree: CategoryNode[];
  paidThisMonthTotalCents: number;
  paidThisMonthTree: CategoryNode[];
  accountsDue: { childId: string; name: string; amountCents: number }[];
  activity: { id: string; userName: string; label: string; createdAt: string }[];
};

export default function DashboardPage() {
  const { organizationId, organizationName, hasActiveAccess } = useOrg();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [showAccountsDue, setShowAccountsDue] = useState(false);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card
              as="button"
              onClick={() => setShowOutstanding((v) => !v)}
              className="transition-standard p-4 text-left hover:border-border-strong"
            >
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-display mt-1 text-2xl font-semibold text-foreground">
                {formatCents(data.outstandingTotalCents)}
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
                {formatCents(data.paidThisMonthTotalCents)}
              </p>
              <p className="mt-1 text-xs text-muted">Click to break down</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Children</p>
              <p className="font-display mt-1 text-2xl font-semibold text-foreground">
                {data.childrenCount}
              </p>
            </Card>
          </div>

          {showOutstanding && (
            <Card className="animate-in p-4">
              <h2 className="mb-2 text-sm font-medium text-foreground">
                Outstanding by category
              </h2>
              <DrilldownTree tree={data.outstandingTree} />
            </Card>
          )}

          {showPaid && (
            <Card className="animate-in p-4">
              <h2 className="mb-2 text-sm font-medium text-foreground">
                Paid this month by category
              </h2>
              <DrilldownTree tree={data.paidThisMonthTree} />
            </Card>
          )}

          <Card className="p-4">
            <button
              onClick={() => setShowAccountsDue((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <h2 className="text-sm font-medium text-foreground">Accounts due</h2>
              <span className="text-xs text-muted">
                {data.accountsDue.length} account{data.accountsDue.length === 1 ? "" : "s"}
              </span>
            </button>
            {showAccountsDue && (
              <div className="animate-in divide-y divide-border">
                {data.accountsDue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing owing right now.</p>
                ) : (
                  data.accountsDue.map((a) => (
                    <Link
                      key={a.childId}
                      href={`/dashboard/children/${a.childId}`}
                      className="transition-standard flex items-center justify-between py-2 text-sm text-foreground hover:text-brand"
                    >
                      <span className="underline">{a.name}</span>
                      <span>{formatCents(a.amountCents)}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-medium text-foreground">Recent activity</h2>
            {data.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.activity.map((a) => (
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
