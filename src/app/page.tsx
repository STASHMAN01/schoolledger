import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Reveal } from "@/components/Reveal";
import { AttendancePreview, DocumentsPreview, FeesPreview, RemindersPreview } from "@/components/MarketingPreviews";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";
import { TRIAL_DAYS } from "@/lib/trial";
import { FOUNDING_SPOTS, foundingSpotsLeft } from "@/lib/billing/founding";
import {
  MONTHLY_PRICE,
  YEARLY_PRICE,
  YEARLY_VS_MONTHLY,
  FOUNDING_PRICE,
  MONTHS_FREE_ON_YEARLY,
} from "@/lib/pricingDisplay";

// Page order follows the conversion-first structure Dylan asked for
// (2 Oct 2026, from a reference concept): hero with the product visible
// immediately, then who it's for, the problem in the owner's own words,
// the money moment, the rest of the product, the old way, the full
// feature list, founder proof, pricing, objections, one final ask.
//
// Two things in that reference were deliberately not carried over. Its
// hero and fee tables were hand-drawn mockups with invented families and
// balances; the real screenshots below say the same thing and are true.
// And its section headings were notes written to Dylan about the redesign
// ("Why this hero is different", "The feature I would make impossible to
// miss") rather than copy for a preschool owner to read.

// The three questions a principal actually asks, in their words. Lifted
// from the problem Dylan describes in the founder section below — arguing
// over fees with no system behind you — not invented personas.
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

// The money moment: what the fee side actually does. Every line matches a
// feature that exists today — see FEATURE_GROUPS below.
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

// The remaining product story, after the fee problem is established.
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

// "Crechely vs the old way" — stated only in terms of what Crechely
// actually does (see FEATURE_GROUPS and the product-truth note below).
const COMPARISON_ROWS = [
  { label: "Who's paid and who owes", paper: "Dig through a book or spreadsheet", crechely: "One screen, always up to date" },
  { label: "Monthly statements", paper: "Typed by hand, one by one", crechely: "Generated as a PDF in one click" },
  { label: "Late-fee reminders", paper: "Remembered (or forgotten) by whoever's free", crechely: "Sent automatically, or in one click" },
  { label: "Daily register", paper: "A paper sheet per class", crechely: "Taken on a phone, visible instantly" },
  { label: "Who can see what", paper: "Everyone sees everything, or nothing", crechely: "Set per person — teachers, admin, bookkeeper" },
  { label: "Your records if you leave", paper: "Whatever's in the book or the file", crechely: "One password-protected backup, any time" },
] as const;

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

// The questions that stop a sign-up, answered on the page rather than
// only behind a link. Kept to the shortlist; /pricing carries the rest.
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

  // Only ever approved, real, user-submitted testimonials — see
  // /api/testimonials (public submission) and /platform/testimonials
  // (Dylan's approval queue). Never invented or auto-published.
  const [testimonials, spotsLeft] = await Promise.all([
    db.testimonial.findMany({
      where: { status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 3,
    }),
    // A real count of founding places still open, not a made-up
    // scarcity number — see src/lib/billing/founding.ts.
    foundingSpotsLeft(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero. The product is the proof, so a real screen of the money
            screen sits beside the headline rather than below the fold. */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20">
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12">
            <div className="animate-in">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand">
                Centre management for South African preschools
              </p>
              <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.06] text-foreground sm:text-5xl">
                Know who&rsquo;s paid, who owes, and what still needs doing.
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground">
                Crechely puts fees, attendance, applications and children&rsquo;s
                records in one place, so you stop digging through books,
                spreadsheets and messages to answer a question about your own
                school.
              </p>
              <div className="mt-8">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <LinkButton href="/register" size="lg">
                    Start my free trial
                  </LinkButton>
                  <Link
                    href="#money"
                    className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                  >
                    See how it works
                  </Link>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <span className="text-success">✓</span> No card required — full access for {TRIAL_DAYS} days, free.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rather talk first?{" "}
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

            <div className="lg:pt-1">
              <FeesPreview priority sizes="(min-width: 1024px) 620px, 92vw" />
              <p className="mt-3 text-xs text-muted-foreground">
                The real Crechely accounting screen, shown with a demo
                school&rsquo;s data — not a real school&rsquo;s.
              </p>
            </div>
          </div>
        </section>

        {/* Who it's for — answers "is this for me?" before anything else. */}
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

        {/* The problem, in the principal's own words. */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display max-w-lg text-xl font-semibold text-foreground sm:text-2xl">
                You don&rsquo;t need more software. You need to stop hunting for
                answers.
              </h2>
            </Reveal>
            <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {PAIN_POINTS.map((p, i) => (
                <Reveal key={p.question} delay={i * 60}>
                  <div className="border-t-2 border-foreground pt-4">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      &ldquo;{p.question}&rdquo;
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{p.answer}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* The money moment — the one the whole product is built around,
            given its own section rather than a row in a feature list. */}
        <section id="money" className="scroll-mt-16 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal>
                <div>
                  <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand">
                    Fees &amp; statements
                  </p>
                  <h2 className="font-display mt-3 max-w-md text-2xl font-semibold text-foreground sm:text-3xl">
                    The fee book, replaced.
                  </h2>
                  <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
                    Monthly fees are created for every child automatically.
                    Record a payment and the family&rsquo;s balance works itself
                    out — oldest amount owing first, so the number is always
                    one you can defend to a parent.
                  </p>
                  <dl className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
                    {MONEY_POINTS.map((point) => (
                      <div key={point.term} className="flex gap-3">
                        <span className="mt-0.5 text-success" aria-hidden="true">
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
                <div className="max-w-lg lg:justify-self-end">
                  <RemindersPreview />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Real Crechely dashboard, shown with a demo school&rsquo;s data — not a real school&rsquo;s.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* The rest of the centre, once the money problem has landed. */}
        <section id="features" className="scroll-mt-16 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                It runs the rest of the centre too
              </h2>
            </Reveal>
            <div className="mt-10 flex flex-col gap-16">
              {SHOWCASE_FEATURES.map((feature, i) => (
                <Reveal key={feature.heading}>
                  <div
                    className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-16 ${
                      i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <div>
                      <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
                        {feature.heading}
                      </h3>
                      <p className="mt-2.5 max-w-md text-sm text-muted-foreground sm:text-base">
                        {feature.description}
                      </p>
                    </div>
                    <div className="max-w-lg lg:justify-self-end">
                      <feature.Preview />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Real Crechely dashboard, shown with a demo school&rsquo;s data — not a real school&rsquo;s.
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison — built as a ledger entry list rather than a data
            table: the old way struck through, Crechely's answer in brand
            ink after it. The product's whole pitch is replacing a paper
            ledger, so the comparison reads like one being corrected. */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                Crechely vs the old way
              </h2>
            </Reveal>
            <div className="mt-8 border-t border-border-strong">
              {COMPARISON_ROWS.map((row, i) => (
                <Reveal key={row.label} delay={i * 40}>
                  <div className="grid items-baseline gap-x-6 gap-y-1.5 border-b border-border-strong py-4 sm:grid-cols-[180px_1fr_14px_1fr]">
                    <span className="text-sm text-muted-foreground sm:text-[13px]">{row.label}</span>
                    <span className="text-sm text-muted decoration-border-strong line-through decoration-2">
                      {row.paper}
                    </span>
                    <span className="hidden text-border-strong sm:block" aria-hidden="true">
                      →
                    </span>
                    <span className="text-sm font-medium text-foreground">{row.crechely}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Full feature list — a spec list, not an icon grid. */}
        <section className="border-t border-border bg-surface">
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
            {/* Product truth, stated plainly where the feature claims are
                made, not buried on /pricing. */}
            <p className="mt-8 max-w-2xl border-t border-border pt-6 text-xs text-muted-foreground">
              To be clear: Crechely <strong className="text-foreground">records</strong>{" "}
              cash, EFT and card payments your school has already received. It
              doesn&rsquo;t collect money from parents itself. The reminders it
              sends go out by email only — it can write a WhatsApp reminder and
              open it in your own WhatsApp, but it never sends WhatsApp messages
              on your behalf.
            </p>
          </div>
        </section>

        {/* Founder proof. Nothing here is invented — no fake testimonials,
            customer counts, logos or awards. Testimonials only ever come
            from the public submission form and only appear once Dylan
            approves them. No founder photo by request. */}
        <section className="border-t border-border">
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
                    <p className="mt-1">Bela-Bela, South Africa</p>
                  </div>
                </div>
              </div>
            </div>

            {testimonials.length > 0 && (
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
              </div>
            )}
          </div>
        </section>

        {/* Pricing on the page itself, so nobody has to go hunting for it.
            One plan billed two ways plus the founding offer — not three
            invented tiers, because there is only one product. */}
        <section id="pricing" className="scroll-mt-16 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                  One plan. Everything included.
                </h2>
                <p className="text-sm text-muted-foreground">
                  One paying family a month covers your whole school.
                </p>
              </div>
            </Reveal>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Reveal>
                <div className="flex h-full flex-col border border-border-strong bg-background p-6">
                  <p className="text-sm font-medium text-foreground">Monthly</p>
                  <p className="font-display mt-2 text-3xl font-semibold text-foreground">
                    {MONTHLY_PRICE}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/ month</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pay monthly, cancel any time, no contract.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={60}>
                <div className="flex h-full flex-col border border-border-strong bg-background p-6">
                  <p className="text-sm font-medium text-foreground">Yearly</p>
                  <p className="font-display mt-2 text-3xl font-semibold text-foreground">
                    {YEARLY_PRICE}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/ year</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Saves {YEARLY_VS_MONTHLY} against paying monthly — exactly{" "}
                    {MONTHS_FREE_ON_YEARLY} months free. 30-day money-back guarantee.
                  </p>
                </div>
              </Reveal>

              {/* The founding offer is the one worth noticing, so it is the
                  only card that carries the brand colour. The places-left
                  figure is counted from real subscriptions, never typed in
                  by hand — see foundingSpotsLeft(). */}
              <Reveal delay={120}>
                <div className="flex h-full flex-col border-2 border-brand bg-brand-soft p-6">
                  <p className="text-sm font-medium text-brand-soft-foreground">
                    Founding price — first {FOUNDING_SPOTS} schools
                  </p>
                  <p className="font-display mt-2 text-3xl font-semibold text-foreground">
                    {FOUNDING_PRICE}
                    <span className="ml-1 text-sm font-normal text-brand-soft-foreground">/ month</span>
                  </p>
                  <p className="mt-2 text-sm text-brand-soft-foreground">
                    Locked in for as long as your school stays subscribed.
                    {spotsLeft > 0
                      ? ` ${spotsLeft} of ${FOUNDING_SPOTS} places still open.`
                      : " All places have been taken."}
                  </p>
                </div>
              </Reveal>
            </div>

            <Reveal>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-8">
                <LinkButton href="/register" size="lg">
                  Start my free trial
                </LinkButton>
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                >
                  Full pricing details
                </Link>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="text-success">✓</span> No card required — full access for {TRIAL_DAYS} days, free.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Objections, answered on the page. */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                Before you sign up
              </h2>
            </Reveal>
            <div className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
              {HOME_FAQ.map((item) => (
                <details key={item.q} className="group">
                  <summary className="transition-standard flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-sm font-medium text-foreground hover:text-brand">
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
                  <p className="max-w-2xl pb-5 text-sm text-muted-foreground">{item.a}</p>
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

        {/* One final ask, in the same words as every other CTA. */}
        <section className="bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
                <div>
                  <h2 className="font-display max-w-md text-2xl font-semibold sm:text-3xl">
                    Stop wondering who owes. See it for yourself.
                  </h2>
                  <p className="mt-3 max-w-md text-sm text-background/70">
                    Set up your classes, bring your children across from the
                    spreadsheet you already keep, and watch the first month&rsquo;s
                    fees create themselves. {TRIAL_DAYS} days, every feature, no card.
                  </p>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <LinkButton href="/register" size="lg">
                      Start my free trial
                    </LinkButton>
                    <Link
                      href="/pricing"
                      className="text-sm font-medium text-background underline decoration-background/40 underline-offset-4 hover:decoration-background"
                    >
                      See pricing
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
