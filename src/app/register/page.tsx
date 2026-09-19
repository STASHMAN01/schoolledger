"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { Logo } from "@/components/Logo";
import { SUPPORT_EMAIL } from "@/lib/support";

const COUNTRIES = [
  { code: "ZA", currency: "ZAR", label: "South Africa" },
  { code: "ZW", currency: "USD", label: "Zimbabwe" },
  { code: "US", currency: "USD", label: "United States" },
  { code: "GB", currency: "GBP", label: "United Kingdom" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreedToTerms) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          countryCode: country.code,
          currencyCode: country.currency,
          adminName,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Account created — please log in.");
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
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
          Set up your school
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="text-success">✓</span> No card required — 14 days free.
        </p>
      </div>

      <Card className="animate-in p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="organizationName">School name</Label>
            <Input
              id="organizationName"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Select
              id="country"
              value={country.code}
              onChange={(e) =>
                setCountry(COUNTRIES.find((c) => c.code === e.target.value)!)
              }
              className="mt-1"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Don&apos;t see your country? Pick the closest currency for now
              and email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we&apos;ll add it.
            </p>
          </div>
          <div>
            <Label htmlFor="adminName">Your name</Label>
            <Input
              id="adminName"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1"
            />
          </div>
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
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 10 characters. Use the eye icon to check what you
              typed before submitting.
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong"
            />
            <span>
              I agree to Crechely&apos;s{" "}
              <Link href="/terms" className="text-brand hover:underline" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand hover:underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            What happens next: you&apos;re straight into your dashboard with a
            14-day free trial, no card needed. Add your school&apos;s details,
            then your categories and children, and you&apos;re tracking real
            payments the same day.
          </p>
        </form>
      </Card>
    </main>
  );
}
