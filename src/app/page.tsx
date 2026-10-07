import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Reveal } from "@/components/Reveal";
import { HeroDashboard } from "@/components/HeroDashboard";
import { ReminderFlow } from "@/components/ReminderFlow";
import { AttendancePreview, DocumentsPreview } from "@/components/MarketingPreviews";
import { StatementPreview } from "@/components/StatementPreview";
import { MobileCtaBar } from "@/components/MobileCtaBar";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";
import { TRIAL_DAYS } from "@/lib/trial";
import { FOUNDING_SPOTS, foundingSpotsLeft } from "@/lib/billing/founding";
import {
  MONTHLY_PRICE,
  YEARLY_PRICE,
  YEARLY_VS_MONTHLY,
  FOUNDING_PRICE,
  MONTHS_FREE_ON_YEARLY,
  PLAN_INCLUDES,
} from "@/lib/pricingDisplay";

// Visual language and section order both follow the reference concept
// Dylan supplied (2 Oct 2026): navy panels, rounded cards with soft
// shadows, a product window in the hero, a job/Crechely/old-way table,
// three pricing cards with the founding offer featured.
//
// Two departures from the reference, both deliberate:
//   - Its blue (#1686c2) is not used. White text on it misses WCAG AA;
//     --brand (#0670b8) was picked for that reason and is kept.
//   - Its section headings were notes written to Dylan about the redesign
//     ("Why this hero is different", "The feature I would make impossible
//     to miss"). Those are replaced with copy aimed at a preschool owner.
//
// Motion: only the hero panel and the reminder demo move, and both are
// demonstrating the product. Nothing decorative animates, and everything
// respects prefers-reduced-motion — see globals.css.

const TRUST_CHIPS = [
  "Built for crèches, not big schools",
  "Works on the phone you have",
  "Priced in rand",
];

const PAIN_POINTS = [
  {
    question: "Who has actually paid?",
    answer:
      "One screen shows every family's balance, per child and per class, updated the moment you record a payment. No cross-checking a book against the bank app.",
  },
  {
    question: "Did anyone remind them?",
    answer:
      "Crechely knows who is behind and who was last reminded, so nobody gets chased twice and nobody gets forgotten.",
  },
  {
    question: "Where is that form?",
    answer:
      "Birth certificates, clinic cards and parent IDs sit on the child's profile, with a running list of whatever is still missing.",
  },
];

const MONEY_POINTS = [
  {
    term: "See who owes, right now",
    definition: "Outstanding balances per child and per class, always current.",
  },
  {
    term: "Statements without typing",
    definition: "A clean PDF for any family, generated from their record in one click.",
  },
  {
    term: "Reminders that go out on their own",
    definition:
      "Email every family who is behind, each with their own statement attached — or pick the days of the month and let it run.",
  },
];

const SHOWCASE_FEATURES = [
  {
    heading: "Registers in seconds",
    description:
      "Teachers mark attendance for their own class on a phone. You see who's absent today at a glance, and can notify their parent from the same screen.",
    Preview: AttendancePreview,
  },
  {
    heading: "Documents, tracked automatically",
    description:
      "Crechely keeps a list of what's still missing for every child — a birth certificate, a clinic card, a parent's ID — and parents can upload it straight from their phone.",
    Preview: DocumentsPreview,
  },
] as const;

// Job / Crechely / the old way, as the reference lays it out. Every claim
// in the middle column is a feature that exists today.
const COMPARISON_ROWS = [
  { job: "Applications", crechely: "Parents apply online; you review and accept", old: "Paper forms, then retyping" },
  { job: "Child records", crechely: "Guardians, contacts, forms and missing details together", old: "Files spread across folders" },
  { job: "Attendance", crechely: "Teachers mark their own class on a phone", old: "A paper register per class" },
  { job: "Fees", crechely: "Cash, EFT and card payments recorded as they come in", old: "A book, or a spreadsheet" },
  { job: "Statements", crechely: "Generated as a PDF in one click", old: "Typed by hand, one by one" },
  { job: "Reminders", crechely: "Sent automatically, or in one click", old: "Remembered by whoever is free" },
  { job: "Permissions", crechely: "Set person by person", old: "Everyone sees everything, or nothing" },
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
          "Every guardian and their contact details in one place, with printable forms (like a medical & allergy form) filled in from the profile. ID numbers stay hidden until you choose to show them, and Crechely flags any child whose profile is missing core details.",
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


const HOME_FAQ = [
  {
    q: "Can I bring my current list of children across?",
    a: "Yes. Children import from an Excel or CSV file, so a spreadsheet you already keep doesn't need retyping. Past payments are entered by hand, and so is anything on paper — there's no scanning yet.",
  },
  {
    q: "Do parents pay through Crechely?",
    a: "No. Crechely records the cash, EFT or card payment your school has already received. It doesn't collect money from parents itself.",
  },
  {
    q: "Does it work on a phone?",
    a: "Yes. It runs in your phone's browser with nothing to install, and it's built to be usable on a mid-range Android phone on mobile data.",
  },
  {
    q: `What happens on day ${TRIAL_DAYS + 1}, if I haven't paid?`,
    a: "Nothing is deleted. Your account moves to read-only — you can still see and export everything, but can't add new payments or send reminders until you subscribe.",
  },
  {
    q: "Can I get my data out before I leave?",
    a: "Yes. From Settings → Backup you can download everything Crechely holds for your school as one password-protected ZIP file, any time. You're never locked in.",
  },
];

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const [testimonials, spotsLeft] = await Promise.all([
    db.testimonial.findMany({
      where: { status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 3,
    }),
    foundingSpotsLeft(),
  ]);

  return (
    // Bottom padding on phones only, so the pinned WhatsApp / trial bar
    // never covers the footer.
    <div className="flex min-h-screen flex-col bg-background pb-[calc(4.25rem+env(safe-area-inset-bottom))] sm:pb-0">
      {/* Narrow navy strip above the nav, as in the reference. */}
      <div className="bg-panel px-4 py-2 text-center text-xs text-panel-muted">
        Built for preschools, nurseries &amp; crèches · Made in South Africa
      </div>

      <MarketingHeader />

      <main className="flex-1">
        {/* Hero. The product moves here rather than sitting still: a
            reminder goes out and a family settles. */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
            <div className="grid min-w-0 gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 [&>*]:min-w-0">
              <div className="animate-in">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                  Centre management for South African preschools
                </p>
                <h1 className="font-display mt-4 max-w-xl text-[clamp(2.3rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground">
                  Know who&rsquo;s paid, who owes, and what still needs doing.
                </h1>
                <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
                  Crechely puts fees, attendance, applications and children&rsquo;s
                  records in one place, so you stop digging through books,
                  spreadsheets and messages to answer a question about your own
                  school.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <LinkButton href="/register" size="lg" className="shadow-[var(--shadow-brand)]">
                    Start my free trial
                  </LinkButton>
                  <Link
                    href="#money"
                    className="lift-on-hover inline-flex min-h-11 items-center rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold text-foreground"
                  >
                    See how it works
                  </Link>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  No card required · Full access for {TRIAL_DAYS} days · Cancel any time
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {TRUST_CHIPS.map((chip) => (
                    <li
                      key={chip}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <HeroDashboard />
                <p className="mt-3 text-xs text-muted-foreground">
                  An example of a centre&rsquo;s day in Crechely, shown with sample
                  data — not a real school&rsquo;s.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Who it's for. */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display max-w-xl text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                Built for early-years centres, not primary and high schools
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {WHO_ITS_FOR.map((item, i) => (
                <Reveal key={item.label} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      {item.label}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* The problem, in the principal's own words. */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                  The problem
                </p>
                <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                  You don&rsquo;t need more software. You need to stop hunting for
                  answers.
                </h2>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PAIN_POINTS.map((p, i) => (
                <Reveal key={p.question} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-semibold text-brand-soft-foreground">
                      {i + 1}
                    </span>
                    <h3 className="font-display mt-4 text-lg font-semibold text-foreground">
                      &ldquo;{p.question}&rdquo;
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{p.answer}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* The money moment, demonstrated. */}
        <section id="money" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 [&>*]:min-w-0">
              <Reveal>
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-brand">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                    The money moment
                  </p>
                  <h2 className="font-display mt-3 max-w-md text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                    The fee book, replaced.
                  </h2>
                  <p className="mt-3 max-w-md text-base text-muted-foreground">
                    Monthly fees are created for every child automatically.
                    Record a payment and the family&rsquo;s balance works itself
                    out — oldest amount owing first, so the number is always one
                    you can defend to a parent.
                  </p>
                  <dl className="mt-7 grid gap-4">
                    {MONEY_POINTS.map((point) => (
                      <div key={point.term} className="flex gap-3">
                        <span className="font-semibold text-success" aria-hidden="true">
                          ✓
                        </span>
                        <div>
                          <dt className="font-display text-sm font-semibold text-foreground">
                            {point.term}
                          </dt>
                          <dd className="mt-0.5 text-sm text-muted-foreground">
                            {point.definition}
                          </dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <div>
                  <ReminderFlow />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Shown with sample families — not a real school&rsquo;s data.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* What the reminder carries: the statement itself, so the
                one-click PDF promise above is something you can see. */}
            <div className="mt-16 grid min-w-0 items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 [&>*]:min-w-0">
              <Reveal>
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    A statement a parent can&rsquo;t argue with
                  </h3>
                  <p className="mt-3 max-w-md text-base text-muted-foreground">
                    One click turns a family&rsquo;s record into a PDF: every
                    charge, what was paid and when, and what&rsquo;s still
                    owing, oldest first, with your banking details at the top.
                    Send it on its own, or let it go out attached to a reminder.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <div className="max-w-lg lg:justify-self-end">
                  <StatementPreview />
                  <p className="mt-3 text-xs text-muted-foreground">
                    A Crechely statement, redrawn with the same sample family —
                    not a real school&rsquo;s data.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* The rest of the centre, with real captured screens. */}
        <section id="features" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                It runs the rest of the centre too
              </h2>
            </Reveal>
            <div className="mt-12 flex flex-col gap-16">
              {SHOWCASE_FEATURES.map((feature, i) => (
                <Reveal key={feature.heading}>
                  <div
                    className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                      i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <div>
                      <h3 className="font-display text-xl font-semibold text-foreground">
                        {feature.heading}
                      </h3>
                      <p className="mt-3 max-w-md text-base text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                    <div className="max-w-lg lg:justify-self-end">
                      <feature.Preview />
                      <p className="mt-3 text-xs text-muted-foreground">
                        Real Crechely dashboard, shown with a demo school&rsquo;s data — not a real school&rsquo;s.
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Crechely vs the old way. */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                Crechely vs the old way
              </h2>
            </Reveal>
            <Reveal>
              <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-background">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:px-5">
                        Job
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:px-5">
                        Crechely
                      </th>
                      <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:table-cell sm:px-5">
                        The old way
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.job} className="border-t border-border">
                        <td className="px-4 py-3.5 text-sm text-muted-foreground sm:px-5">
                          {row.job}
                        </td>
                        <td className="px-4 py-3.5 text-sm font-medium text-foreground sm:px-5">
                          {row.crechely}
                          <span className="mt-0.5 block text-xs text-muted line-through sm:hidden">
                            {row.old}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-muted line-through sm:table-cell sm:px-5">
                          {row.old}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Full feature list. */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                  Everything your centre runs on
                </h2>
                <p className="text-sm text-muted-foreground">
                  One plan. Everything below, from day one. No add-ons to unlock later.
                </p>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {FEATURE_GROUPS.map((group, gi) => (
                <Reveal key={group.heading} delay={gi * 60}>
                  <div className="h-full rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
                    <h3 className="font-display text-base font-semibold text-brand">
                      {group.heading}
                    </h3>
                    <dl className="mt-4 grid gap-4">
                      {group.items.map((feature) => (
                        <div key={feature.term}>
                          <dt className="font-display text-sm font-semibold text-foreground">
                            {feature.term}
                          </dt>
                          <dd className="mt-1 text-sm text-muted-foreground">
                            {feature.definition}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-xs text-muted-foreground">
              To be clear: Crechely <strong className="text-foreground">records</strong>{" "}
              cash, EFT and card payments your school has already received. It
              doesn&rsquo;t collect money from parents itself. The reminders it
              sends go out by email only — it can write a WhatsApp reminder and
              open it in your own WhatsApp, but it never sends WhatsApp messages
              on your behalf.
            </p>
          </div>
        </section>

        {/* Founder proof. Nothing invented: no fake testimonials, customer
            counts, logos or awards. */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8">
              <Reveal>
                <div className="h-full rounded-3xl bg-panel p-7 text-panel-foreground shadow-[var(--shadow-lift)]">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-panel-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-panel-muted" aria-hidden="true" />
                    Built from inside the industry
                  </p>
                  <p className="font-display mt-5 text-2xl font-semibold">Dylan Maps</p>
                  <p className="mt-1 text-sm text-panel-muted">
                    Founder, Crechely · Bela-Bela, South Africa
                  </p>
                  <p className="mt-5 text-sm text-panel-muted">
                    What made the job hardest wasn&rsquo;t the kids — it was arguing
                    with parents over fees because there was no proper system
                    tracking who owed what.
                  </p>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="mt-6 inline-block text-sm font-medium text-panel-foreground underline underline-offset-4"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <div className="h-full rounded-3xl border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
                  <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
                    Who&rsquo;s behind Crechely
                  </h2>
                  <p className="mt-4 text-base text-muted-foreground">
                    I grew up in Bela-Bela, where my parents started a crèche back in 2015.
                    I&rsquo;ve been working in this industry ever since — 6 years part-time, then 4
                    years full-time after school, so I&rsquo;ve seen the day-to-day of running one up
                    close, not from the outside. I built Crechely because most software gets built
                    for primary and high schools, or by developers who&rsquo;ve never actually worked
                    in this industry. That kind of dispute over fees can cost you a friendship, not
                    just a payment. Crechely is my attempt to fix that.
                  </p>
                </div>
              </Reveal>
            </div>

            {testimonials.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    What schools say
                  </h3>
                  <Link
                    href="/testimonials/new"
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Give a testimonial
                  </Link>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
                    >
                      <p className="text-sm text-foreground">&ldquo;{t.quote}&rdquo;</p>
                      <p className="mt-4 text-xs font-medium text-muted-foreground">
                        {t.authorName}
                        {t.schoolName ? ` · ${t.schoolName}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Pricing — calm on purpose. Nothing here animates. */}
        <section id="pricing" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                  Pricing
                </p>
                <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                  One plan. Everything included.
                </h2>
                <p className="mt-3 text-base text-muted-foreground">
                  One paying family a month covers your whole school.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {/* Founding offer first and featured: it is the one worth
                  noticing, and its places-left figure is counted from real
                  subscriptions — see foundingSpotsLeft(). */}
              <div className="relative flex h-full flex-col rounded-2xl border-2 border-brand bg-background p-6 shadow-[var(--shadow-brand)]">
                <span className="absolute -top-3 right-5 rounded-full bg-brand px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
                  First {FOUNDING_SPOTS} schools
                </span>
                <h3 className="font-display text-base font-semibold text-foreground">
                  Founding price
                </h3>
                <p className="font-display mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">
                  {FOUNDING_PRICE}
                  <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
                    / month
                  </span>
                </p>
                <p className="mt-2 min-h-10 text-sm text-muted-foreground">
                  Locked in for as long as your school stays subscribed.
                  {spotsLeft > 0
                    ? ` ${spotsLeft} of ${FOUNDING_SPOTS} places still open.`
                    : " All places have been taken."}
                </p>
                <PlanIncludes />
                <div className="mt-auto pt-6">
                  <LinkButton href="/register" className="w-full justify-center">
                    Start my free trial
                  </LinkButton>
                </div>
              </div>

              <PlanCard
                name="Monthly"
                price={MONTHLY_PRICE}
                per="/ month"
                blurb="Pay monthly. Cancel any time. No contract."
              />
              <PlanCard
                name="Yearly"
                price={YEARLY_PRICE}
                per="/ year"
                blurb={`Saves ${YEARLY_VS_MONTHLY} against paying monthly — exactly ${MONTHS_FREE_ON_YEARLY} months free, with a 30-day money-back guarantee.`}
              />
            </div>

            <p className="mt-6 rounded-xl border border-brand-soft bg-brand-soft px-4 py-3 text-sm text-brand-soft-foreground">
              No card is needed for the {TRIAL_DAYS}-day trial. The point of the
              trial is to run Crechely with your own families before you pay for
              anything.
            </p>
          </div>
        </section>

        {/* Objections. */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                Before you sign up
              </h2>
            </Reveal>
            <div className="mt-8 grid max-w-3xl gap-3">
              {HOME_FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-border bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-sm font-semibold text-foreground">
                    {item.q}
                    <svg
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 4.5L6 8l3.5-3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Something else on your mind?{" "}
              {WHATSAPP_NUMBER ? (
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                  WhatsApp us
                </a>
              ) : (
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("A question about Crechely")}`} className="font-medium text-brand hover:underline">
                  Email us
                </a>
              )}{" "}
              and we&rsquo;ll show you around.
            </p>
          </div>
        </section>

        {/* The final ask. */}
        <section className="bg-panel text-panel-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-panel-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-panel-muted" aria-hidden="true" />
                    The next step
                  </p>
                  <h2 className="font-display mt-3 max-w-xl text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                    Stop wondering who owes. See it for yourself.
                  </h2>
                  <p className="mt-3 max-w-md text-sm text-panel-muted">
                    Set up your classes, bring your children across from the
                    spreadsheet you already keep, and watch the first month&rsquo;s
                    fees create themselves. {TRIAL_DAYS} days, every feature, no card.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <Link
                    href="/register"
                    className="lift-on-hover inline-flex min-h-12 items-center rounded-xl bg-panel-foreground px-6 text-sm font-semibold text-panel"
                  >
                    Start my free trial
                  </Link>
                  {WHATSAPP_NUMBER && (
                    <a
                      href={WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-panel-muted underline underline-offset-4"
                    >
                      Prefer to talk first? WhatsApp us
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <MobileCtaBar />
    </div>
  );
}

function PlanIncludes() {
  return (
    <ul className="mt-5 grid gap-2 border-t border-border pt-5 text-sm text-muted-foreground">
      {PLAN_INCLUDES.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="font-semibold text-success" aria-hidden="true">
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  name,
  price,
  per,
  blurb,
}: {
  name: string;
  price: string;
  per: string;
  blurb: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
      <h3 className="font-display text-base font-semibold text-foreground">{name}</h3>
      <p className="font-display mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">
        {price}
        <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
          {per}
        </span>
      </p>
      <p className="mt-2 min-h-10 text-sm text-muted-foreground">{blurb}</p>
      <PlanIncludes />
      <div className="mt-auto pt-6">
        <LinkButton href="/register" variant="secondary" className="w-full justify-center">
          Start my free trial
        </LinkButton>
      </div>
    </div>
  );
}
