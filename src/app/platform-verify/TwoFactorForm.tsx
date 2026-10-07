"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

type Setup = { secret: string; qrDataUrl: string };

export function TwoFactorForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/platform/2fa/setup", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Couldn't start set-up. Reload the page to try again.");
        else setSetup(data as Setup);
      } catch {
        if (!cancelled) setError("Couldn't reach the server. Reload the page to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/platform/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That code didn't work.");
        return;
      }
      router.replace("/platform");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-2xl font-semibold text-foreground">Two-factor check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {enabled
          ? "Enter the 6-digit code from your authenticator app to open the platform dashboard."
          : "The platform dashboard can see every school, so it needs a code from an authenticator app as well as your password."}
      </p>

      <Card className="mt-6 p-6">
        {!enabled && (
          <div className="mb-6 space-y-3 text-sm text-foreground">
            <p>
              1. Open Google Authenticator, Microsoft Authenticator or 1Password on your phone and add an account by
              scanning this code.
            </p>
            {setup ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
                <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={220} height={220} />
                <p className="text-muted-foreground">
                  Can&apos;t scan? Enter this key instead:{" "}
                  <code className="break-all font-mono text-foreground">{setup.secret}</code>
                </p>
              </>
            ) : (
              !error && <p className="text-muted-foreground">Preparing your code…</p>
            )}
            <p>2. Type the 6-digit code the app shows.</p>
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 tracking-widest"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || (!enabled && !setup)}>
            {loading ? "Checking…" : enabled ? "Continue" : "Turn on two-factor"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
