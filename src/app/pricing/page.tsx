import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

const PLANS = [
  {
    name: "Monthly",
    note: "Pay as you go, cancel any time — no contract.",
    price: "R499.00",
    period: "/ month",
    highlight: false,
  },
  {
    name: "Yearly",
    note: "Billed once a year. Saves R998 — almost 2 months free.",
    price: "R4,990.00",
    period: "/ year",
    highlight: true,
  },
];

// Framed as what you get to stop doing, not a feature checklist — a parent
// or an accountant would ask "so what does this actually do for me," and
// this is the honest answer to that, item by item.
const INCLUDED = [
  "Never manually work out who's paid and who owes you again",
  "Fees bill themselves every month — no more doing the sums by hand",
  "Every cash, EFT, and card payment tracked and applied correctly",
  "A proper statement, ready to send, in one click",
  "Automatic reminders to families who haven't paid — you don't send them",
  "Collect for a trip or event from every family in one step",
  "Your bookkeeper or a teacher gets exactly the access they need, nothing more",
  "A full record of who did what, so nothing gets lost or disputed",
  "Works in your currency, no conversion or setup needed",
  "A real person to email when something's wrong",
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
            Less than one term of one child&rsquo;s fees. Covers your whole school.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            No tiers, nothing locked behind a higher price, nothing to
            upgrade into later.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="text-success">✓</span> No card, no commitment — free for 14 days.
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
              What you stop having to do yourself
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
            Not sure yet? Start the free trial — no card needed — and decide
            once you&rsquo;ve actually used it with your real families. You can{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              start free
            </Link>{" "}
            and pick a plan from inside your dashboard whenever you&rsquo;re ready.
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
