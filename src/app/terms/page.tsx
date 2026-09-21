import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { MarketingHeader } from "@/components/MarketingHeader";
import { auth } from "@/lib/auth";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LegalDoc } from "@/components/LegalDoc";

// Fixes C2 — see CRECHELY_AUDIT.md and src/app/privacy/page.tsx for the
// same note: this makes an existing DRAFT visible, it doesn't finish it.
export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms of service agreement between a school and Crechely.",
  alternates: { canonical: "/terms" },
  robots: { index: false },
};

export default async function TermsPage() {
  const session = await auth();
  const markdown = fs.readFileSync(
    path.join(process.cwd(), "legal", "TERMS_OF_SERVICE.md"),
    "utf-8"
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader isAuthenticated={Boolean(session?.user?.id)} />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-soft-foreground">
            <strong>DRAFT — not yet reviewed by a lawyer.</strong> Published so
            it&rsquo;s honestly visible, not because it&rsquo;s finished. See{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
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
