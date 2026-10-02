"use client";

import { SessionProvider } from "next-auth/react";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RegisterServiceWorker />
      {children}
    </SessionProvider>
  );
}
