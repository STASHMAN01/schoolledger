"use client";

import { useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, PageHeader } from "@/components/ui";

export default function BillingPage() {
  const { organizationId, role, subscriptionStatus, trialEndsAt, hasActiveAccess } = useOrg();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function openPortal() {
    setLoading("portal");
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/billing/portal`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not open billing portal.");
      setLoading(null);
      return;
    }
    window.location.href = data.url;
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
        <Button onClick={openPortal} disabled={loading !== null}>
          {loading === "portal" ? "Opening..." : "Manage subscription"}
        </Button>
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
