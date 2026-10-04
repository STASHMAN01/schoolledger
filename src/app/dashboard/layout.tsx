import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";
import { getEffectivePermissions } from "@/lib/permissions";
import { OrgProvider } from "./OrgContext";
import { SignOutButton } from "./SignOutButton";
import { TrialBanner } from "./TrialBanner";
import { MobileMenu, NavBar, UtilityLinks } from "./NavLinks";
import { ModeSwitch } from "./ModeSwitch";
import { ErrorCatcher } from "./ErrorCatcher";
import { TourProvider } from "./TourContext";
import { TourOverlay } from "./TourOverlay";
import { hasActiveAccess } from "@/lib/billing/access";
import { checkIsPlatformAdmin } from "@/lib/platformAdmin";
import { db } from "@/lib/db";
import { VerifyEmailGate } from "./VerifyEmailGate";
import { DeletedSchoolScreen } from "./DeletedSchoolScreen";
import { purgeDateFor } from "@/lib/orgDeletion";
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
  const permissions = getEffectivePermissions(membership.role, membership.permissionOverrides, {
    isProfile: membership.user.isProfile,
  });

  // Gate: registration isn't "done" until this admin has clicked the link
  // sent to their email (see /api/auth/register + /api/auth/verify-email).
  // This is deliberately checked fresh from the DB every request, not
  // cached in the JWT, so verifying in one tab/device is reflected on the
  // very next load here without needing to log out and back in.
  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  const emailVerified = Boolean(currentUser?.emailVerified);
  // School in the 30-day trash: nothing is usable except the restore screen.
  const isDeleted = Boolean(org.deletedAt);
  const showApp = emailVerified && !isDeleted;

  return (
    <OrgProvider
      value={{
        organizationId: membership.organizationId,
        organizationName: org.name,
        role: membership.role,
        permissions,
        hasActiveAccess: hasActiveAccess(org),
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
        currentPeriodEnd: org.currentPeriodEnd ? org.currentPeriodEnd.toISOString() : null,
        currencyCode: org.currencyCode,
        centreTourSeenAt: membership.centreTourSeenAt ? membership.centreTourSeenAt.toISOString() : null,
        accountingTourSeenAt: membership.accountingTourSeenAt
          ? membership.accountingTourSeenAt.toISOString()
          : null,
      }}
    >
      <TourProvider>
      <div className="min-h-screen bg-background">
        <TrialBanner />
        {/* Two rows (Dylan 23 Sept, "tabs crashing into each other"): mode
            switch far left + school + utilities on row 1; main tabs on row
            2 (tablet/desktop) or in the ☰ menu (phones). */}
        <header className="relative border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <ModeSwitch />
              {org.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data: URL, next/image can't optimize these anyway
                <img
                  src={org.logoImage}
                  alt={`${org.name} logo`}
                  className="hidden h-8 w-8 shrink-0 rounded-lg object-cover sm:block"
                />
              ) : (
                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold text-brand-foreground sm:flex">
                  {membership.organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-display truncate text-sm font-semibold text-foreground sm:text-base">
                {membership.organization.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <UtilityLinks isPlatformAdmin={isPlatformAdmin} />
              {/* Phones: theme and Log out move into the menu so the
                  school name has room (mobile pass, 24 Sept). */}
              <div className="hidden md:flex md:items-center md:gap-1">
                <ThemeToggle />
                <SignOutButton />
              </div>
              <MobileMenu isPlatformAdmin={isPlatformAdmin} />
            </div>
          </div>
          {showApp && (
            <div className="hidden border-t border-border md:block">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <NavBar />
              </div>
            </div>
          )}
        </header>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {isDeleted && org.deletedAt ? (
            <DeletedSchoolScreen
              organizationId={membership.organizationId}
              schoolName={org.name}
              purgeAfter={purgeDateFor(org.deletedAt).toISOString()}
              canRestore={membership.role === "ADMIN"}
            />
          ) : emailVerified ? (
            children
          ) : (
            <VerifyEmailGate email={currentUser?.email ?? ""} />
          )}
        </div>
        <ErrorCatcher />
        {showApp && <TourOverlay />}
      </div>
      </TourProvider>
    </OrgProvider>
  );
}
