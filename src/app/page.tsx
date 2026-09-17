import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Reveal } from "@/components/Reveal";

// A real (fictional) excerpt of what the product actually produces —
// standing in for the "dashboard screenshot" hero image without being one.
const STATEMENT_ROWS = [
  { label: "Naledi M. — School fees", amount: "R 850.00", status: "Paid", paid: true },
  { label: "Naledi M. — Aftercare", amount: "R 300.00", status: "Paid", paid: true },
  { label: "Thabo K. — School fees", amount: "R 850.00", status: "Due 1 Oct", paid: false },
  { label: "Amahle N. — Registration", amount: "R 200.00", status: "Paid", paid: true },
];

const WHO_ITS_FOR = [
  {
    label: "Preschools & nurseries",
    description:
      "Track enrollments, recurring school fees, and which families are up to date — without a spreadsheet only one person understands.",
  },
  {
    label: "Crèches & daycares",
    description:
      "Built for the way small early-years operators actually get paid: cash, EFT, and card, often on different days for different families.",
  },
  {
    label: "Small private schools",
    description:
      "Registration, uniforms, trips, aftercare — one place for every payment type, with statements you can hand a parent or a bookkeeper.",
  },
];

const FEATURES = [
  {
    term: "Children & enrollments",
    definition: "Category, parent contact details, enrollment date, and fee overrides in one record.",
  },
  {
    term: "Recurring & one-off fees",
    definition: "School fees bill automatically every period. Uniforms and trips are one-time charges.",
  },
  {
    term: "Payment tracking",
    definition: "Cash, EFT, and card, applied oldest-outstanding-first, so nothing quietly slips through.",
  },
  {
    term: "Parent statements",
    definition: "A clean statement of what's paid and what's owed, ready to send or print.",
  },
  {
    term: "Multi-currency",
    definition: "Set your school's currency once; every amount on every screen follows it.",
  },
  {
    term: "Team access with roles",
    definition: "Admin, accountant, manager, or viewer — each sees exactly what their role needs.",
  },
];

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero — asymmetric, left-set. No centered pill badge, no dashboard
            screenshot; the "statement" panel is the actual shape of the
            product's real output, typeset rather than photographed. */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-16">
            <div className="animate-in">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand">
                Fee tracking for preschools, nurseries &amp; crèches
              </p>
              <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl">
                Every fee, every family, one page that actually balances.
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground">
                Crechely replaces the notebook-plus-spreadsheet-plus-memory
                system most small schools run on. Enrollments, recurring fees,
                and every cash, EFT, or card payment — always current, always
                accounted for.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <LinkButton href="/register" size="md" className="px-6 py-3 text-base">
                  Start your free trial
                </LinkButton>
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                >
                  See pricing →
                </Link>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                14 days free. No card required to start.
              </p>
            </div>

            {/* The statement panel */}
            <div className="lg:pt-1">
              <div className="border border-border-strong bg-surface">
                <div className="flex items-baseline justify-between border-b border-border-strong px-5 py-3">
                  <span className="font-display text-sm font-semibold text-foreground">
                    Little Acorns Preschool
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">Sep 2026</span>
                </div>
                <dl className="divide-y divide-border">
                  {STATEMENT_ROWS.map((row) => (
                    <div key={row.label} className="flex items-baseline gap-3 px-5 py-3">
                      <dt className="text-sm text-foreground">{row.label}</dt>
                      <div
                        className="flex-1 border-b border-dotted border-border-strong"
                        aria-hidden="true"
                      />
                      <dd className="font-mono flex items-baseline gap-2 text-sm text-foreground">
                        {row.amount}
                        <span
                          className={`text-[11px] ${row.paid ? "text-success" : "text-accent"}`}
                        >
                          {row.status}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-baseline justify-between border-t border-border-strong px-5 py-3">
                  <span className="text-sm font-medium text-foreground">Outstanding</span>
                  <span className="font-mono text-sm font-medium text-accent">R 850.00</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                One real statement, generated from what was actually recorded — not a mockup.
              </p>
            </div>
          </div>
        </section>

        {/* Who it's for — a row list, not a card grid. */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display max-w-sm text-xl font-semibold text-foreground sm:text-2xl">
                Built for early-years admin, not general ledgers
              </h2>
            </Reveal>
            <div className="mt-8 divide-y divide-border border-t border-border">
              {WHO_ITS_FOR.map((item, i) => (
                <Reveal key={item.label} delay={i * 60}>
                  <div className="grid gap-2 py-5 sm:grid-cols-[220px_1fr] sm:gap-8">
                    <span className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </span>
                    <p className="text-sm text-foreground sm:text-base">{item.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Features — a spec list, not an icon grid. */}
        <section id="features" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                  What&apos;s included
                </h2>
                <p className="text-sm text-muted-foreground">
                  One plan. Every feature. No add-ons to hunt for later.
                </p>
              </div>
            </Reveal>
            <dl className="mt-8 grid gap-x-12 gap-y-8 border-t border-border pt-8 sm:grid-cols-2">
              {FEATURES.map((feature, i) => (
                <Reveal key={feature.term} delay={(i % 2) * 60}>
                  <div>
                    <dt className="font-display text-sm font-semibold text-foreground">
                      {feature.term}
                    </dt>
                    <dd className="mt-1.5 text-sm text-muted-foreground">{feature.definition}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* Closing — inverted panel for rhythm, folds the pricing teaser
            and final CTA into one section instead of repeating a third
            centered-heading block. */}
        <section className="bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
                <div>
                  <h2 className="font-display max-w-md text-2xl font-semibold sm:text-3xl">
                    $50 a month, or $450 a year.
                  </h2>
                  <p className="mt-3 max-w-md text-sm text-background/70">
                    Paying yearly saves $150 — the equivalent of three months
                    free. Every feature either way; no tier to upgrade into
                    later.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <LinkButton href="/register" size="md" className="px-6 py-3 text-base">
                    Start your free trial
                  </LinkButton>
                  <Link
                    href="/pricing"
                    className="text-sm font-medium text-background underline decoration-background/40 underline-offset-4 hover:decoration-background"
                  >
                    Compare plans →
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
