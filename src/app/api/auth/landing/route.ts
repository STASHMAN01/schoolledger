import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkIsPlatformAdmin } from "@/lib/platformAdmin";

// Where a freshly signed-in user should land by default. Only consulted by
// LoginForm when the login wasn't reached via an explicit callbackUrl (an
// invite link, a "session expired, come back here" redirect, etc. always
// wins over this). A platform admin (see src/lib/platformAdmin.ts) lands on
// /platform — the cross-tenant owner dashboard — instead of /dashboard,
// which requires an organization membership and would otherwise send an
// admin with no school of their own into the "register a school" flow.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ redirectTo: "/dashboard" });
  }
  const isPlatformAdmin = await checkIsPlatformAdmin(session.user.id);
  return NextResponse.json({ redirectTo: isPlatformAdmin ? "/platform" : "/dashboard" });
}
