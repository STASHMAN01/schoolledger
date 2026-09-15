import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
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
      className={`${inter.variable} ${lexend.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
