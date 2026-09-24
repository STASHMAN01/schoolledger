"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";

type Admin = { id: string; name: string; email: string; createdAt: string; isOwner: boolean };
type Invite = { id: string; email: string; expiresAt: string; createdAt: string };

export default function PlatformTeamPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/platform/team");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAdmins(data.admins);
      setInvites(data.invites);
    } else {
      setError(data.error ?? "Could not load platform team.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewLink(null);
    const res = await fetch("/api/platform/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create invite.");
      return;
    }
    setNewLink(`${window.location.origin}/platform/join/${data.token}`);
    setEmail("");
    await load();
  }

  async function revoke(inviteId: string) {
    await fetch(`/api/platform/team/${inviteId}/revoke`, { method: "POST" });
    await load();
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Platform team"
        description="People who can see the cross-school dashboard — separate from any school's own staff."
      />

      <Card className="mb-8 p-4">
        <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="platform-invite-email">Email to invite as platform admin</Label>
            <Input
              id="platform-invite-email"
              required
              type="email"
              className="w-64"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit">Create invite link</Button>
        </form>
      </Card>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {newLink && (
        <Card className="mb-6 bg-success-soft p-3 text-sm">
          <p className="mb-1 text-success">
            Invite created. Copy this link and send it yourself — it only works once and
            expires in 7 days:
          </p>
          <code className="break-all text-foreground">{newLink}</code>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <h2 className="font-display mb-2 text-lg font-medium text-foreground">Platform admins</h2>
          <Card className="mb-8 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-foreground">{a.name}</td>
                    <td className="px-3 py-2 text-foreground">{a.email}</td>
                    <td className="px-3 py-2">{a.isOwner && <Badge variant="brand">Owner</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <h2 className="font-display mb-2 text-lg font-medium text-foreground">Pending invites</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Expires</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 text-foreground">{i.email}</td>
                      <td className="px-3 py-2 text-foreground">
                        {new Date(i.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
