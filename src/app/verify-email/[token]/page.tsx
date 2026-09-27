"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<"checking" | "done" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "This verification link is invalid or has expired.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }, [params.token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consume the link's token on mount
    verify();
  }, [verify]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="animate-in mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-4">
          <Logo variant="icon" size={44} className="rounded-xl" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Verify your email
        </h1>
      </div>

      <Card className="animate-in p-6">
        {status === "checking" ? (
          <p className="text-sm text-muted-foreground">Confirming your email…</p>
        ) : status === "done" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Your email is verified. Your school is ready to go.
            </p>
            <Button onClick={() => (window.location.href = "/dashboard")}>
              Go to your dashboard
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-danger">{error}</p>
            <p className="text-sm text-muted-foreground">
              Log in and use the &quot;Resend verification email&quot; button to get a fresh
              link.
            </p>
            <Link href="/login">
              <Button className="w-full">Log in</Button>
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
