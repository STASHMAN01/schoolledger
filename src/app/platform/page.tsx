"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";

type Overview = {
  totalOrganizations: number;
  payingTotal: number;
  payingMonthly: number;
  payingYearly: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  mrrCents: number | null;
  arrCents: number | null;
  priceCents: { monthly: number | null; yearly: number | null };
  countries: { countryCode: string; countryName: string; count: number }[];
};

// Platform revenue is always USD from Stripe's own price objects here
// (this app's per-school currencyCode is a separate, unrelated concept —
// what a school charges parents in ZAR/USD/etc has nothing to do with
// what that school pays SchoolLedger).
function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export default function PlatformOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/platform/overview");
    const json = await res.json();
    if (res.ok) setData(json);
    else setError(json.error ?? "Could not load platform stats.");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error || !data) return <p className="text-sm text-danger">{error ?? "Something went wrong."}</p>;

  const maxCountryCount = Math.max(1, ...data.countries.map((c) => c.count));
  const freeTrialCount = data.trialing;

  return (
    <div className="animate-in">
      <PageHeader
        title="Platform overview"
        description="Cross-school metrics — not visible to any school's own users."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Registered schools" value={String(data.totalOrganizations)} />
        <StatCard
          label="Paying subscribers"
          value={String(data.payingTotal)}
          hint={`${data.payingMonthly} monthly · ${data.payingYearly} yearly`}
        />
        <StatCard label="On free trial" value={String(freeTrialCount)} />
        <StatCard
          label="Past due / canceled"
          value={`${data.pastDue} / ${data.canceled}`}
          hint="Stripe still retrying past-due cards"
        />
        <StatCard
          label="MRR"
          value={data.mrrCents !== null ? formatUsd(data.mrrCents) : "—"}
          hint={data.mrrCents === null ? "Set STRIPE_PRICE_ID_MONTHLY/YEARLY to see this" : "Monthly recurring revenue"}
        />
        <StatCard
          label="ARR"
          value={data.arrCents !== null ? formatUsd(data.arrCents) : "—"}
          hint="Annualized run rate"
        />
        <StatCard
          label="Monthly plan price"
          value={data.priceCents.monthly !== null ? formatUsd(data.priceCents.monthly) : "—"}
        />
        <StatCard
          label="Yearly plan price"
          value={data.priceCents.yearly !== null ? formatUsd(data.priceCents.yearly) : "—"}
        />
      </div>

      <h2 className="font-display mb-3 text-lg font-medium text-foreground">Schools by country</h2>
      {data.countries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schools registered yet.</p>
      ) : (
        <Card className="p-5">
          <div className="flex flex-col gap-3">
            {data.countries.map((c) => (
              <div key={c.countryCode} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-foreground">
                  {c.countryName} <span className="text-muted-foreground">({c.countryCode})</span>
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(c.count / maxCountryCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium text-foreground">
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
