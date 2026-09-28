"use client";

import { useState } from "react";
import { useOrg } from "./OrgContext";
import { Button } from "@/components/ui";
import { formatDateZA } from "@/lib/date";

/**
 * Billing notices across the top of the dashboard:
 *  - Cancelled but still inside the paid period: a quiet heads-up with the
 *    date full access ends (everything still works until then).
 *  - No paid/trial days left: the school is READ-ONLY -- paired with the
 *    server-side check in src/lib/tenant.ts (requireMembership), which is
 *    what actually refuses changes. Admins get resubscribe buttons;
 *    everyone else is told to ask their admin.
 */
export function TrialBanner() {
  const { organizationId, permissions, hasActiveAccess, subscriptionStatus, trialEndsAt, currentPeriodEnd } =
    useOrg();
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelledButPaidUp = hasActiveAccess && subscriptionStatus === "canceled";
  if (hasActiveAccess && !cancelledButPaidUp) return null;

  async function subscribe(plan: "monthly" | "yearly") {
    setLoading(plan);
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not start checkout.");
      setLoading(null);
      return;
    }
    window.location.href = data.url;
  }

  if (cancelledButPaidUp) {
    return (
      <div className="border-b border-border bg-surface px-6 py-2.5 text-sm text-muted-foreground">
        <div className="mx-auto max-w-6xl">
          Your subscription is cancelled. You have full access until{" "}
          <span className="font-medium text-foreground">{formatDateZA(currentPeriodEnd)}</span>, after which
          the school becomes read-only.
          {permissions.includes("MANAGE_BILLING") && " You can resubscribe any time under Settings → Billing."}
        </div>
      </div>
    );
  }

  const reason =
    subscriptionStatus === "trialing"
      ? `Your free trial ended${trialEndsAt ? ` on ${formatDateZA(trialEndsAt)}` : ""}.`
      : `This school's subscription ended${currentPeriodEnd ? ` on ${formatDateZA(currentPeriodEnd)}` : ""}.`;

  return (
    <div className="border-b border-accent/30 bg-accent-soft px-6 py-3 text-sm text-accent-soft-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>
          {reason} The school is <span className="font-semibold">read-only</span>: you can view everything, but
          nothing can be added or changed until {permissions.includes("MANAGE_BILLING") ? "you resubscribe" : "an admin resubscribes"}.
        </span>
        {permissions.includes("MANAGE_BILLING") && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => subscribe("monthly")} disabled={loading !== null}>
              {loading === "monthly" ? "Redirecting…" : "Subscribe monthly"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => subscribe("yearly")}
              disabled={loading !== null}
            >
              {loading === "yearly" ? "Redirecting…" : "Subscribe yearly"}
            </Button>
          </div>
        )}
      </div>
      {error && <p className="mx-auto mt-1 max-w-6xl text-danger">{error}</p>}
    </div>
  );
}
