import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { MarketingHeader } from "@/components/MarketingHeader";
import { auth } from "@/lib/auth";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LegalDoc } from "@/components/LegalDoc";

// Refund and cancellation policy (Dylan, 30 Sept 2026) -- asked for by
// Paystack to activate live payments. Describes what the app actually does
// (trial, plans, Settings -> Billing cancel, read-only after the paid
// period, 30-day trash on delete).
export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description: "How Crechely subscriptions, cancellations and refunds work.",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  const session = await auth();
  const markdown = fs.readFileSync(path.join(process.cwd(), "legal", "REFUND_POLICY.md"), "utf-8");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader isAuthenticated={Boolean(session?.user?.id)} />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <LegalDoc markdown={markdown} />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
