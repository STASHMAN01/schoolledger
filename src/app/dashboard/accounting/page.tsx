"use client";

// Accounting home, matched to the Centre Management home (Dylan, 24 Sept:
// "match the dashboard of accounting to centre management but only
// necessary fields"): number tiles on the left, recent ACCOUNTING activity
// underneath, and the to-do list as a panel on the right (on top on
// phones). Money tiles open their breakdown below the tiles.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useOrg } from "../OrgContext";
import { TodoList } from "../TodoList";
import { Tile } from "../DashboardTile";
import { DrilldownTree } from "./DrilldownTree";
import { formatCents } from "@/lib/formatMoney";
import type { CategoryNode } from "@/lib/billing/dashboard";
import { Badge, Card, PageHeader } from "@/components/ui";

type ActivityItem = { id: string; userName: string; label: string; createdAt: string; entityType?: string };

type DashboardData = {
  childrenCount: number;
  canViewMoney: boolean;
  activity: ActivityItem[];
  outstandingTotalCents?: number;
  outstandingTree?: CategoryNode[];
  paidThisMonthTotalCents?: number;
  paidThisMonthTree?: CategoryNode[];
  accountsDue?: { childId: string; name: string; amountCents: number }[];
  remindersUnsentCount?: number;
};

type Panel = "outstanding" | "paid" | "due";

const ENTITY_LABEL: Record<string, string> = {
  Category: "Class",
  PaymentType: "Payment type",
  Organization: "School",
  Membership: "Team",
  Invite: "Team",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AccountingHomePage() {
  const { organizationId, organizationName, hasActiveAccess, currencyCode, permissions } = useOrg();
  const canSeeActivityLog = permissions.includes("VIEW_ACTIVITY_LOG");
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/dashboard`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json);
      else setError(json.error ?? "Could not load the dashboard.");
    } catch {
      setError("Could not load the dashboard. Check your connection and refresh.");
    }
  }, [organizationId]);

  useEffect(() => {
    if (!hasActiveAccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load, hasActiveAccess]);

  // On a phone the breakdown opens below all the tiles, so bring it into
  // view when a tile is tapped.
  useEffect(() => {
    if (panel) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [panel]);

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const money = (cents: number | undefined) => formatCents(cents ?? 0, currencyCode);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0];

  const accountsDue = data?.accountsDue ?? [];
  const unsent = data?.remindersUnsentCount ?? 0;

  return (
    <div className="animate-in">
      <PageHeader
        title="Accounting"
        description={`${greeting}${firstName ? `, ${firstName}` : ""}. Fees, payments and reminders for ${organizationName}.`}
      />

      {!hasActiveAccess ? (
        <p className="text-sm text-muted-foreground">Subscribe above to see your dashboard again.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* Left: tiles, breakdown, then activity */}
          <div className="min-w-0">
            {error ? (
              <p className="mb-8 text-sm text-danger">{error}</p>
            ) : !data ? (
              <p className="mb-8 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.canViewMoney && (
                    <>
                      <Tile
                        title="Outstanding"
                        value={money(data.outstandingTotalCents)}
                        hint={panel === "outstanding" ? "Showing by class ↓" : "Tap to see by class"}
                        compact
                        onClick={() => toggle("outstanding")}
                        expanded={panel === "outstanding"}
                      />
                      <Tile
                        title="Paid this month"
                        value={money(data.paidThisMonthTotalCents)}
                        hint={panel === "paid" ? "Showing by class ↓" : "Tap to see by class"}
                        compact
                        onClick={() => toggle("paid")}
                        expanded={panel === "paid"}
                      />
                      <Tile
                        title="Accounts due"
                        value={accountsDue.length}
                        hint={accountsDue.length === 0 ? "Nobody owes right now" : "Tap to see who owes"}
                        onClick={() => toggle("due")}
                        expanded={panel === "due"}
                      />
                      <Tile
                        title="Reminders"
                        href="/dashboard/accounting/reminders?filter=unsent"
                        value={unsent}
                        hint={unsent > 0 ? "Owing, never reminded" : "Everyone owing was reminded"}
                        warn={unsent > 0}
                      />
                    </>
                  )}
                  <Tile
                    title="Children"
                    href="/dashboard/accounting/children"
                    value={data.childrenCount}
                    hint="Active children"
                  />
                </div>

                {!data.canViewMoney && (
                  <p className="mb-6 text-sm text-muted-foreground">
                    Money figures are hidden for your role. Ask an admin if you need to see them.
                  </p>
                )}

                {panel && data.canViewMoney && (
                  <div ref={panelRef} className="mb-8 scroll-mt-4">
                    <Card as="div" className="animate-in p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h2 className="font-display text-sm font-semibold text-foreground">
                          {panel === "outstanding"
                            ? "Outstanding by class"
                            : panel === "paid"
                              ? "Paid this month by class"
                              : `Accounts due (${accountsDue.length})`}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setPanel(null)}
                          className="min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          Close
                        </button>
                      </div>
                      {panel === "outstanding" && data.outstandingTree && (
                        <DrilldownTree tree={data.outstandingTree} currencyCode={currencyCode} />
                      )}
                      {panel === "paid" && data.paidThisMonthTree && (
                        <DrilldownTree tree={data.paidThisMonthTree} currencyCode={currencyCode} />
                      )}
                      {panel === "due" &&
                        (accountsDue.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nothing owing right now.</p>
                        ) : (
                          <div className="divide-y divide-border">
                            {accountsDue.map((a) => (
                              <Link
                                key={a.childId}
                                href={`/dashboard/accounting/children/${a.childId}`}
                                className="transition-standard flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-foreground hover:text-brand"
                              >
                                <span className="underline underline-offset-2">{a.name}</span>
                                <span className="shrink-0 tabular-nums">{money(a.amountCents)}</span>
                              </Link>
                            ))}
                          </div>
                        ))}
                    </Card>
                  </div>
                )}
              </>
            )}

            <Card as="div" className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-semibold text-foreground">Recent accounting activity</h2>
                {canSeeActivityLog && (
                  <Link
                    href="/dashboard/accounting/settings/activity"
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Full log →
                  </Link>
                )}
              </div>
              {error ? (
                <p className="text-sm text-danger">Couldn&apos;t load recent activity.</p>
              ) : !data ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : data.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing yet — recording payments, sending reminders and similar will show up here.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {data.activity.slice(0, 10).map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      {a.entityType && (
                        <Badge variant="brand">{ENTITY_LABEL[a.entityType] ?? a.entityType}</Badge>
                      )}
                      <p className="min-w-0 flex-1 text-sm text-foreground">
                        <span className="font-medium">{a.userName}</span> {a.label}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right: to-do panel (on top on phones), same as Centre */}
          <aside className="order-first lg:order-none">
            <div className="lg:sticky lg:top-4 lg:min-h-[28rem]">
              <TodoList mode="accounting" variant="panel" />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
