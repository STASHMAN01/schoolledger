import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { auth } from "@/lib/auth";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";
import { TRIAL_DAYS } from "@/lib/trial";
// Prices come from one module so the homepage and this page can never
// disagree -- see src/lib/pricingDisplay.ts.
import {
  MONTHLY_PRICE,
  YEARLY_PRICE,
  FOUNDING_PRICE,
  TWELVE_MONTHS_PRICE,
  YEARLY_VS_MONTHLY,
  MONTHS_FREE_ON_YEARLY,
  PLAN_INCLUDES,
} from "@/lib/pricingDisplay";
import { FOUNDING_SPOTS, foundingSpotsLeft } from "@/lib/billing/founding";

// Styled to match the homepage after its 2 Oct 2026 rebuild: navy strip,
// dot-led eyebrows, rounded cards with soft shadows, the founding offer
// featured and badged, objections and FAQ as expandable panels, navy
// closing section. The content is unchanged -- it was already the
// strongest part of this page -- only its presentation.

export const metadata: Metadata = {
  title: "Pricing",
  description: `${MONTHLY_PRICE}/month or ${YEARLY_PRICE}/year, flat — one plan, everything included, no per-child fees, ${TRIAL_DAYS}-day free trial.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Crechely pricing",
    description: `${MONTHLY_PRICE}/month or ${YEARLY_PRICE}/year, flat — one plan, everything included.`,
  },
};

// The specific objections a price-sensitive buyer comparing 2-3 tools in
// one evening would have.
const OBJECTIONS = [
  {
    q: `What happens on day ${TRIAL_DAYS + 1}, if I haven't paid?`,
    a: "Nothing is deleted. Your account moves to read-only — you can still see and export everything, but can't add new payments or send reminders until you subscribe.",
  },
  {
    q: "Is my data kept if I don't subscribe?",
    a: "Yes. There's no forced deletion at trial end. See our Privacy Policy for how long data is kept after a cancellation.",
  },
  {
    q: "How do I cancel?",
    a: "From Settings → Billing, any time, no contract. Paystack billing isn't live yet, so during this early period cancelling is one email to us.",
  },
  {
    q: "Can I get my data out before I leave?",
    a: "Yes. From Settings → Backup you can download everything Crechely holds for your school (children, guardians, classes, fees, payments, attendance and forms) as one password-protected ZIP file, any time. You're never locked in.",
  },
  {
    q: "What if I pay yearly and it's not for me?",
    a: "30-day money-back guarantee on the annual plan — email us within 30 days of paying and we'll refund it, no argument.",
  },
];

const FAQ = [
  {
    q: "How long does setup take?",
    a: "Add your classes, then your children (one by one or from an Excel file), and the monthly fees create themselves. Most of the work is typing in your children, so importing a list you already have is the quickest way.",
  },
  {
    q: "I keep my children's list in a spreadsheet or paper book right now. Can I bring that in?",
    a: "Your children can be imported from an Excel or CSV file, so a spreadsheet list doesn't need retyping. Past payments are entered by hand, and so is anything on paper, because there's no scanning yet.",
  },
  {
    q: "What happens to our data if we cancel?",
    a: "It's kept for a period after cancellation in case you want to come back or export it, then deleted — see the Privacy Policy for the exact retention period.",
  },
  {
    q: "How is the children's and parents' information handled under POPIA?",
    a: "We act as the operator/processor of that data on your instructions — your school remains the responsible party under POPIA, same as with a paper fee book or a spreadsheet. Read the full Privacy Policy and POPIA notice for exactly how data is handled and secured.",
  },
  {
    q: "Who on my staff can see what?",
    a: "You choose per person. An Admin sees and manages everything. An Accountant handles fees and payments. A Manager organises children and classes without seeing money. A Teacher sees only their own class, and a Receptionist can add children. You can also switch individual permissions on or off for one person.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes — it's a web app that works in your phone's browser, no app-store install needed. It's built to be usable on a mid-range Android phone on mobile data.",
  },
  {
    q: "Can parents pay through Crechely?",
    a: "No. Crechely records the cash, EFT, or card payment your school already received — it doesn't collect money from parents itself.",
  },
  {
    q: "How do reminders reach families?",
    a: "Crechely sends them by email, to the address on the child's record, with the family's statement attached. It can also write a WhatsApp reminder and open it in your own WhatsApp for you to send — but it never sends WhatsApp messages on your behalf. There are no SMS reminders.",
  },
];

export default async function PricingPage() {
  const [session, spotsLeft] = await Promise.all([
    auth(),
    // Counted from real subscriptions. Never hardcode this: a places-left
    // figure that doesn't move is an invented scarcity claim.
    foundingSpotsLeft(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-panel px-4 py-2 text-center text-xs text-panel-muted">
        Built for preschools, nurseries &amp; crèches · Made in South Africa
      </div>

      <MarketingHeader isAuthenticated={Boolean(session?.user?.id)} />

      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Pricing
            </p>
            <h1 className="font-display mt-4 max-w-2xl text-[clamp(2.1rem,4.2vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground">
              One paying family a month covers your whole school.
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
              One plan, no tiers, nothing locked behind a higher price. Every
              feature, whether you have 10 children or 200.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              No card, no commitment — free for {TRIAL_DAYS} days.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {/* The founding offer leads: it is the one worth noticing, and
                  the places-left figure is counted from real subscriptions,
                  never typed in — see foundingSpotsLeft(). */}
              <div className="relative flex h-full flex-col rounded-2xl border-2 border-brand bg-background p-6 shadow-[var(--shadow-brand)]">
                <span className="absolute -top-3 right-5 rounded-full bg-brand px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
                  First {FOUNDING_SPOTS} schools
                </span>
                <h2 className="font-display text-base font-semibold text-foreground">
                  Founding price
                </h2>
                <p className="font-display mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">
                  {FOUNDING_PRICE}
                  <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
                    / month
                  </span>
                </p>
                <p className="mt-2 min-h-14 text-sm text-muted-foreground">
                  Locked in for as long as you stay subscribed. Choose it on the
                  Billing page after your free trial.
                  {spotsLeft > 0
                    ? ` ${spotsLeft} of ${FOUNDING_SPOTS} places still open.`
                    : " All places have been taken."}
                </p>
                <Includes />
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
                blurb="Pay as you go, cancel any time — no contract."
              />
              <PlanCard
                name="Yearly"
                price={YEARLY_PRICE}
                per="/ year"
                blurb={`Billed once a year. ${MONTHLY_PRICE} × 12 = ${TWELVE_MONTHS_PRICE}, so you save ${YEARLY_VS_MONTHLY} — exactly ${MONTHS_FREE_ON_YEARLY} months free, with a 30-day money-back guarantee.`}
              />
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              All prices in South African Rand. Crechely is not VAT-registered, so no VAT is added to
              these prices. Cancel any time from Settings → Billing — see our{" "}
              <Link href="/refund-policy" className="text-brand hover:underline">
                refund and cancellation policy
              </Link>
              .
            </p>

            <p className="mt-5 max-w-3xl rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              Crechely <strong className="text-foreground">records</strong> the cash, EFT and card
              payments your school already receives — it does not collect money from parents itself.
              The reminders Crechely sends go out by email, with each family&rsquo;s statement
              attached. It can also write a WhatsApp reminder and open it in your own WhatsApp for
              you to send, but it never sends WhatsApp messages on your behalf.
            </p>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
              Before you commit
            </h2>
            <div className="mt-8 grid max-w-3xl gap-3">
              {OBJECTIONS.map((o) => (
                <Panel key={o.q} q={o.q} a={o.a} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="mt-8 grid max-w-3xl gap-3">
              {FAQ.map((f) => (
                <Panel key={f.q} q={f.q} a={f.a} surface />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-panel text-panel-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-panel-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-panel-muted" aria-hidden="true" />
                  Still deciding
                </p>
                <h2 className="font-display mt-3 max-w-xl text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                  Try it with your real families first.
                </h2>
                <p className="mt-3 max-w-lg text-sm text-panel-muted">
                  Start the free trial — no card needed — and decide once
                  you&rsquo;ve actually used it. Prefer to talk first? Email{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-medium text-panel-foreground underline underline-offset-4"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  {WHATSAPP_NUMBER && (
                    <>
                      {" "}
                      or{" "}
                      <a
                        href={WHATSAPP_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-panel-foreground underline underline-offset-4"
                      >
                        WhatsApp us
                      </a>
                    </>
                  )}{" "}
                  and we&rsquo;ll send a sample statement so you can see the actual
                  output before signing up.
                </p>
              </div>
              <Link
                href="/register"
                className="lift-on-hover inline-flex min-h-12 shrink-0 items-center rounded-xl bg-panel-foreground px-6 text-sm font-semibold text-panel"
              >
                Start my free trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Includes() {
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
      <h2 className="font-display text-base font-semibold text-foreground">{name}</h2>
      <p className="font-display mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">
        {price}
        <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">{per}</span>
      </p>
      <p className="mt-2 min-h-14 text-sm text-muted-foreground">{blurb}</p>
      <Includes />
      <div className="mt-auto pt-6">
        <LinkButton href="/register" variant="secondary" className="w-full justify-center">
          Start my free trial
        </LinkButton>
      </div>
    </div>
  );
}

function Panel({ q, a, surface = false }: { q: string; a: string; surface?: boolean }) {
  return (
    <details
      className={`group rounded-2xl border border-border px-5 py-4 shadow-[var(--shadow-card)] ${
        surface ? "bg-background" : "bg-surface"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-sm font-semibold text-foreground">
        {q}
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
      <p className="mt-3 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
