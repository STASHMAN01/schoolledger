"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";

type Member = { membershipId: string; userId: string; name: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; expiresAt: string; createdAt: string };

const ROLES = ["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER"] as const;

export default function TeamPage() {
  const { organizationId, role } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("VIEWER");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/invites`);
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members);
      setInvites(data.invites);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewLink(null);
    const res = await fetch(`/api/organizations/${organizationId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create invite.");
      return;
    }
    setNewLink(`${window.location.origin}/invite/${data.token}`);
    setEmail("");
    await load();
  }

  async function revoke(inviteId: string) {
    await fetch(`/api/organizations/${organizationId}/invites/${inviteId}/revoke`, {
      method: "POST",
    });
    await load();
  }

  if (role !== "ADMIN") {
    return <p className="text-sm text-muted-foreground">Only an admin can manage the team.</p>;
  }

  return (
    <div className="animate-in">
      <PageHeader title="Team" />

      <Card className="mb-8 p-4">
        <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-email">Email to invite</Label>
            <Input
              id="invite-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Create invite link</Button>
        </form>
      </Card>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {newLink && (
        <Card className="mb-6 bg-success-soft p-3 text-sm">
          <p className="mb-1 text-success">
            Invite created. Copy this link and send it yourself (email-sending isn&apos;t
            wired up yet) — it only works once and expires in 7 days:
          </p>
          <code className="break-all text-foreground">{newLink}</code>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <h2 className="font-display mb-2 text-lg font-medium text-foreground">Members</h2>
          <Card className="mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.membershipId}>
                    <td className="px-3 py-2 text-foreground">{m.name}</td>
                    <td className="px-3 py-2 text-foreground">{m.email}</td>
                    <td className="px-3 py-2 text-foreground">{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <h2 className="font-display mb-2 text-lg font-medium text-foreground">
            Pending invites
          </h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Expires</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 text-foreground">{i.email}</td>
                      <td className="px-3 py-2 text-foreground">{i.role}</td>
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
