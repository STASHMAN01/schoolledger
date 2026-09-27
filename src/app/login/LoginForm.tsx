"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { Logo } from "@/components/Logo";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only fall back to the platform-admin-aware default (see
  // /api/auth/landing) when nothing else asked for a specific page —
  // an invite link or a "please sign in again" bounce always wins.
  const explicitCallbackUrl = searchParams.get("callbackUrl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        // Deliberately vague: never say "wrong password" vs "no such user".
        setError("Incorrect email or password.");
        return;
      }
      if (explicitCallbackUrl) {
        router.push(explicitCallbackUrl);
        return;
      }
      // No explicit destination was requested, so ask where this user's
      // default landing page is (a platform admin goes to /platform
      // instead of /dashboard) rather than assuming /dashboard.
      try {
        const res = await fetch("/api/auth/landing");
        const data = await res.json().catch(() => ({}));
        router.push(data.redirectTo || "/dashboard");
      } catch {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="animate-in mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-4">
          <Logo variant="icon" size={44} className="rounded-xl" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to manage your school&apos;s payments and statements.
        </p>
      </div>

      <Card className="animate-in p-6">
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
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-brand hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Set up your school
        </Link>
      </p>
    </main>
  );
}
