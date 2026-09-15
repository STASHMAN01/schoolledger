import Link from "next/link";
import { Badge, Card, LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

const INCLUDED = [
  "Unlimited children & enrollments",
  "Recurring and one-off fees",
  "Payment tracking (cash, EFT, card)",
  "Parent statements & CSV export",
  "Multi-currency support",
  "Team invites with roles",
  "Audit log",
  "Email support",
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            One plan. Every feature included.
          </h1>
          <p className="mt-4 text-muted-foreground">
            No tiers to compare, no features locked behind a higher plan.
            Start with a 14-day free trial — no card required.
          </p>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Monthly */}
            <Card className="animate-in flex flex-col p-8">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Monthly
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pay as you go, cancel any time.
              </p>
              <div className="mt-6">
                <span className="font-display text-4xl font-semibold text-foreground">
                  $50
                </span>
                <span className="text-muted-foreground"> / month</span>
              </div>
              <LinkButton href="/register" className="mt-6" size="md">
                Start free trial
              </LinkButton>
            </Card>

            {/* Yearly */}
            <Card className="animate-in relative flex flex-col p-8 shadow-md ring-2 ring-brand ring-inset">
              <Badge variant="brand" className="absolute -top-3 left-8">
                Save 25% — 3 months free
              </Badge>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Yearly
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Billed once a year. Best value.
              </p>
              <div className="mt-6">
                <span className="font-display text-4xl font-semibold text-foreground">
                  $450
                </span>
                <span className="text-muted-foreground"> / year</span>
              </div>
              <p className="mt-1 text-sm text-success">
                That&apos;s $150 less than paying monthly — like getting 3
                months free.
              </p>
              <LinkButton href="/register" className="mt-6" size="md">
                Start free trial
              </LinkButton>
            </Card>
          </div>

          <Card className="animate-in mt-6 p-8">
            <h3 className="font-display mb-4 text-base font-semibold text-foreground">
              Everything included, on every plan
            </h3>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Questions about pricing?{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              Start a free trial
            </Link>{" "}
            — you can pick a plan (or stay on trial) from inside your dashboard.
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
