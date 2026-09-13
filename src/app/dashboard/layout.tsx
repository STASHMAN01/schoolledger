import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";
import { OrgProvider } from "./OrgContext";
import { SignOutButton } from "./SignOutButton";
import { TrialBanner } from "./TrialBanner";
import { hasActiveAccess } from "@/lib/billing/access";

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

  return (
    <OrgProvider
      value={{
        organizationId: membership.organizationId,
        organizationName: org.name,
        role: membership.role,
        hasActiveAccess: hasActiveAccess(org),
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
      }}
    >
      <div className="min-h-screen">
        <TrialBanner />
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <span className="font-semibold">{membership.organization.name}</span>
              <nav className="flex gap-4 text-sm text-neutral-600">
                <Link href="/dashboard" className="hover:text-neutral-900">
                  Home
                </Link>
                <Link href="/dashboard/categories" className="hover:text-neutral-900">
                  Categories
                </Link>
                <Link href="/dashboard/children" className="hover:text-neutral-900">
                  Children
                </Link>
                <Link href="/dashboard/payments" className="hover:text-neutral-900">
                  Payments
                </Link>
                <Link href="/dashboard/events" className="hover:text-neutral-900">
                  Events
                </Link>
                <Link href="/dashboard/reminders" className="hover:text-neutral-900">
                  Reminders
                </Link>
                <Link
                  href="/dashboard/settings/payment-types"
                  className="hover:text-neutral-900"
                >
                  Payment types
                </Link>
                <Link href="/dashboard/settings/billing" className="hover:text-neutral-900">
                  Billing
                </Link>
                <Link href="/dashboard/settings/team" className="hover:text-neutral-900">
                  Team
                </Link>
              </nav>
            </div>
            <SignOutButton />
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </div>
    </OrgProvider>
  );
}
