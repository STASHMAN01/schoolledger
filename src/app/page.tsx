import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge, Card, LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

const WHO_ITS_FOR = [
  {
    title: "Preschools & nurseries",
    description:
      "Track enrollments, recurring school fees, and which families are up to date — without a spreadsheet that only one person understands.",
  },
  {
    title: "Crèches & daycares",
    description:
      "Built for the way small early-years operators actually get paid: cash, EFT, and card, often on different days for different families.",
  },
  {
    title: "Small private schools",
    description:
      "Registration fees, uniforms, trips, aftercare — one place for every payment type, with statements you can hand a parent or a bookkeeper.",
  },
];

const FEATURES = [
  {
    title: "Children & enrollments",
    description:
      "Every child's category, parent contact details, enrollment date, and fee overrides in one record.",
  },
  {
    title: "Recurring & one-off fees",
    description:
      "School fees bill automatically every period. Uniforms, trips, and registration are one-time charges you record as they happen.",
  },
  {
    title: "Payment tracking",
    description:
      "Record cash, EFT, and card payments against the right child and fee — oldest-outstanding-first, so nothing quietly slips through.",
  },
  {
    title: "Parent statements",
    description:
      "Generate a clean statement of what's been paid and what's owed, ready to send or print.",
  },
  {
    title: "Multi-currency",
    description:
      "Built for schools outside the US too — set your school's currency once and every amount displays correctly.",
  },
  {
    title: "Team access with roles",
    description:
      "Invite an admin, accountant, manager, or viewer — each sees exactly what their role needs, nothing more.",
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
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="animate-in mx-auto max-w-2xl text-center">
            <Badge variant="brand" className="mb-4">
              14-day free trial · no card required
            </Badge>
            <h1 className="font-display text-3xl font-semibold text-foreground sm:text-5xl">
              Preschool accounting, without the spreadsheets.
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              TinyLedger tracks enrollments, fees, and payments for preschools,
              nurseries, and crèches — so you always know who&apos;s paid, who
              hasn&apos;t, and what&apos;s coming in.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/register" size="md" className="px-6 py-3 text-base">
                Start your free trial
              </LinkButton>
              <LinkButton
                href="/pricing"
                variant="secondary"
                size="md"
                className="px-6 py-3 text-base"
              >
                See pricing
              </LinkButton>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Built for early-years admin, not general ledgers
              </h2>
              <p className="mt-3 text-muted-foreground">
                If your school&apos;s finances currently live across a
                notebook, a spreadsheet, and someone&apos;s memory, TinyLedger
                replaces all three.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {WHO_ITS_FOR.map((item) => (
                <Card key={item.title} className="p-6">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mt-3 text-muted-foreground">
              One plan. Every feature included — no add-ons to hunt for later.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-6">
                <h3 className="font-display text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              One flat price, every feature included
            </h2>
            <p className="mt-3 text-muted-foreground">
              $50/month, or save 25% by paying yearly.
            </p>
            <div className="mt-6">
              <LinkButton href="/pricing" size="md" className="px-6 py-3 text-base">
                View pricing
              </LinkButton>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Ready to stop chasing spreadsheets?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Set up your school in a few minutes. No card required for the first
            14 days.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/register" size="md" className="px-6 py-3 text-base">
              Start your free trial
            </LinkButton>
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Already have an account? Log in
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
