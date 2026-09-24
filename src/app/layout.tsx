import type { Metadata, Viewport } from "next";
import { Inter, Lexend, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// Inter: the body/UI typeface — exceptionally legible across languages and
// scripts, which matters for a product aimed at schools worldwide, not just
// English-first markets.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Lexend: headings only. Designed and studied specifically for reading
// proficiency/ease — a deliberate choice for a product whose users are
// preschool admins and parents, not developers, and who may be reading in
// a second language.
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
});

// IBM Plex Mono: reserved for money and tabular data — amounts, dates,
// receipt/statement numbers, plan prices. This is a ledger; leaning into a
// monospaced, tabular treatment for figures is a real product decision
// (numbers in a column should actually line up), not a decorative font
// pairing. Never used for prose.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// CHANGELOG H1/C6 (2026-09-19): every page previously inherited this exact
// title/description with no override, so /, /pricing, /register, /login,
// /support all showed identically in search results and link previews
// (verified live — see CRECHELY_AUDIT.md H1). Each of those pages now sets
// its own metadata; this is only the site-wide default/fallback plus the
// OG/Twitter/canonical config every page shares.
// Title wording deliberately UNCHANGED from what's live today
// ("Accounting built for preschools") — M1 in CRECHELY_AUDIT.md flags this
// exact phrase as worth reconsidering, but asks for 3 alternatives and
// Dylan's sign-off before changing it, not a unilateral rewrite. Only the
// technical metadata (per-page uniqueness, OG/Twitter, canonical,
// metadataBase) changed here.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Accounting built for preschools`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Crechely helps preschools, nurseries and crèches run the whole centre: online applications, enrolment, attendance, classes, timetables, fees, payments and statements in one place.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — Accounting built for preschools`,
    description:
      "Applications, enrolment, attendance, classes and fees for preschools, all in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Accounting built for preschools`,
    description:
      "Applications, enrolment, attendance, classes and fees for preschools, all in one place.",
  },
};

// This was missing entirely, which is the actual cause of "everything is
// zoomed out and I have to pinch to read it" on mobile: without a viewport
// meta tag, mobile browsers assume the page was built for a ~980px desktop
// layout and shrink the whole thing to fit, rather than laying it out at
// the phone's real width. maximumScale/userScalable are left at their
// defaults (both effectively unset here) so pinch-zoom still works for
// accessibility — this only fixes the *initial* render, it doesn't lock
// zoom out.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lexend.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies a saved light/dark choice before first paint, so there's
            no flash of the wrong theme between the server-rendered (light
            by default) page and the client reading localStorage. Inline and
            blocking on purpose — this has to run before the browser paints
            anything. Fails silently (e.g. localStorage blocked) and just
            leaves the page on its light default. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
