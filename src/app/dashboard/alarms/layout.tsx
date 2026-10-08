import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryMembership } from "@/lib/org";

// Dylan, 8 Oct 2026: only admins may add or edit alarms. Alarms are a
// device-wide setting on the tablet (they ring even when someone else is
// using the app), so a Teacher changing them affects everyone who shares
// that tablet, not just themselves. No ALARM-specific permission exists
// (and overriding one would muddy "admin-only"), so this is a plain role
// check, the same pattern as AccountingLayout's permission check.
export default async function AlarmsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await getPrimaryMembership(session.user.id);
  if (!membership) redirect("/register");

  if (membership.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
