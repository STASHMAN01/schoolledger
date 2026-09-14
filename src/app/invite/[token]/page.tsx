"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button, Card, Input, Label } from "@/components/ui";

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
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  }
  if (notFound || !invite) {
    return (
      <main className="animate-in mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm text-danger">
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
    <main className="animate-in mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display mb-2 text-2xl font-semibold text-foreground">
        Join {invite.organizationName}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        You&apos;ve been invited as <strong>{invite.role}</strong> for {invite.email}.
      </p>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {signedInAsSomeoneElse ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as a different account. Log out first, then open this
          invite link again.
        </p>
      ) : invite.requiresNewAccount ? (
        <Card className="p-6">
          <form onSubmit={acceptAsNewAccount} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="invite-name">Your name</Label>
              <Input
                id="invite-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invite-password">Set a password</Label>
              <Input
                id="invite-password"
                required
                type="password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Joining..." : "Create account & join"}
            </Button>
          </form>
        </Card>
      ) : signedInAsMatchingUser ? (
        <Button onClick={acceptAsSignedIn} disabled={submitting}>
          {submitting ? "Joining..." : `Accept invite to ${invite.organizationName}`}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          An account with this email already exists. Please{" "}
          <a
            href={`/login?callbackUrl=${encodeURIComponent(`/invite/${params.token}`)}`}
            className="font-medium text-brand hover:underline"
          >
            log in
          </a>{" "}
          first, then this page will let you accept.
        </p>
      )}
    </main>
  );
}
