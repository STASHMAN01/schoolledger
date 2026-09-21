"use client";

import { useState } from "react";
import { useOrg } from "./OrgContext";
import { Button } from "@/components/ui";

/**
 * A persistent, impossible-to-miss banner once trial/subscription access
 * has lapsed — paired with the server-side lockout in
 * src/lib/tenant.ts (requireMembership), which is what actually enforces
 * this rather than just suggesting it. Only ADMIN sees the subscribe
 * buttons here (billing is admin-only); everyone else sees the notice so
 * they understand why things stopped working, and knows to ask their admin.
 */
export function TrialBanner() {
  const { organizationId, permissions, hasActiveAccess, subscriptionStatus, trialEndsAt } = useOrg();
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (hasActiveAccess) return null;

  async function subscribe(plan: "monthly" | "yearly") {
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

  const reason =
    subscriptionStatus === "trialing"
      ? `Your free trial ended${trialEndsAt ? ` on ${new Date(trialEndsAt).toLocaleDateString()}` : ""}.`
      : "This school's subscription is not active.";

  return (
    <div className="border-b border-accent/30 bg-accent-soft px-6 py-3 text-sm text-accent-soft-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>{reason} Access is paused until an admin subscribes.</span>
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
