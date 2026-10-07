import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkIsPlatformAdmin } from "@/lib/platformAdmin";
import { hasPassedStepUp } from "@/lib/platformTwoFactor";
import { TwoFactorForm } from "./TwoFactorForm";

export const metadata: Metadata = { title: "Two-factor check", robots: { index: false } };

// The gate in front of /platform (security review #5). Lives outside
// /platform so the platform layout can redirect here without looping.
export default async function PlatformVerifyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/platform");
  if (!(await checkIsPlatformAdmin(session.user.id))) redirect("/dashboard");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabledAt: true, tokenVersion: true },
  });
  if (!user) redirect("/login");
  if (user.totpEnabledAt && (await hasPassedStepUp(session.user.id, user.tokenVersion))) {
    redirect("/platform");
  }

  return <TwoFactorForm enabled={Boolean(user.totpEnabledAt)} />;
}
