"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Label } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const check = useCallback(async () => {
    const res = await fetch(`/api/auth/reset-password/${params.token}`);
    setValid(res.ok);
    setLoading(false);
  }, [params.token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial token check on mount
    check();
  }, [check]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not reset your password.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="animate-in mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand font-display text-lg font-bold text-brand-foreground">
          T
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Choose a new password
        </h1>
      </div>

      <Card className="animate-in p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking your link…</p>
        ) : done ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Your password has been changed. Any other device you were signed in on has
              been signed out for safety.
            </p>
            <Button onClick={() => router.push("/login")}>Log in</Button>
          </div>
        ) : !valid ? (
          <p className="text-sm text-danger">
            This password reset link is invalid or has expired. Request a new one from the{" "}
            <Link href="/forgot-password" className="font-medium text-brand hover:underline">
              forgot password
            </Link>{" "}
            page.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 10 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                required
                minLength={10}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="mt-1 text-xs text-danger">Passwords don&apos;t match.</p>
              )}
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Saving…" : "Set new password"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
