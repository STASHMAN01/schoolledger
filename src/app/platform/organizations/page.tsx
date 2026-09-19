"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Input, PageHeader, Select } from "@/components/ui";

type Org = {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  currencyCode: string;
  subscriptionStatus: string;
  plan: "monthly" | "yearly" | "trial" | "unknown";
  isPaying: boolean;
  isTrialing: boolean;
  createdAt: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  memberCount: number;
  childrenCount: number;
  hasPaystackCustomer: boolean;
};

const planLabel: Record<Org["plan"], string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  trial: "Trial",
  unknown: "None",
};

function statusBadge(org: Org) {
  if (org.isPaying) return <Badge variant="success">Paying · {planLabel[org.plan]}</Badge>;
  if (org.isTrialing) return <Badge variant="accent">Trialing</Badge>;
  if (org.subscriptionStatus === "past_due") return <Badge variant="danger">Past due</Badge>;
  return <Badge variant="neutral">{org.subscriptionStatus}</Badge>;
}

function daysSince(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30);
  return `${months} mo`;
}

export default function PlatformOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paying" | "trial" | "past_due" | "canceled">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/platform/organizations");
    const data = await res.json();
    if (res.ok) setOrgs(data.organizations);
    else setError(data.error ?? "Could not load schools.");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  const searchLower = search.trim().toLowerCase();
  const visible = orgs.filter((o) => {
    if (searchLower && !`${o.name} ${o.countryName}`.toLowerCase().includes(searchLower)) return false;
    if (filter === "paying" && !o.isPaying) return false;
    if (filter === "trial" && !o.isTrialing) return false;
    if (filter === "past_due" && o.subscriptionStatus !== "past_due") return false;
    if (filter === "canceled" && o.subscriptionStatus !== "canceled") return false;
    return true;
  });

  return (
    <div className="animate-in">
      <PageHeader title="Schools" description={`${orgs.length} registered`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          type="search"
          placeholder="Search by name or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-auto"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">All statuses</option>
          <option value="paying">Paying</option>
          <option value="trial">On trial</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
        </Select>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schools match.</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">School</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Signed up</th>
                <th className="px-3 py-2 font-medium">Renews/expires</th>
                <th className="px-3 py-2 font-medium">Members</th>
                <th className="px-3 py-2 font-medium">Children</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 text-foreground">{o.name}</td>
                  <td className="px-3 py-2 text-foreground">
                    {o.countryName} <span className="text-muted-foreground">({o.countryCode})</span>
                  </td>
                  <td className="px-3 py-2">{statusBadge(o)}</td>
                  <td className="px-3 py-2 text-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}{" "}
                    <span className="text-muted-foreground">
                      ({daysSince(o.createdAt)}{o.isPaying ? " paying" : ""})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {o.currentPeriodEnd
                      ? new Date(o.currentPeriodEnd).toLocaleDateString()
                      : o.trialEndsAt
                        ? `Trial ends ${new Date(o.trialEndsAt).toLocaleDateString()}`
                        : "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground">{o.memberCount}</td>
                  <td className="px-3 py-2 text-foreground">{o.childrenCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
