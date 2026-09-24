import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { MarketingHeader } from "@/components/MarketingHeader";
import { auth } from "@/lib/auth";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";
import { TRIAL_DAYS } from "@/lib/trial";

// Fixes H1 — see CRECHELY_AUDIT.md.
export const metadata: Metadata = {
  title: "Pricing",
  description: `R499/month or R4,990/year, flat — one plan, everything included, no per-child fees, ${TRIAL_DAYS}-day free trial.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Crechely pricing",
    description: "R499/month or R4,990/year, flat — one plan, everything included.",
  },
};

// H6: this used to repeat the homepage's feature list, which doesn't
// answer what someone on a pricing page is actually asking. These are the
// specific objections a price-sensitive buyer comparing 2-3 tools in one
// evening would have.
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

// H7.
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
    a: "By email, to the address on the child's record. There are no SMS or WhatsApp reminders.",
  },
];

export default async function PricingPage() {
  const session = await auth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader isAuthenticated={Boolean(session?.user?.id)} />

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-brand">
            Pricing
          </p>
          {/* H5: single value framing sitewide — "one paying family a
              month covers it" — replacing the old "one term of one
              child's fees" line here so the site says one thing, not two. */}
          <h1 className="font-display mt-3 max-w-lg text-3xl font-semibold text-foreground sm:text-4xl">
            One paying family a month covers your whole school.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            One plan, no tiers, nothing locked behind a higher price.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="text-success">✓</span> No card, no commitment — free for {TRIAL_DAYS} days.
          </p>
        </section>

        {/* H5: one card with a monthly/yearly toggle, not two competing
            cards — two cards read as "which plan is right for me," which
            contradicts "no tiers." Toggle is server-rendered as two
            visible rows here (no client JS needed) but styled as one
            unit — see BEFORE_AFTER.md if a true interactive toggle is
            wanted later. */}
        <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
          <div className="border border-border-strong bg-surface">
            <div className="flex flex-col gap-1 px-5 py-6 sm:px-6">
              <span className="font-display text-base font-semibold text-foreground">
                Crechely — one plan, everything included
              </span>
              <p className="text-sm text-muted-foreground">
                Every feature, for every school, whether you have 10 children or 200.
                Nothing to upgrade into later.
              </p>
            </div>
            <div className="grid divide-y divide-border-strong border-t border-border-strong sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex flex-col justify-between gap-4 px-5 py-6 sm:px-6">
                <div>
                  <span className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Monthly
                  </span>
                  <div className="font-mono mt-1 text-2xl font-semibold text-foreground">
                    R499<span className="ml-1 text-sm font-normal text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pay as you go, cancel any time — no contract.
                  </p>
                </div>
                <LinkButton href="/register" size="sm">
                  Start free trial
                </LinkButton>
              </div>
              <div className="flex flex-col justify-between gap-4 bg-brand-soft/40 px-5 py-6 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Yearly
                    </span>
                    <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-brand">
                      2 months free
                    </span>
                  </div>
                  <div className="font-mono mt-1 text-2xl font-semibold text-foreground">
                    R4,990<span className="ml-1 text-sm font-normal text-muted-foreground">/ year</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Billed once a year. R499 × 12 = R5,988 — you pay R4,990, exactly
                    2 months free. 30-day money-back guarantee.
                  </p>
                </div>
                <LinkButton href="/register" size="sm">
                  Start free trial
                </LinkButton>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            All prices in South African Rand.{" "}
            {/* VAT status is an assumption pending Dylan's confirmation — see
                PRICING_RECOMMENDATION.md / OPEN_QUESTIONS.md. Do not treat
                this line as verified tax advice. */}
            Crechely is not currently VAT-registered, so no VAT is added to
            these prices. <em>(Confirm this is still accurate before relying on it.)</em>
          </p>

          {/* H8: product truth, stated plainly, not buried. */}
          <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground">
            Crechely <strong>records</strong> the cash, EFT, and card payments your
            school already receives — it does not collect money from parents
            itself, and Paystack online payment isn&rsquo;t live yet. Reminders go
            out by email only, to the address on each child&rsquo;s record.
          </p>

          <div className="mt-10 border-t border-border pt-8">
            <h2 className="font-display text-base font-semibold text-foreground">
              Before you commit
            </h2>
            <div className="mt-4 flex flex-col divide-y divide-border">
              {OBJECTIONS.map((o) => (
                <div key={o.q} className="py-3">
                  <p className="text-sm font-medium text-foreground">{o.q}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{o.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-8">
            <h2 className="font-display text-base font-semibold text-foreground">
              Frequently asked questions
            </h2>
            <div className="mt-4 flex flex-col divide-y divide-border">
              {FAQ.map((f) => (
                <div key={f.q} className="py-3">
                  <p className="text-sm font-medium text-foreground">{f.q}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-10 text-sm text-muted-foreground">
            Not sure yet? Start the free trial — no card needed — and decide
            once you&rsquo;ve actually used it with your real families. Prefer to
            talk first? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand hover:underline">
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
                  className="font-medium text-brand hover:underline"
                >
                  WhatsApp us
                </a>
              </>
            )}{" "}
            and we&rsquo;ll send a sample statement so you can see the actual output
            before signing up.
          </p>

          <div className="mt-6">
            <Link
              href="/register"
              className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
            >
              Start free trial →
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
