"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type InviteInfo = {
  organizationName: string;
  email: string;
  role: string;
  requiresNewAccount: boolean;
};

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invites/${params.token}`);
    const data = await res.json();
    if (res.ok) setInvite(data);
    else setNotFound(true);
    setLoading(false);
  }, [params.token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function acceptAsSignedIn() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not accept this invite.");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
  }

  async function acceptAsNewAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, name, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not accept this invite.");
      setSubmitting(false);
      return;
    }
    const result = await signIn("credentials", {
      email: data.email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Account created — please log in.");
      router.push("/login");
      return;
    }
    router.push("/dashboard");
  }

  if (loading || sessionStatus === "loading") {
    return <p className="p-8 text-sm text-neutral-500">Loading...</p>;
  }
  if (notFound || !invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm text-red-600">
          This invite link is invalid or has expired. Ask the school admin to send a
          new one.
        </p>
      </main>
    );
  }

  const signedInAsMatchingUser =
    session?.user?.email?.toLowerCase() === invite.email.toLowerCase();
  const signedInAsSomeoneElse = !!session?.user && !signedInAsMatchingUser;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Join {invite.organizationName}</h1>
      <p className="mb-8 text-sm text-neutral-500">
        You&apos;ve been invited as <strong>{invite.role}</strong> for {invite.email}.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {signedInAsSomeoneElse ? (
        <p className="text-sm text-neutral-600">
          You&apos;re signed in as a different account. Log out first, then open this
          invite link again.
        </p>
      ) : invite.requiresNewAccount ? (
        <form onSubmit={acceptAsNewAccount} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Set a password
            <input
              required
              type="password"
              minLength={10}
              className="rounded border border-neutral-300 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Joining..." : "Create account & join"}
          </button>
        </form>
      ) : signedInAsMatchingUser ? (
        <button
          onClick={acceptAsSignedIn}
          disabled={submitting}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Joining..." : `Accept invite to ${invite.organizationName}`}
        </button>
      ) : (
        <p className="text-sm text-neutral-600">
          An account with this email already exists. Please{" "}
          <a
            href={`/login?callbackUrl=${encodeURIComponent(`/invite/${params.token}`)}`}
            className="underline"
          >
            log in
          </a>{" "}
          first, then this page will let you accept.
        </p>
      )}
    </main>
  );
}
