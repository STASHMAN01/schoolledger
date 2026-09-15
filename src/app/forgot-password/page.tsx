"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // The API always returns the same generic message, by design — this
      // page doesn't (and can't) know whether the email actually matched
      // an account.
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="animate-in mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand font-display text-lg font-bold text-brand-foreground">
          S
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll email you a link to choose a new one.
        </p>
      </div>

      <Card className="animate-in p-6">
        {submitted ? (
          <p className="text-sm text-foreground">
            If an account exists for <span className="font-medium">{email}</span>, a reset
            link is on its way. It works once and expires in an hour — check your spam
            folder if it doesn&apos;t show up in a minute or two.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
