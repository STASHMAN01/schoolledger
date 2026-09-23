import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";

// CHANGELOG C1/C3 (2026-09-19): this footer rendered a leftover "T" badge
// (TinyLedger, the old name) while the header already showed the current
// mark — see CRECHELY_AUDIT.md C1. Now uses the real logo everywhere, and
// C3 adds the contact/legal links this footer had none of before: Contact
// (mailto + WhatsApp) and Privacy/Terms.
export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="icon" size={24} />
            <span className="text-sm text-muted-foreground">
              Crechely — fee tracking &amp; statements for preschools
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/support" className="hover:text-foreground">
              Contact
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Start free trial
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
          </nav>
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-border pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">
              {SUPPORT_EMAIL}
            </a>
            {/* Shown only once a real number is set in src/lib/support.ts --
                no public "coming soon" placeholder (final inspection N3). */}
            {WHATSAPP_NUMBER && (
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                WhatsApp us
              </a>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/popia" className="hover:text-foreground">
              POPIA notice
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
