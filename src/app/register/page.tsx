"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

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
      <h1 className="mb-2 text-2xl font-semibold">Set up your school</h1>
      <p className="mb-8 text-sm text-neutral-500">
        14-day free trial, no card required to start.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          School name
          <input
            required
            className="rounded border border-neutral-300 px-3 py-2"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Country
          <select
            className="rounded border border-neutral-300 px-3 py-2"
            value={country.code}
            onChange={(e) =>
              setCountry(COUNTRIES.find((c) => c.code === e.target.value)!)
            }
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            required
            className="rounded border border-neutral-300 px-3 py-2"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            required
            type="email"
            className="rounded border border-neutral-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            required
            type="password"
            minLength={10}
            className="rounded border border-neutral-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </main>
  );
}
