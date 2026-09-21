import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";
import { getEffectivePermissions } from "@/lib/permissions";

// Mirrors accounting/layout.tsx -- blocks direct URL access to
// /dashboard/centre/* for anyone without VIEW_CENTRE (e.g. an Accountant
// by default).
export default async function CentreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await getPrimaryMembership(session.user.id);
  if (!membership) redirect("/register");

  const permissions = getEffectivePermissions(membership.role, membership.permissionOverrides);
  if (!permissions.includes("VIEW_CENTRE")) {
    redirect(permissions.includes("VIEW_ACCOUNTING") ? "/dashboard/accounting" : "/dashboard");
  }

  return <>{children}</>;
}
