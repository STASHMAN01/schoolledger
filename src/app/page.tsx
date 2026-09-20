import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Reveal } from "@/components/Reveal";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";
import { TRIAL_DAYS } from "@/lib/trial";

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
      "Stop being the only person who understands the fee book. Anyone on your team can see who's up to date in seconds.",
  },
  {
    label: "Crèches & daycares",
    description:
      "Built for how you actually get paid — cash, EFT, and card, often on different days for different families — not how a big accounting company assumes you do.",
  },
  {
    label: "Small private schools",
    description:
      "Registration, uniforms, trips, aftercare — every payment type in one place, with a statement you're proud to hand a parent or an accountant.",
  },
];

const FEATURES = [
  {
    term: "Never lose track of who owes what",
    definition:
      "Every child, every fee, one record. Open the app and know instantly who's paid and who hasn't — no notebook, no memory required.",
  },
  {
    term: "Stop calculating fees by hand every month",
    definition:
      "School fees bill themselves, automatically, every period. You add a uniform or a trip charge once — it's never manual math again.",
  },
  {
    term: "Get paid faster, without chasing anyone",
    definition:
      "Payments are applied oldest-owing-first the moment they come in, and overdue families get an automatic reminder — so you're not the one sending awkward messages.",
  },
  {
    term: "Look professional in front of every parent",
    definition:
      "One click sends a clean, proper statement — the kind a parent (or your accountant) can trust, not a handwritten note torn from a book.",
  },
  {
    term: "Collect for trips and events without a spreadsheet",
    definition:
      "Create the trip once and every enrolled family is billed automatically — no manually working out who owes for the school outing.",
  },
  {
    term: "Let your bookkeeper in, without handing over everything",
    definition:
      "Invite your bookkeeper, your accountant, or a teacher with a role that shows them exactly what they need — money for the bookkeeper, enrolments for the classroom, nothing more.",
  },
];

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  // Only ever approved, real, user-submitted testimonials — see
  // /api/testimonials (public submission) and /platform/testimonials
  // (Dylan's approval queue). Never invented or auto-published; if this
  // is empty, the section below simply shows the "be the first" prompt
  // instead of a testimonial grid.
  const testimonials = await db.testimonial.findMany({
    where: { status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    take: 3,
  });

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
                For preschool, nursery &amp; crèche owners
              </p>
              <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl">
                Know exactly who&rsquo;s paid and who owes you — without opening a notebook.
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground">
                Crechely does the fee tracking and chasing you&rsquo;re doing by
                hand right now — automatically. Set it up once, and every
                month it bills the right families, tracks every cash, EFT,
                and card payment, and reminds the ones who haven&rsquo;t paid,
                so you don&rsquo;t have to.
              </p>
              <div className="mt-8">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <LinkButton href="/register" size="lg">
                    Start free trial
                  </LinkButton>
                  <Link
                    href="/pricing"
                    className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                  >
                    See pricing →
                  </Link>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <span className="text-success">✓</span> No card required — full access for {TRIAL_DAYS} days, free.
                </p>
                {/* H2: low-commitment secondary CTA beside the primary one. */}
                <p className="mt-2 text-sm text-muted-foreground">
                  Not ready to sign up?{" "}
                  {WHATSAPP_NUMBER ? (
                    <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                      WhatsApp us
                    </a>
                  ) : (
                    <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Send me a sample statement")}`} className="font-medium text-brand hover:underline">
                      Email us for a sample statement
                    </a>
                  )}
                  .
                </p>
              </div>
            </div>

            {/* The statement panel — an illustrative example (fictional
                names/amounts), styled exactly like the app's real output.
                C5: previously captioned as "not a mockup," which wasn't
                true — Naledi M./Thabo K./Amahle N. are made-up example
                names, not a real customer's data. Real product screenshots
                are still pending (see OPEN_QUESTIONS.md — dashboard access
                needed to capture them honestly). */}
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
                          className={`text-[11px] ${row.paid ? "text-success" : "text-accent-soft-foreground"}`}
                        >
                          {row.status}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-baseline justify-between border-t border-border-strong px-5 py-3">
                  <span className="text-sm font-medium text-foreground">Outstanding</span>
                  <span className="font-mono text-sm font-medium text-accent-soft-foreground">R 850.00</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                An example of the statement layout — shown with sample data, not a real school&rsquo;s.
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
                  What this actually gets you
                </h2>
                <p className="text-sm text-muted-foreground">
                  One plan. Everything below, from day one. No add-ons to unlock later.
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
            {/* H8: product truth, stated plainly where the feature claims
                are made, not just buried on /pricing. */}
            <p className="mt-8 max-w-2xl border-t border-border pt-6 text-xs text-muted-foreground">
              To be clear: Crechely <strong className="text-foreground">records</strong>{" "}
              cash, EFT, and card payments your school already received — it
              doesn&rsquo;t collect money from parents itself. Reminders go out by
              email only.
            </p>
            {/* H2: second low-commitment CTA, after the benefits section. */}
            <p className="mt-4 text-sm text-muted-foreground">
              Want to see it before you sign up?{" "}
              {WHATSAPP_NUMBER ? (
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                  WhatsApp us
                </a>
              ) : (
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Send me a sample statement")}`} className="font-medium text-brand hover:underline">
                  Email us
                </a>
              )}{" "}
              and we&rsquo;ll send a sample statement.
            </p>
          </div>
        </section>

        {/* Trust/proof — added per C4 in CRECHELY_AUDIT.md, founder story
            and testimonial submission/moderation flow added 2026-09-19.
            Nothing here is invented — no fake testimonials, customer
            counts, logos, or awards. Testimonials only ever come from the
            public submission form (/testimonials/new) and only appear here
            once Dylan approves them at /platform/testimonials. No founder
            photo by request — name/story only, everything below is real. */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                Who&rsquo;s behind Crechely
              </h2>
            </Reveal>
            <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-16">
              <div className="text-center lg:text-left">
                <p className="font-medium text-foreground">Dylan Maps</p>
                <p className="text-sm text-muted-foreground">Founder, Crechely</p>
              </div>
              <div>
                <p className="text-sm text-foreground sm:text-base">
                  I grew up in Bela-Bela, where my parents started a crèche back in 2015.
                  I&rsquo;ve been working in this industry ever since — 6 years part-time, then 4
                  years full-time after school, so I&rsquo;ve seen the day-to-day of running one up
                  close, not from the outside. I built Crechely because most software gets built
                  for primary and high schools, or by developers who&rsquo;ve never actually worked
                  in this industry. What made the job hardest wasn&rsquo;t the kids — it was
                  arguing with parents over fees because there was no proper system tracking who
                  owed what. That kind of dispute can cost you a friendship, not just a payment.
                  Crechely is my attempt to fix that.
                </p>
                <div className="mt-6 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Contact
                    </p>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 block text-brand hover:underline">
                      {SUPPORT_EMAIL}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Based in
                    </p>
                    {/* Confirm with Dylan whether this should be the town he
                        grew up in or wherever he actually operates from today
                        — using Bela-Bela for now since that's what he told us. */}
                    <p className="mt-1">Bela-Bela, South Africa</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Real, approved testimonials only (see /api/testimonials and
                /platform/testimonials) — never invented. Falls back to an
                honest "be the first" prompt when there are none yet, rather
                than empty dashed boxes or fake quotes. */}
            <div className="mt-12 border-t border-border pt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-foreground">What schools say</h3>
                <Link
                  href="/testimonials/new"
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Give a testimonial →
                </Link>
              </div>
              {testimonials.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
                  No testimonials yet — if you use Crechely, be the first to{" "}
                  <Link href="/testimonials/new" className="text-brand hover:underline">
                    share yours
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col justify-between rounded-lg border border-border bg-background p-4"
                    >
                      <p className="text-sm text-foreground">&ldquo;{t.quote}&rdquo;</p>
                      <p className="mt-3 text-xs font-medium text-muted-foreground">
                        {t.authorName}
                        {t.schoolName ? ` · ${t.schoolName}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                    R499 a month, or R4,990 a year.
                  </h2>
                  <p className="mt-3 max-w-md text-sm text-background/70">
                    One paying family a month covers it. Paying yearly saves
                    R998 — exactly 2 months free. Every feature either way;
                    nothing to upgrade into later, ever.
                  </p>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <LinkButton href="/register" size="lg">
                      Start free trial
                    </LinkButton>
                    <Link
                      href="/pricing"
                      className="text-sm font-medium text-background underline decoration-background/40 underline-offset-4 hover:decoration-background"
                    >
                      See pricing →
                    </Link>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-background">
                    <span className="text-success">✓</span> No card required — full access for {TRIAL_DAYS} days, free.
                  </p>
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
