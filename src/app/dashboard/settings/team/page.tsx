"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";

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
    return <p className="text-sm text-neutral-500">Only an admin can manage the team.</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Team</h1>

      <form
        onSubmit={sendInvite}
        className="mb-8 flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Email to invite
          <input
            required
            type="email"
            className="rounded border border-neutral-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Role
          <select
            className="rounded border border-neutral-300 px-3 py-2"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as (typeof ROLES)[number])}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
          Create invite link
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {newLink && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p className="mb-1 text-green-800">
            Invite created. Copy this link and send it yourself (email-sending isn&apos;t
            wired up yet) — it only works once and expires in 7 days:
          </p>
          <code className="break-all">{newLink}</code>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <>
          <h2 className="mb-2 text-lg font-medium">Members</h2>
          <table className="mb-8 w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.membershipId} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{m.name}</td>
                  <td className="px-3 py-2">{m.email}</td>
                  <td className="px-3 py-2">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="mb-2 text-lg font-medium">Pending invites</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-neutral-500">No pending invites.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{i.email}</td>
                    <td className="px-3 py-2">{i.role}</td>
                    <td className="px-3 py-2">
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => revoke(i.id)}
                        className="text-xs text-neutral-500 underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
