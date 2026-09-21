"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../../OrgContext";
import { Button, Card, Disclosure, Input, Label, PageHeader, Select } from "@/components/ui";
import { ALL_PERMISSIONS, PERMISSION_INFO, ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import type { Permission, Role } from "@prisma/client";

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  assignedCategoryId: string | null;
  permissions: Permission[];
};
type Invite = { id: string; email: string; role: string; expiresAt: string; createdAt: string };
type Category = { id: string; name: string; archived: boolean };

const ROLES = ["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER", "TEACHER", "RECEPTIONIST"] as const;

// One line per role, shown on hover over its badge — what it grants BY
// DEFAULT (an individual member's actual access may have been adjusted
// from this, see their own "Customize access" panel below).
const ROLE_SUMMARY: Record<Role, string> = {
  ADMIN: "Full access — sees and can do everything, always. Not editable.",
  ACCOUNTANT: "Accounting only: money, payments, children, classes, events, reminders.",
  MANAGER: "Organizes children/classes in both modes, but can't see money.",
  VIEWER: "Read-only in Accounting. No money by default.",
  TEACHER: "Centre Management only, limited to their one assigned class.",
  RECEPTIONIST: "Centre Management only, can add children.",
};

export default function TeamPage() {
  const { organizationId, permissions } = useOrg();
  const canManageTeam = permissions.includes("MANAGE_TEAM");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("VIEWER");

  const load = useCallback(async () => {
    setLoading(true);
    const [invitesRes, categoriesRes] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/invites`),
      fetch(`/api/organizations/${organizationId}/categories`),
    ]);
    const [invitesData, categoriesData] = await Promise.all([
      invitesRes.json(),
      categoriesRes.json(),
    ]);
    if (invitesRes.ok) {
      setMembers(invitesData.members);
      setInvites(invitesData.invites);
    }
    if (categoriesRes.ok) {
      setCategories(categoriesData.categories.filter((c: Category) => !c.archived));
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

  async function updateMember(
    membershipId: string,
    body: { role?: Role; assignedCategoryId?: string | null; effectivePermissions?: Permission[] }
  ) {
    const res = await fetch(`/api/organizations/${organizationId}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.membershipId === membershipId ? { ...m, ...data.member } : m))
      );
    } else {
      setError(data.error ?? "Could not update this person.");
    }
  }

  function changeRole(member: Member, role: Role) {
    // Switching role resets to that role's defaults (the server drops
    // stale overrides on a role change too) -- if this specific person
    // needs adjustments from the new role's defaults, use "Customize
    // access" afterward.
    updateMember(member.membershipId, { role });
  }

  function changeClass(member: Member, assignedCategoryId: string) {
    updateMember(member.membershipId, { assignedCategoryId: assignedCategoryId || null });
  }

  function togglePermission(member: Member, permission: Permission, granted: boolean) {
    const next = granted
      ? [...member.permissions, permission]
      : member.permissions.filter((p) => p !== permission);
    updateMember(member.membershipId, { effectivePermissions: next });
  }

  if (!canManageTeam) {
    return <p className="text-sm text-muted-foreground">Only an admin can manage the team.</p>;
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Team"
        description="Roles set what someone can see and do by default. Open “Customize access” on any person to grant or revoke something just for them."
      />

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
              title={ROLE_SUMMARY[inviteRole]}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} title={ROLE_SUMMARY[r]}>
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
          <div className="mb-8 flex flex-col gap-3">
            {members.map((m) => (
              <Card key={m.membershipId} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {m.role === "TEACHER" && (
                      <Select
                        value={m.assignedCategoryId ?? ""}
                        onChange={(e) => changeClass(m, e.target.value)}
                        title="The one class this teacher is limited to"
                      >
                        <option value="">No class assigned</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Select
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value as Role)}
                      title={ROLE_SUMMARY[m.role]}
                      disabled={m.role === "ADMIN"}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} title={ROLE_SUMMARY[r]}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {m.role === "ADMIN" ? (
                  <p className="mt-3 text-xs text-muted-foreground" title={ROLE_SUMMARY.ADMIN}>
                    Admin — always full access, not customizable.
                  </p>
                ) : (
                  <div className="mt-3">
                    <Disclosure
                      title="Customize access"
                      description={`Currently: ${m.permissions.length} of ${ALL_PERMISSIONS.length} permissions`}
                    >
                      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                        {ALL_PERMISSIONS.map((p) => {
                          const checked = m.permissions.includes(p);
                          const isDefault = ROLE_DEFAULT_PERMISSIONS[
                            m.role as Exclude<Role, "ADMIN">
                          ].includes(p);
                          return (
                            <label
                              key={p}
                              className="flex items-start gap-2 text-sm text-foreground"
                              title={PERMISSION_INFO[p].description}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={(e) => togglePermission(m, p, e.target.checked)}
                              />
                              <span>
                                {PERMISSION_INFO[p].label}
                                {checked !== isDefault && (
                                  <span className="ml-1 text-xs text-accent">
                                    ({checked ? "granted" : "revoked"} for {m.name.split(" ")[0]})
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </Disclosure>
                  </div>
                )}
              </Card>
            ))}
          </div>

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
                      <td className="px-3 py-2 text-foreground" title={ROLE_SUMMARY[i.role as Role]}>
                        {i.role}
                      </td>
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
