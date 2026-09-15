import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { checkIsPlatformAdmin } from "@/lib/platformAdmin";
import { SignOutButton } from "@/app/dashboard/SignOutButton";

// Completely separate from /dashboard's layout: this area has nothing to
// do with any one organization, so it deliberately does NOT go through
// getPrimaryMembership/OrgProvider — a platform admin doesn't need to be a
// member of any school to see this. Access is gated purely by
// isPlatformAdmin / PLATFORM_ADMIN_EMAILS (see src/lib/platformAdmin.ts).
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/platform");

  const allowed = await checkIsPlatformAdmin(session.user.id);
  if (!allowed) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold text-brand-foreground">
              P
            </div>
            <span className="font-display text-sm font-semibold text-foreground sm:text-base">
              Platform
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/platform"
              className="transition-standard rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Overview
            </Link>
            <Link
              href="/platform/organizations"
              className="transition-standard rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Schools
            </Link>
            <Link
              href="/platform/team"
              className="transition-standard rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Team
            </Link>
            <Link
              href="/dashboard"
              className="transition-standard rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Back to app
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
