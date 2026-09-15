import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

const PLANS = [
  {
    name: "Monthly",
    note: "Pay as you go, cancel any time.",
    price: "$50.00",
    period: "/ month",
    highlight: false,
  },
  {
    name: "Yearly",
    note: "Billed once a year. Saves $150 — like getting 3 months free.",
    price: "$450.00",
    period: "/ year",
    highlight: true,
  },
];

const INCLUDED = [
  "Unlimited children & enrollments",
  "Recurring and one-off fees",
  "Payment tracking (cash, EFT, card)",
  "Parent statements & CSV export",
  "Multi-currency support",
  "Team invites with roles",
  "Events & trip payment collection",
  "Automated payment reminders",
  "Audit log",
  "Email support",
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand">
            Pricing
          </p>
          <h1 className="font-display mt-3 max-w-lg text-3xl font-semibold text-foreground sm:text-4xl">
            One plan. Every feature. Pick how often you pay.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            No tiers to compare, nothing locked behind a higher price.
            14 days free before either one starts billing.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
          <div className="border border-border-strong bg-surface">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col gap-4 border-b border-border-strong px-5 py-6 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                  plan.highlight ? "bg-brand-soft/40" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-semibold text-foreground">
                      {plan.name}
                    </span>
                    {plan.highlight && (
                      <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-brand">
                        Best value
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{plan.note}</p>
                </div>
                <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-2">
                  <div className="font-mono text-right text-2xl font-semibold text-foreground">
                    {plan.price}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                  <LinkButton href="/register" size="sm">
                    Start free trial
                  </LinkButton>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-8">
            <h2 className="font-display text-base font-semibold text-foreground">
              Included on every plan
            </h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-2 text-sm text-foreground before:content-['—'] before:text-muted"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 text-sm text-muted-foreground">
            Questions about pricing?{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              Start a free trial
            </Link>{" "}
            — you can pick a plan, or stay on trial, from inside your dashboard.
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
