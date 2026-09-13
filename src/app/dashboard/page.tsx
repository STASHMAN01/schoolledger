"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useOrg } from "./OrgContext";
import { DrilldownTree } from "./DrilldownTree";
import { formatCents } from "@/lib/formatMoney";
import type { CategoryNode } from "@/lib/billing/dashboard";

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
    <div>
      <h1 className="mb-1 text-2xl font-semibold">
        {greeting}, {session?.user?.name ?? ""}
      </h1>
      <p className="mb-8 text-sm text-neutral-500">{organizationName}</p>

      {!hasActiveAccess ? (
        <p className="text-sm text-neutral-500">
          Subscribe above to see your dashboard again.
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={() => setShowOutstanding((v) => !v)}
              className="rounded border border-neutral-200 p-4 text-left"
            >
              <p className="text-xs text-neutral-500">Outstanding</p>
              <p className="text-2xl font-semibold">
                {formatCents(data.outstandingTotalCents)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Click to break down</p>
            </button>
            <button
              onClick={() => setShowPaid((v) => !v)}
              className="rounded border border-neutral-200 p-4 text-left"
            >
              <p className="text-xs text-neutral-500">Paid this month</p>
              <p className="text-2xl font-semibold">
                {formatCents(data.paidThisMonthTotalCents)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Click to break down</p>
            </button>
            <div className="rounded border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">Children</p>
              <p className="text-2xl font-semibold">{data.childrenCount}</p>
            </div>
          </div>

          {showOutstanding && (
            <div className="rounded border border-neutral-200 p-4">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">
                Outstanding by category
              </h2>
              <DrilldownTree tree={data.outstandingTree} />
            </div>
          )}

          {showPaid && (
            <div className="rounded border border-neutral-200 p-4">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">
                Paid this month by category
              </h2>
              <DrilldownTree tree={data.paidThisMonthTree} />
            </div>
          )}

          <div className="rounded border border-neutral-200 p-4">
            <button
              onClick={() => setShowAccountsDue((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <h2 className="text-sm font-medium text-neutral-700">Accounts due</h2>
              <span className="text-xs text-neutral-400">
                {data.accountsDue.length} account{data.accountsDue.length === 1 ? "" : "s"}
              </span>
            </button>
            {showAccountsDue && (
              <div className="divide-y divide-neutral-100">
                {data.accountsDue.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nothing owing right now.</p>
                ) : (
                  data.accountsDue.map((a) => (
                    <Link
                      key={a.childId}
                      href={`/dashboard/children/${a.childId}`}
                      className="flex items-center justify-between py-2 text-sm hover:text-neutral-900"
                    >
                      <span className="underline">{a.name}</span>
                      <span>{formatCents(a.amountCents)}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded border border-neutral-200 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-700">Recent activity</h2>
            {data.activity.length === 0 ? (
              <p className="text-sm text-neutral-500">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.activity.map((a) => (
                  <li key={a.id} className="text-sm text-neutral-600">
                    <span className="font-medium text-neutral-800">{a.userName}</span>{" "}
                    {a.label}{" "}
                    <span className="text-xs text-neutral-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
