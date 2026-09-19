import type { Metadata } from "next";
import { TRIAL_DAYS } from "@/lib/trial";

// register/page.tsx is a client component ("use client"), so it can't
// export its own metadata — this layout carries it instead. Fixes H1:
// before this, /register showed the exact same <title>/description as
// every other page (verified live, see CRECHELY_AUDIT.md).
export const metadata: Metadata = {
  title: "Start your free trial",
  description: `Set up your preschool or crèche on Crechely in a few minutes — no card required, ${TRIAL_DAYS} days free.`,
  alternates: { canonical: "/register" },
  openGraph: {
    title: "Start your free trial | Crechely",
    description: `Set up your preschool on Crechely — no card required, ${TRIAL_DAYS} days free.`,
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
