"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";

type Org = {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  currencyCode: string;
  subscriptionStatus: string;
  plan: "monthly" | "yearly" | "trial" | "lifetime" | "unknown";
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
  lifetime: "Lifetime",
  unknown: "None",
};

// The statuses a platform admin can force an org to from the row action
// below — kept in sync with MANUAL_STATUSES in the PATCH route.
const MANUAL_STATUSES = [
  { value: "lifetime", label: "Lifetime (manual grant)" },
  { value: "active", label: "Active (paid)" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
] as const;

function statusBadge(org: Org) {
  if (org.plan === "lifetime") return <Badge variant="success">Lifetime</Badge>;
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

// One row's manual-override control: pick a status, apply it. Kept as its
// own small component so each row has independent pending/error state
// (applying one school's override never disables the others' controls).
function OrgActionCell({ org, onChanged }: { org: Org; onChanged: (org: Org) => void }) {
  const [value, setValue] = useState<(typeof MANUAL_STATUSES)[number]["value"]>(
    (org.plan === "lifetime" ? "lifetime" : org.subscriptionStatus) as (typeof MANUAL_STATUSES)[number]["value"]
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionStatus: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update.");
        return;
      }
      onChanged({
        ...org,
        subscriptionStatus: data.organization.subscriptionStatus,
        trialEndsAt: data.organization.trialEndsAt,
        currentPeriodEnd: data.organization.currentPeriodEnd,
        plan: data.organization.subscriptionStatus === "lifetime" ? "lifetime" : org.plan,
        isPaying:
          data.organization.subscriptionStatus === "active" ||
          data.organization.subscriptionStatus === "past_due" ||
          data.organization.subscriptionStatus === "lifetime",
        isTrialing: data.organization.subscriptionStatus === "trialing",
      });
    } finally {
      setPending(false);
    }
  }

  const unchanged =
    value === org.subscriptionStatus || (value === "lifetime" && org.plan === "lifetime");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Select
          className="w-auto text-xs"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value as typeof value)}
        >
          {MANUAL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          className="px-2 py-1 text-xs"
          disabled={pending || unchanged}
          onClick={apply}
        >
          {pending ? "Saving…" : "Set"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
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
    const data = await res.json().catch(() => ({}));
    if (res.ok) setOrgs(data.organizations);
    else setError(data.error ?? "Could not load schools.");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  const handleChanged = useCallback((updated: Org) => {
    setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);

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
                <th className="px-3 py-2 font-medium">Manual override</th>
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
                    {o.plan === "lifetime"
                      ? "Lifetime"
                      : o.currentPeriodEnd
                        ? new Date(o.currentPeriodEnd).toLocaleDateString()
                        : o.trialEndsAt
                          ? `Trial ends ${new Date(o.trialEndsAt).toLocaleDateString()}`
                          : "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground">{o.memberCount}</td>
                  <td className="px-3 py-2 text-foreground">{o.childrenCount}</td>
                  <td className="px-3 py-2">
                    <OrgActionCell org={o} onChanged={handleChanged} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
