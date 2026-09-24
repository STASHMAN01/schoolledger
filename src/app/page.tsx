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

// Sample snapshot of a centre's day, standing in for a dashboard
// screenshot without pretending to be one. Fictional names and numbers,
// and captioned as such below.
const TODAY_ROWS = [
  { label: "Present today", value: "42 of 46", tone: "ok" },
  { label: "Absent", value: "4", tone: "muted" },
  { label: "New applications to review", value: "2", tone: "warn" },
  { label: "Profiles missing details", value: "3", tone: "warn" },
  { label: "Fees outstanding", value: "R3,400", tone: "warn" },
] as const;

const TODAY_TODOS = [
  "Review Naledi M.'s application",
  "Add Thabo K.'s allergy details",
  "Send September statements",
];

const WHO_ITS_FOR = [
  {
    label: "Preschools & nurseries",
    description:
      "Stop being the only person who knows where everything is. Your team can see who's enrolled, who's here today and who's paid, without asking you.",
  },
  {
    label: "Crèches & daycares",
    description:
      "Built for how a crèche actually runs: parents who pay cash, EFT or card on different days, and teachers who need the register, not the books.",
  },
  {
    label: "Small private schools",
    description:
      "Applications, class lists, registers, trips and statements in one place, with records you're comfortable showing a parent, an inspector or your accountant.",
  },
];

// Grouped by the part of the day they help with, so a principal can see
// the whole centre is covered, not just the fee book. Every line below
// describes a feature that exists in the app today; don't add a claim
// here until the feature ships.
const FEATURE_GROUPS = [
  {
    heading: "Admissions & enrolment",
    items: [
      {
        term: "Take applications online",
        definition:
          "Share one link. Parents fill in the application on their phone, and you review it and accept the child in a few clicks, with no forms to retype.",
      },
      {
        term: "A complete profile for every child",
        definition:
          "Guardians, contact details and medical information in one place. ID numbers stay hidden until you choose to show them, and Crechely flags any child whose profile is missing core details.",
      },
      {
        term: "Bring your current list across",
        definition:
          "Import your children from an Excel or CSV file instead of typing them in one by one.",
      },
    ],
  },
  {
    heading: "The school day",
    items: [
      {
        term: "Registers in seconds",
        definition:
          "Teachers take attendance for their class on a phone, and you see who's absent today at a glance.",
      },
      {
        term: "Classes, timetables and a to-do list",
        definition:
          "Each class with its teacher and age group, a weekly timetable, and a to-do list for everything that still needs doing.",
      },
      {
        term: "Forms and parent groups",
        definition:
          "Online forms for parents and blank forms to print. There's also a checklist of which parents you've added to each class's WhatsApp group. Crechely doesn't connect to WhatsApp; it just keeps track for you.",
      },
    ],
  },
  {
    heading: "Fees & payments",
    items: [
      {
        term: "Fees that bill themselves",
        definition:
          "Monthly fees are created automatically for every child. Add a uniform, trip or event charge once and the right families are billed.",
      },
      {
        term: "Know who's paid and who owes",
        definition:
          "Record cash, EFT and card payments as they come in. Crechely puts each payment against the oldest amount owing first, so every family's balance is always right.",
      },
      {
        term: "Statements and reminders",
        definition:
          "Send a clean PDF statement a parent (or your accountant) can trust, and email reminders to families who are behind.",
      },
    ],
  },
  {
    heading: "Your team & your records",
    items: [
      {
        term: "Everyone sees only what they need",
        definition:
          "A teacher sees only their own class. Your bookkeeper sees the money. Your receptionist can add children. You decide, person by person.",
      },
      {
        term: "Your records are yours",
        definition:
          "Download everything Crechely holds for your school as one password-protected ZIP file, any time you like.",
      },
      {
        term: "Works on the phone you already have",
        definition:
          "It runs in your phone's browser, with nothing to install from an app store. It's built to work on a mid-range Android phone on mobile data.",
      },
    ],
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
            screenshot; the "today" panel is the shape of the Centre dashboard,
            typeset rather than photographed. */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-16">
            <div className="animate-in">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand">
                For preschool, nursery &amp; crèche owners
              </p>
              <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl">
                Run your whole centre from one place, not five notebooks.
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground">
                Applications, enrolment, attendance, classes and fees, all
                in one app. You and your staff always know who&rsquo;s enrolled,
                who&rsquo;s here today and who&rsquo;s paid, without digging
                through files or asking around.
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
                    <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("I'd like to see Crechely")}`} className="font-medium text-brand hover:underline">
                      Email us for a walkthrough
                    </a>
                  )}
                  .
                </p>
              </div>
            </div>

            {/* A sample "today" snapshot: the shape of the Centre
                dashboard, typeset rather than photographed. Fictional
                names and numbers, captioned as sample data below. Real
                product screenshots are still pending. */}
            <div className="lg:pt-1">
              <div className="border border-border-strong bg-surface">
                <div className="flex items-baseline justify-between border-b border-border-strong px-5 py-3">
                  <span className="font-display text-sm font-semibold text-foreground">
                    Little Acorns Preschool
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">Today</span>
                </div>
                <dl className="divide-y divide-border">
                  {TODAY_ROWS.map((row) => (
                    <div key={row.label} className="flex items-baseline gap-3 px-5 py-3">
                      <dt className="text-sm text-foreground">{row.label}</dt>
                      <div
                        className="flex-1 border-b border-dotted border-border-strong"
                        aria-hidden="true"
                      />
                      <dd
                        className={`font-mono text-sm ${
                          row.tone === "ok"
                            ? "text-success"
                            : row.tone === "warn"
                              ? "text-accent-soft-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-border-strong px-5 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    To do
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {TODAY_TODOS.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm text-foreground">
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-border-strong"
                          aria-hidden="true"
                        />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                An example of a centre&rsquo;s day in Crechely, shown with sample data, not a real school&rsquo;s.
              </p>
            </div>
          </div>
        </section>

        {/* Who it's for — a row list, not a card grid. */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display max-w-sm text-xl font-semibold text-foreground sm:text-2xl">
                Built for early-years centres, not primary and high schools
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
                  Everything your centre runs on
                </h2>
                <p className="text-sm text-muted-foreground">
                  One plan. Everything below, from day one. No add-ons to unlock later.
                </p>
              </div>
            </Reveal>
            <div className="mt-8 flex flex-col gap-12 border-t border-border pt-8">
              {FEATURE_GROUPS.map((group) => (
                <div key={group.heading}>
                  <Reveal>
                    <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-brand">
                      {group.heading}
                    </h3>
                  </Reveal>
                  <dl className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-3">
                    {group.items.map((feature, i) => (
                      <Reveal key={feature.term} delay={i * 60}>
                        <div>
                          <dt className="font-display text-sm font-semibold text-foreground">
                            {feature.term}
                          </dt>
                          <dd className="mt-1.5 text-sm text-muted-foreground">
                            {feature.definition}
                          </dd>
                        </div>
                      </Reveal>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            {/* H8: product truth, stated plainly where the feature claims
                are made, not just buried on /pricing. */}
            <p className="mt-8 max-w-2xl border-t border-border pt-6 text-xs text-muted-foreground">
              To be clear: Crechely <strong className="text-foreground">records</strong>{" "}
              cash, EFT and card payments your school has already received. It
              doesn&rsquo;t collect money from parents itself. Reminders go out by
              email only, and Crechely doesn&rsquo;t send WhatsApp messages.
            </p>
            {/* H2: second low-commitment CTA, after the benefits section. */}
            <p className="mt-4 text-sm text-muted-foreground">
              Want to see it before you sign up?{" "}
              {WHATSAPP_NUMBER ? (
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                  WhatsApp us
                </a>
              ) : (
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("I'd like to see Crechely")}`} className="font-medium text-brand hover:underline">
                  Email us
                </a>
              )}{" "}
              and we&rsquo;ll show you around.
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
                    R998, exactly 2 months free. Every feature, Centre
                    Management and fees, either way. Nothing to upgrade into later.
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
