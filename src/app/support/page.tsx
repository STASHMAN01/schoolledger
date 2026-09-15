import Link from "next/link";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Card } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/support";

const GUIDE_SECTIONS = [
  {
    title: "1. Set up your school",
    body: "Go to Settings → General to upload your logo and letterhead, and fill in your address, contact details, and bank details. Your letterhead appears automatically at the top of every statement you generate.",
  },
  {
    title: "2. Add categories and children",
    body: "Categories (Grade R, Toddlers, Aftercare, etc.) live under Categories, and each one can have its own monthly fee. Add children under Children, assign each one to a category, and their monthly fees are generated automatically.",
  },
  {
    title: "3. Record payments",
    body: "When a parent pays, go to Payments and record the amount, method, and date. It's automatically applied to whatever that child owes, oldest first — or to a specific fee if you tag it.",
  },
  {
    title: "4. Send reminders",
    body: "The Reminders page lists every child with money outstanding and a ready-to-send message. Click WhatsApp or Email to open it pre-filled in your own app, edit it if you like, then mark it as sent. The dashboard's \"Reminders sent / unsent\" cards give you a running count.",
  },
  {
    title: "5. Deleting things safely",
    body: "Categories, children, and other records can't be deleted with a single click — deleting requires two admins to approve, and anything approved goes to Trash for 30 days before it's gone for good, so mistakes are always recoverable in time.",
  },
  {
    title: "6. Team & roles",
    body: "Invite your team under Settings → Team. Admins can manage billing, team members, and approvals. Accountants and Managers can record day-to-day activity. Viewers can look but not change or approve anything.",
  },
  {
    title: "7. Statements",
    body: "Generate a parent statement from a child's page — it uses your letterhead and lists exactly what was charged and paid, month by month.",
  },
];

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Support &amp; how to use TinyLedger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stuck on something, found a bug, or just have a question? Email us
          and we&apos;ll get back to you.
        </p>

        <Card className="mt-6 p-5">
          <p className="text-sm text-muted-foreground">Contact support</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-display mt-1 inline-block text-lg font-semibold text-brand hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </Card>

        <h2 className="font-display mt-10 mb-4 text-lg font-semibold text-foreground">
          How to use TinyLedger
        </h2>
        <div className="flex flex-col gap-3">
          {GUIDE_SECTIONS.map((s) => (
            <Card key={s.title} className="p-4">
              <h3 className="text-sm font-medium text-foreground">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Already a customer?{" "}
          <Link href="/dashboard" className="text-brand hover:underline">
            Go to your dashboard
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
