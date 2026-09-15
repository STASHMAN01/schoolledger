import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MarketingHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold text-brand-foreground">
            T
          </div>
          <span className="font-display text-base font-semibold text-foreground">
            TinyLedger
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#features"
            className="transition-standard hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground sm:inline-block"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="transition-standard hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground sm:inline-block"
          >
            Pricing
          </Link>
          <ThemeToggle />
          <LinkButton href="/login" variant="ghost" size="sm">
            Log in
          </LinkButton>
          <LinkButton href="/register" size="sm">
            Start free trial
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
