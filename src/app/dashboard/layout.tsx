import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";
import { OrgProvider } from "./OrgContext";
import { SignOutButton } from "./SignOutButton";
import { TrialBanner } from "./TrialBanner";
import { NavLinks } from "./NavLinks";
import { ModeSwitch } from "./ModeSwitch";
import { hasActiveAccess } from "@/lib/billing/access";
import { checkIsPlatformAdmin } from "@/lib/platformAdmin";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await getPrimaryMembership(session.user.id);
  if (!membership) {
    // A signed-in user with no organization shouldn't be possible via the
    // normal registration flow, but fail closed rather than crash.
    redirect("/register");
  }

  const org = membership.organization;
  const isPlatformAdmin = await checkIsPlatformAdmin(session.user.id);

  return (
    <OrgProvider
      value={{
        organizationId: membership.organizationId,
        organizationName: org.name,
        role: membership.role,
        hasActiveAccess: hasActiveAccess(org),
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
        currencyCode: org.currencyCode,
      }}
    >
      <div className="min-h-screen bg-background">
        <TrialBanner />
        <header className="relative border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <ModeSwitch />
              {org.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data: URL, next/image can't optimize these anyway
                <img
                  src={org.logoImage}
                  alt={`${org.name} logo`}
                  className="h-8 w-8 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold text-brand-foreground">
                  {membership.organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-display truncate text-sm font-semibold text-foreground sm:text-base">
                {membership.organization.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NavLinks />
              {isPlatformAdmin && (
                <Link
                  href="/platform"
                  className="transition-standard rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  Platform
                </Link>
              )}
              <Link
                href="/support"
                title="Support & how to use Crechely"
                className="transition-standard rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
              >
                Support
              </Link>
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
      </div>
    </OrgProvider>
  );
}
