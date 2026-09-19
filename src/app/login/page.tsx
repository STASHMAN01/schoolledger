import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// Fixes H1 — see CRECHELY_AUDIT.md: /login previously shared the
// site-wide default title/description with every other page.
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Crechely account to manage fees, payments, and statements.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Log in | Crechely",
    description: "Log in to your Crechely account.",
  },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
