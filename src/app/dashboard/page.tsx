import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";
import { getEffectivePermissions } from "@/lib/permissions";
import { MODE_COOKIE } from "./ModeSwitch";

// Bare /dashboard is a smart entry point, not a real page: send the user
// to whichever mode they used last (the cookie ModeSwitch sets), or
// Accounting by default -- new/first-time users land on the familiar
// billing dashboard rather than the still-mostly-empty Centre Management
// home (see docs/PLAN.md decision #3). If the user's permissions only
// allow one mode (e.g. an Accountant with no VIEW_CENTRE, or a
// Teacher/Receptionist with no VIEW_ACCOUNTING), that one wins regardless
// of the cookie -- there's no point remembering a preference for a mode
// they can't actually open.
export default async function DashboardIndexPage() {
  const session = await auth();
  const membership = session?.user?.id ? await getPrimaryMembership(session.user.id) : null;
  const permissions = membership
    ? getEffectivePermissions(membership.role, membership.permissionOverrides)
    : [];
  const canCentre = permissions.includes("VIEW_CENTRE");
  const canAccounting = permissions.includes("VIEW_ACCOUNTING");

  if (canAccounting && !canCentre) redirect("/dashboard/accounting");
  if (canCentre && !canAccounting) redirect("/dashboard/centre");

  const cookieStore = await cookies();
  const mode = cookieStore.get(MODE_COOKIE)?.value;
  redirect(mode === "centre" ? "/dashboard/centre" : "/dashboard/accounting");
}
