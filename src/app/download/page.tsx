import type { Metadata } from "next";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { auth } from "@/lib/auth";
import { getJson, storageConfigured } from "@/lib/storage";
import { LATEST_RELEASE_KEY, type AppRelease } from "@/lib/appRelease";

// Public "Download the app" page (Dylan, 9 Oct 2026). The version shown is
// read from app/latest.json on every request, so it always matches what
// /api/download/app serves -- publish a new one on /platform/app-updates
// and this page and the download both move to it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download the app",
  description: "Get the Crechely app for Android phones and tablets. Log in with the same details you use on the website.",
  alternates: { canonical: "/download" },
};

const STEPS = [
  "Tap Download the app below. The file is called Crechely and ends in .apk.",
  "When it has finished, open the file from your notifications or your Downloads folder.",
  "If your phone asks, allow installs from this browser. This is a normal Android step for apps that don't come from the Play Store.",
  "If Google Play Protect shows a warning, tap More details, then Install anyway.",
  "Open Crechely and log in with the same email and password you use on the website. A new school? Start your free trial first.",
];

async function loadLatest(): Promise<AppRelease | null> {
  try {
    if (!storageConfigured()) return null;
    return await getJson<AppRelease>(LATEST_RELEASE_KEY);
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const [session, latest] = await Promise.all([auth(), loadLatest()]);
  const size = latest?.sizeBytes ? `${(latest.sizeBytes / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader isAuthenticated={!!session?.user} />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-semibold text-foreground">Download the Crechely app</h1>
        <p className="mt-3 text-muted-foreground">
          The same Crechely your teachers and office use, on an Android phone or tablet. Your login is the same as on the
          website.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {latest ? (
            <>
              <p className="font-display text-lg font-semibold text-foreground">Crechely {latest.versionName} for Android</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[size, `released ${new Date(latest.publishedAt).toLocaleDateString("en-ZA")}`].filter(Boolean).join(" · ")}
              </p>
              {latest.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{latest.notes}</p>}
              <div className="mt-5">
                {/* Plain anchor, not <Link>: a prefetch would hit the download route. */}
                <a
                  href="/api/download/app"
                  className="transition-standard inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover sm:min-h-0"
                >
                  Download the app
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The app isn&apos;t available to download just yet. Please check back soon.</p>
          )}
        </div>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">How to install it</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-foreground">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-muted-foreground">
          The app is for Android. On an iPhone or a computer, just use Crechely in your browser at crechely.co.za.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
