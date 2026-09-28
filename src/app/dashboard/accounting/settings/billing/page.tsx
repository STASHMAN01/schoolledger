"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../../OrgContext";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { formatDateZA } from "@/lib/date";
import { formatMoneyCents } from "@/lib/money";

type BillingConfig = { monthlyConfigured: boolean; yearlyConfigured: boolean };

type SubscriptionPayment = {
  id: string;
  receiptNumber: string;
  paidAt: string;
  amountCents: number;
  currencyCode: string;
  planInterval: string | null;
  planName: string | null;
  periodStart: string;
  periodEnd: string;
  cardBrand: string | null;
  cardLast4: string | null;
  channel: string | null;
};

function planLabel(p: Pick<SubscriptionPayment, "planInterval" | "planName">) {
  if (p.planInterval === "annually") return "Yearly";
  if (p.planInterval === "monthly") return "Monthly";
  return p.planName ?? "Subscription";
}

function paidWith(p: SubscriptionPayment) {
  if (p.cardLast4) {
    const brand = p.cardBrand ? p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1) : "Card";
    return `${brand} •••• ${p.cardLast4}`;
  }
  return p.channel ? p.channel.replace(/_/g, " ") : "—";
}

export default function BillingPage() {
  const { organizationId, permissions, subscriptionStatus, trialEndsAt, currentPeriodEnd, hasActiveAccess } =
    useOrg();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // null while loading — treated as "not yet known" so the buttons don't
  // flash enabled-then-disabled. Checked once on mount; whoever finishes
  // setting up Paystack just needs to reload this page afterward.
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[] | null>(null);

  const canManage = permissions.includes("MANAGE_BILLING");

  const load = useCallback(async () => {
    const [configRes, paymentsRes] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/billing/config`),
      fetch(`/api/organizations/${organizationId}/billing/payments`),
    ]);
    if (configRes.ok) setConfig(await configRes.json().catch(() => ({})));
    else setError("Couldn't load your billing details. Please refresh the page.");
    if (paymentsRes.ok) {
      const data = await paymentsRes.json().catch(() => ({}));
      setPayments(data.payments ?? []);
    } else {
      setPayments([]);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!canManage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load, canManage]);

  async function checkout(plan: "monthly" | "yearly") {
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

  async function cancelSubscription() {
    setLoading("cancel");
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/billing/cancel`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
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

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Only an admin can manage billing.</p>;
  }

  const isPaid = subscriptionStatus === "active" || subscriptionStatus === "past_due";
  const isLifetime = subscriptionStatus === "lifetime";
  const latestPlan = payments && payments.length > 0 ? planLabel(payments[0]) : null;

  // One plain-language status line + detail, instead of the raw status word.
  let statusTitle: string;
  let statusDetail: string | null = null;
  if (isLifetime) {
    statusTitle = "Lifetime membership";
    statusDetail = "Full access, no payments due.";
  } else if (subscriptionStatus === "active") {
    statusTitle = latestPlan ? `Active · ${latestPlan} plan` : "Active";
    statusDetail = currentPeriodEnd ? `Renews on ${formatDateZA(currentPeriodEnd)}.` : null;
  } else if (subscriptionStatus === "past_due") {
    statusTitle = "Payment failed";
    statusDetail =
      "Your last renewal payment didn't go through. Paystack will retry it automatically; you keep full access meanwhile.";
  } else if (subscriptionStatus === "trialing" && hasActiveAccess) {
    statusTitle = "Free trial";
    statusDetail = trialEndsAt ? `Trial ends ${formatDateZA(trialEndsAt)}.` : null;
  } else if (subscriptionStatus === "canceled" && hasActiveAccess) {
    statusTitle = "Cancelled";
    statusDetail = `You keep full access until ${formatDateZA(currentPeriodEnd)}. After that the school becomes read-only until you subscribe again.`;
  } else {
    statusTitle = "Read-only";
    statusDetail =
      subscriptionStatus === "trialing"
        ? `Your free trial ended${trialEndsAt ? ` on ${formatDateZA(trialEndsAt)}` : ""}. Everything is still visible, but nothing can be added or changed until you subscribe.`
        : `Your subscription ended${currentPeriodEnd ? ` on ${formatDateZA(currentPeriodEnd)}` : ""}. Everything is still visible, but nothing can be added or changed until you subscribe again.`;
  }

  return (
    <div className="animate-in">
      <PageHeader title="Billing" />

      <Card className="mb-6 p-4">
        <p className="text-sm text-muted-foreground">Current status</p>
        <p className={`font-display text-lg font-medium ${hasActiveAccess ? "text-foreground" : "text-danger"}`}>
          {statusTitle}
        </p>
        {statusDetail && <p className="mt-1 text-sm text-muted-foreground">{statusDetail}</p>}
      </Card>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {isLifetime ? null : isPaid ? (
        confirmingCancel ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-foreground">
              Cancel your subscription? You won&apos;t be charged again, and you keep full access
              {currentPeriodEnd ? ` until ${formatDateZA(currentPeriodEnd)}` : " until the end of the period you've paid for"}.
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
        <div>
          {config && !config.monthlyConfigured && !config.yearlyConfigured && (
            <p className="mb-4 text-sm text-muted-foreground">
              Billing isn&apos;t set up yet — check back shortly.
            </p>
          )}
          {subscriptionStatus === "canceled" && hasActiveAccess && (
            <p className="mb-3 text-sm text-muted-foreground">
              Subscribing again starts a new billing period from today.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Card className="p-4">
              <p className="mb-1 font-medium text-foreground">Monthly</p>
              <p className="mb-3 text-sm text-muted-foreground">R499/month</p>
              <Button
                onClick={() => checkout("monthly")}
                disabled={loading !== null || !config?.monthlyConfigured}
              >
                {loading === "monthly" ? "Redirecting..." : "Subscribe monthly"}
              </Button>
            </Card>
            <Card className="p-4">
              <p className="mb-1 font-medium text-foreground">Yearly</p>
              <p className="mb-3 text-sm text-muted-foreground">
                R4,990/year <span className="text-muted">— save R998 vs. monthly</span>
              </p>
              <Button
                onClick={() => checkout("yearly")}
                disabled={loading !== null || !config?.yearlyConfigured}
              >
                {loading === "yearly" ? "Redirecting..." : "Subscribe yearly"}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* Payment history + receipts (Dylan, 28 Sept 2026): every Crechely
          payment this school has made, each with a PDF receipt they can
          file as a business expense. */}
      <h2 className="font-display mb-3 mt-10 text-base font-semibold text-foreground">Payment history</h2>
      {payments === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : payments.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No payments yet. Each payment you make shows up here with a receipt you can download.
        </Card>
      ) : (
        <Card as="div" className="divide-y divide-border">
          {payments.map((p) => {
            const receiptUrl = `/api/organizations/${organizationId}/billing/payments/${p.id}/receipt`;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="min-w-36">
                  <p className="font-medium text-foreground">{formatDateZA(p.paidAt)}</p>
                  <p className="text-xs text-muted-foreground">{p.receiptNumber}</p>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-foreground">
                    {planLabel(p)} plan{" "}
                    <Badge variant="success" className="ml-1">
                      Paid
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateZA(p.periodStart)} – {formatDateZA(p.periodEnd)} · {paidWith(p)}
                  </p>
                </div>
                <p className="font-display w-24 text-right font-semibold text-foreground">
                  {formatMoneyCents(p.amountCents, p.currencyCode)}
                </p>
                <div className="flex gap-2">
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-sm text-foreground hover:bg-background"
                  >
                    View receipt
                  </a>
                  <a
                    href={`${receiptUrl}?download=1`}
                    className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-brand underline"
                  >
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
