import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LegalDoc } from "@/components/LegalDoc";

// Fixes C2 (see CRECHELY_AUDIT.md): before this, there was no privacy
// policy reachable from the site at all — a drafted one existed in the
// repo (legal/PRIVACY_POLICY.md) but was never published as a page or
// linked anywhere. It is still explicitly a DRAFT pending lawyer review
// (banner below) — publishing the route makes that draft visible and
// honest about its status, it does not mean it's finished.
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Crechely collects, uses, and protects personal information.",
  alternates: { canonical: "/privacy" },
  robots: { index: false }, // draft — don't index until lawyer-reviewed
};

export default function PrivacyPage() {
  const markdown = fs.readFileSync(
    path.join(process.cwd(), "legal", "PRIVACY_POLICY.md"),
    "utf-8"
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-soft-foreground">
            <strong>DRAFT — not yet reviewed by a lawyer.</strong> This is
            published so it&rsquo;s honestly visible rather than hidden, not
            because it&rsquo;s finished. See{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/popia" className="underline">
              POPIA notice
            </Link>{" "}
            too.
          </div>
          <div className="mt-8">
            <LegalDoc markdown={markdown} />
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
