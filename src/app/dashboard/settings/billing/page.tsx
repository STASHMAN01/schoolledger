"use client";

import { useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, PageHeader } from "@/components/ui";

export default function BillingPage() {
  const { organizationId, role, subscriptionStatus, trialEndsAt, hasActiveAccess } = useOrg();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function checkout(plan: "monthly" | "yearly") {
    setLoading(plan);
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not start checkout.");
      setLoading(null);
      return;
    }
    window.location.href = data.url;
  }

  async function cancelSubscription() {
    setLoading("cancel");
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/billing/cancel`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Could not cancel subscription.");
      return;
    }
    setConfirmingCancel(false);
    // Paystack has no session/customer object to refresh client-side —
    // simplest reliable way to reflect the new status is to reload the
    // org context from the server.
    window.location.reload();
  }

  if (role !== "ADMIN") {
    return <p className="text-sm text-muted-foreground">Only an admin can manage billing.</p>;
  }

  const isPaid = subscriptionStatus === "active" || subscriptionStatus === "past_due";

  return (
    <div className="animate-in">
      <PageHeader title="Billing" />

      <Card className="mb-6 p-4">
        <p className="text-sm text-muted-foreground">Current status</p>
        <p className="font-display text-lg font-medium capitalize text-foreground">
          {subscriptionStatus.replace("_", " ")}
        </p>
        {subscriptionStatus === "trialing" && trialEndsAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            Trial ends {new Date(trialEndsAt).toLocaleDateString()}
          </p>
        )}
        {!hasActiveAccess && (
          <p className="mt-2 text-sm text-danger">
            Access is currently paused. Subscribe below to restore it immediately.
          </p>
        )}
      </Card>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {isPaid ? (
        confirmingCancel ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-foreground">
              Cancel your subscription? You&apos;ll keep access until the end of the current
              billing period.
            </p>
            <Button onClick={cancelSubscription} disabled={loading !== null} variant="danger">
              {loading === "cancel" ? "Cancelling..." : "Yes, cancel"}
            </Button>
            <Button onClick={() => setConfirmingCancel(false)} disabled={loading !== null} variant="secondary">
              Never mind
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirmingCancel(true)} disabled={loading !== null} variant="secondary">
            Cancel subscription
          </Button>
        )
      ) : (
        <div className="flex flex-wrap gap-3">
          <Card className="p-4">
            <p className="mb-1 font-medium text-foreground">Monthly</p>
            <p className="mb-3 text-sm text-muted-foreground">R499/month</p>
            <Button onClick={() => checkout("monthly")} disabled={loading !== null}>
              {loading === "monthly" ? "Redirecting..." : "Subscribe monthly"}
            </Button>
          </Card>
          <Card className="p-4">
            <p className="mb-1 font-medium text-foreground">Yearly</p>
            <p className="mb-3 text-sm text-muted-foreground">Save vs. paying monthly</p>
            <Button onClick={() => checkout("yearly")} disabled={loading !== null}>
              {loading === "yearly" ? "Redirecting..." : "Subscribe yearly"}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
