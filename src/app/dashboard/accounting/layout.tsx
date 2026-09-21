import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";
import { getEffectivePermissions } from "@/lib/permissions";

// Guards every /dashboard/accounting/* page against someone who can't
// view this mode at all (e.g. a Teacher or Receptionist by default) --
// NavLinks/ModeSwitch already hide the way in, but a direct URL must be
// blocked server-side too, the same principle as every API route's own
// requireMembership check.
export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await getPrimaryMembership(session.user.id);
  if (!membership) redirect("/register");

  const permissions = getEffectivePermissions(membership.role, membership.permissionOverrides);
  if (!permissions.includes("VIEW_ACCOUNTING")) {
    redirect(permissions.includes("VIEW_CENTRE") ? "/dashboard/centre" : "/dashboard");
  }

  return <>{children}</>;
}
