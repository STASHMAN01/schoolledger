"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

// Full replacement for the dashboard's normal content (nav + page) when
// the signed-in user hasn't clicked their verification link yet -- see
// the gate in dashboard/layout.tsx. Header/sign-out stay visible around
// this (rendered by the layout itself) so an unverified admin isn't fully
// trapped: they can still resend the email, check they typed it right,
// or sign out and register again with a different address.
export function VerifyEmailGate({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setStatus("sending");
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <Card className="animate-in p-6 text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">
          Verify your email to continue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          Click it to finish setting up your school — this confirms it&apos;s a real, working
          address before you start adding children and payments.
        </p>
        <Button className="mt-4" onClick={resend} disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Resend verification email"}
        </Button>
        {status === "sent" && (
          <p className="mt-2 text-xs text-success">
            Sent — check your inbox (and spam folder).
          </p>
        )}
        {status === "error" && (
          <p className="mt-2 text-xs text-danger">Could not resend right now. Try again shortly.</p>
        )}
      </Card>
    </div>
  );
}
