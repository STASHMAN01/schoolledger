"use client";

import { useState } from "react";
import { useOrg } from "../../OrgContext";

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
    return <p className="text-sm text-neutral-500">Only an admin can manage billing.</p>;
  }

  const isPaid = subscriptionStatus === "active" || subscriptionStatus === "past_due";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Billing</h1>

      <div className="mb-6 rounded border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">Current status</p>
        <p className="text-lg font-medium capitalize">{subscriptionStatus.replace("_", " ")}</p>
        {subscriptionStatus === "trialing" && trialEndsAt && (
          <p className="mt-1 text-sm text-neutral-500">
            Trial ends {new Date(trialEndsAt).toLocaleDateString()}
          </p>
        )}
        {!hasActiveAccess && (
          <p className="mt-2 text-sm text-red-600">
            Access is currently paused. Subscribe below to restore it immediately.
          </p>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {isPaid ? (
        <button
          onClick={openPortal}
          disabled={loading !== null}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading === "portal" ? "Opening..." : "Manage subscription"}
        </button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <div className="rounded border border-neutral-200 p-4">
            <p className="mb-1 font-medium">Monthly</p>
            <p className="mb-3 text-sm text-neutral-500">$50/month</p>
            <button
              onClick={() => checkout("monthly")}
              disabled={loading !== null}
              className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {loading === "monthly" ? "Redirecting..." : "Subscribe monthly"}
            </button>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="mb-1 font-medium">Yearly</p>
            <p className="mb-3 text-sm text-neutral-500">Save vs. paying monthly</p>
            <button
              onClick={() => checkout("yearly")}
              disabled={loading !== null}
              className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {loading === "yearly" ? "Redirecting..." : "Subscribe yearly"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
