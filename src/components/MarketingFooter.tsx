import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand font-display text-xs font-bold text-brand-foreground">
            T
          </div>
          <span className="text-sm text-muted-foreground">
            Crechely — accounting built for preschools
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Start free trial
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
