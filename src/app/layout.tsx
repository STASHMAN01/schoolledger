import type { Metadata } from "next";
import { Inter, Lexend, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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

export const metadata: Metadata = {
  title: "TinyLedger — Accounting built for preschools",
  description:
    "TinyLedger is fee and payment tracking built for preschools, nurseries, and crèches: enrollments, recurring fees, payment history, and statements in one place.",
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
            no flash of the wrong theme between the server-rendered (system-
            preference) page and the client reading localStorage. Inline and
            blocking on purpose — this has to run before the browser paints
            anything. Fails silently (e.g. localStorage blocked) and just
            falls back to the system preference already baked into the CSS. */}
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
