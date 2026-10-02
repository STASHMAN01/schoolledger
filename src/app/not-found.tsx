import Link from "next/link";
import { auth } from "@/lib/auth";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SUPPORT_EMAIL } from "@/lib/support";

// Until 2 Oct 2026 this file didn't exist, and it wouldn't have been
// reached anyway: the middleware sent every path it didn't recognise to
// /login, so a typo'd URL or a stale inbound link showed a logged-out
// visitor "Welcome back" instead of a 404, and crawlers were served a
// login page where a 404 belonged. See requiresSession in
// src/lib/publicPaths.ts for the other half of that fix.

export default async function NotFound() {
  const session = await auth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader isAuthenticated={Boolean(session?.user?.id)} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-20 sm:px-6">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-foreground">
          That page isn&rsquo;t here
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          The link may be out of date, or the address may have a typo in it.
          Nothing is wrong with your account.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="transition-standard inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:brightness-90"
          >
            Go to the home page
          </Link>
          <Link
            href="/pricing"
            className="transition-standard inline-flex min-h-11 items-center rounded-lg border border-border-strong px-4 text-sm font-semibold text-foreground hover:bg-surface"
          >
            See pricing
          </Link>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Looking for your school?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Log in
          </Link>
          . Still stuck?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
