import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MODE_COOKIE } from "./ModeSwitch";

// Bare /dashboard is a smart entry point, not a real page: send the user
// to whichever mode they used last (the cookie ModeSwitch sets), or
// Accounting by default -- new/first-time users land on the familiar
// billing dashboard rather than the still-mostly-empty Centre Management
// home (see docs/PLAN.md decision #3).
export default async function DashboardIndexPage() {
  const cookieStore = await cookies();
  const mode = cookieStore.get(MODE_COOKIE)?.value;
  redirect(mode === "centre" ? "/dashboard/centre" : "/dashboard/accounting");
}
