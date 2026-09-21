import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

// isAuthenticated: pass true from a server-component page that already
// checked auth() -- otherwise this header has no idea the visitor is
// signed in and always shows "Log in"/"Start free trial", which looks
// like the app just logged them out the moment they click, say, Support
// from inside the dashboard (real bug Dylan hit, 2026-09-21: the session
// was never actually gone, this header just can't see it). Defaults to
// false so a caller that hasn't been updated yet keeps today's behavior.
export function MarketingHeader({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="icon" size={32} />
          <span className="font-display text-base font-semibold text-foreground">
            Crechely
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
          <Link
            href="/support"
            className="transition-standard hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground sm:inline-block"
          >
            Contact Us
          </Link>
          <ThemeToggle />
          {isAuthenticated ? (
            <LinkButton href="/dashboard" size="sm">
              Dashboard
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Log in
              </LinkButton>
              <LinkButton href="/register" size="sm">
                Start free trial
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
