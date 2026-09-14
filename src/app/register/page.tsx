"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, Input, Label, Select } from "@/components/ui";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand font-display text-lg font-bold text-brand-foreground">
          S
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Set up your school
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          14-day free trial, no card required to start.
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
              Don&apos;t see your country? Pick the closest currency for now —
              email us and we&apos;ll add it.
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
            <Input
              id="password"
              required
              type="password"
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 10 characters.
            </p>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
