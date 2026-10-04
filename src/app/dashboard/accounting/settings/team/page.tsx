"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../../OrgContext";
import { Badge, Button, Card, Disclosure, Input, Label, PageHeader, Select } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import {
  ALL_PERMISSIONS,
  PERMISSION_INFO,
  ROLE_DEFAULT_PERMISSIONS,
  roleLabel,
} from "@/lib/permissions";
import type { Permission, Role } from "@prisma/client";
import { formatDateZA } from "@/lib/date";

// Mirrors MAX_PROFILES_PER_ORG in src/lib/profiles.ts (the server enforces it).
const MAX_PROFILES = 10;

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string | null;
  // Set only for class profiles (shared tablets), which have no email.
  username: string | null;
  isProfile: boolean;
  role: Role;
  assignedCategoryId: string | null;
  permissions: Permission[];
};
type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};
type Category = { id: string; name: string; archived: boolean };

const ROLES = ["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER", "TEACHER", "RECEPTIONIST"] as const;

// One line per role, shown on hover over its badge — what it grants BY
// DEFAULT (an individual member's actual access may have been adjusted
// from this, see their own "Customize access" panel below).
const ROLE_SUMMARY: Record<Role, string> = {
  ADMIN: "Full access — sees and can do everything, always. Not editable.",
  ACCOUNTANT: "Accounting only: money, payments, children, classes, events, reminders.",
  MANAGER: "Organizes children/classes in both modes, but can't see money.",
  VIEWER:
    "Read-only in Accounting, for a business partner or outside accountant who should only look. No money by default.",
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
  const { confirm, dialog } = useConfirmDialog();

  // "Invite by email" (the original flow) or "Create profile": a username +
  // password login for a classroom tablet, no email needed (Dylan, 4 Oct 2026).
  const [mode, setMode] = useState<"email" | "profile">("email");
  const [profileName, setProfileName] = useState("");
  const [profileClass, setProfileClass] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [newProfile, setNewProfile] = useState<{
    name: string;
    username: string;
  } | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  // No default role (Dylan, 24 Sept): it used to start on VIEWER, so a
  // teacher invited in a hurry ended up read-only in Accounting.
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number] | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    const [invitesRes, categoriesRes] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/invites`),
      fetch(`/api/organizations/${organizationId}/categories`),
    ]);
    const [invitesData, categoriesData] = await Promise.all([
      invitesRes.json().catch(() => ({})),
      categoriesRes.json().catch(() => ({})),
    ]);
    if (invitesRes.ok) {
      setMembers(invitesData.members);
      setInvites(invitesData.invites);
    } else {
      setError(invitesData.error ?? "Couldn't load your team.");
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
    if (!inviteRole) {
      setError("Choose a role for this person first.");
      return;
    }
    const res = await fetch(`/api/organizations/${organizationId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create invite.");
      return;
    }
    setNewLink(`${window.location.origin}/invite/${data.token}`);
    setEmail("");
    await load();
  }

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setNewProfile(null);
    if (!profileClass) {
      setError("Choose the class this tablet is for.");
      return;
    }
    if (profilePassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    const res = await fetch(`/api/organizations/${organizationId}/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profileName,
        categoryId: profileClass,
        password: profilePassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create the profile.");
      return;
    }
    setNewProfile({ name: data.profile.name, username: data.profile.username });
    setProfileName("");
    setProfileClass("");
    setProfilePassword("");
    await load();
  }

  async function profileAction(member: Member, action: "reset-password" | "sign-out" | "remove") {
    setError(null);
    setNotice(null);
    if (action === "remove") {
      const ok = await confirm({
        title: `Remove ${member.name}?`,
        description:
          "Any tablet using this profile is signed out straight away and can't log in again. Attendance and reports it already saved stay.",
        confirmLabel: "Remove profile",
        variant: "danger",
      });
      if (!ok) return;
    }
    if (action === "reset-password" && resetPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    const url = `/api/organizations/${organizationId}/profiles/${member.membershipId}`;
    const res =
      action === "remove"
        ? await fetch(url, { method: "DELETE" })
        : await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              action === "reset-password" ? { action, password: resetPassword } : { action },
            ),
          });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "That didn't work. Please try again.");
      return;
    }
    if (action === "reset-password") {
      setResetFor(null);
      setResetPassword("");
      setNotice(`${member.name}'s password was changed. Tablets using it need to log in again.`);
    } else if (action === "sign-out") {
      setNotice(`${member.name} was signed out on every tablet.`);
    } else {
      setNotice(`${member.name} was removed.`);
      await load();
    }
  }

  async function revoke(inviteId: string) {
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/invites/${inviteId}/revoke`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "That invite couldn't be cancelled. Please try again.");
      return;
    }
    await load();
  }

  async function updateMember(
    membershipId: string,
    body: {
      role?: Role;
      assignedCategoryId?: string | null;
      effectivePermissions?: Permission[];
    },
  ) {
    const res = await fetch(`/api/organizations/${organizationId}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.membershipId === membershipId ? { ...m, ...data.member } : m)),
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
    updateMember(member.membershipId, {
      assignedCategoryId: assignedCategoryId || null,
    });
  }

  function togglePermission(member: Member, permission: Permission, granted: boolean) {
    const next = granted
      ? [...member.permissions, permission]
      : member.permissions.filter((p) => p !== permission);
    updateMember(member.membershipId, { effectivePermissions: next });
  }

  const profileCount = members.filter((m) => m.isProfile).length;

  if (!canManageTeam) {
    return <p className="text-sm text-muted-foreground">Only an admin can manage the team.</p>;
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Team"
        description="Roles set what someone can see and do by default. Open “Customize access” on any person to grant or revoke something just for them."
      />

      {dialog}
      <div className="mb-3 flex gap-2" role="tablist" aria-label="How to add someone">
        <Button
          type="button"
          role="tab"
          aria-selected={mode === "email"}
          variant={mode === "email" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMode("email")}
        >
          Invite by email
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={mode === "profile"}
          variant={mode === "profile" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMode("profile")}
        >
          Create profile (no email)
        </Button>
      </div>

      {mode === "profile" ? (
        <Card className="mb-8 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            For a classroom tablet: logs in with a username and password, no email needed. A profile
            is always a Teacher limited to one class, and can never see money, the team, billing,
            settings, exports or the activity log. {profileCount} of {MAX_PROFILES} used.
          </p>
          <form onSubmit={createProfile} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="profile-name">Profile name</Label>
              <Input
                id="profile-name"
                required
                maxLength={60}
                placeholder="e.g. Butterfly"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="profile-class">Class</Label>
              <Select
                id="profile-class"
                required
                value={profileClass}
                onChange={(e) => setProfileClass(e.target.value)}
              >
                <option value="" disabled>
                  Choose a class…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="profile-password">Password (10+ characters)</Label>
              <PasswordInput
                id="profile-password"
                required
                minLength={10}
                autoComplete="new-password"
                value={profilePassword}
                onChange={(e) => setProfilePassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={profileCount >= MAX_PROFILES}>
              Create profile
            </Button>
          </form>
        </Card>
      ) : (
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
                required
                onChange={(e) => setInviteRole(e.target.value as (typeof ROLES)[number] | "")}
                title={
                  inviteRole ? ROLE_SUMMARY[inviteRole] : "Choose what this person can see and do"
                }
              >
                <option value="" disabled>
                  Choose a role…
                </option>
                {ROLES.map((r) => (
                  <option key={r} value={r} title={ROLE_SUMMARY[r]}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Create invite link</Button>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 text-sm text-success">{notice}</p>}
      {newProfile && (
        <Card className="mb-6 bg-success-soft p-3 text-sm">
          <p className="mb-1 text-success">
            Profile &ldquo;{newProfile.name}&rdquo; created. On the tablet, log in with:
          </p>
          <p className="text-foreground">
            Username: <code className="font-semibold">{newProfile.username}</code>
          </p>
          <p className="mt-1 text-muted-foreground">
            and the password you just set. Write it down now: it can&apos;t be shown again, only
            reset.
          </p>
        </Card>
      )}
      {newLink && (
        <Card className="mb-6 bg-success-soft p-3 text-sm">
          <p className="mb-1 text-success">
            Invite created. Copy this link and send it yourself (email-sending isn&apos;t wired up
            yet) — it only works once and expires in 7 days:
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
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {m.name}
                      {m.isProfile && <Badge variant="accent">Profile</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.isProfile ? `Username: ${m.username ?? ""}` : m.email}
                    </p>
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
                    {m.isProfile ? (
                      <span className="text-sm text-muted-foreground">Teacher (class tablet)</span>
                    ) : (
                      <Select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value as Role)}
                        title={ROLE_SUMMARY[m.role]}
                        disabled={m.role === "ADMIN"}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} title={ROLE_SUMMARY[r]}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>

                {m.isProfile ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Can take attendance, manage children and write reports for its class only.
                    </p>
                    {resetFor === m.membershipId ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`reset-${m.membershipId}`}>New password</Label>
                          <PasswordInput
                            id={`reset-${m.membershipId}`}
                            minLength={10}
                            autoComplete="new-password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                          />
                        </div>
                        <Button size="sm" onClick={() => profileAction(m, "reset-password")}>
                          Save password
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setResetFor(null);
                            setResetPassword("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setResetFor(m.membershipId);
                            setResetPassword("");
                          }}
                        >
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => profileAction(m, "sign-out")}
                        >
                          Sign out everywhere
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => profileAction(m, "remove")}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ) : m.role === "ADMIN" ? (
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
                          const isDefault =
                            ROLE_DEFAULT_PERMISSIONS[m.role as Exclude<Role, "ADMIN">].includes(p);
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

          <h2 className="font-display mb-2 text-lg font-medium text-foreground">Pending invites</h2>
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
                      <td
                        className="px-3 py-2 text-foreground"
                        title={ROLE_SUMMARY[i.role as Role]}
                      >
                        {roleLabel(i.role)}
                      </td>
                      <td className="px-3 py-2 text-foreground">{formatDateZA(i.expiresAt)}</td>
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
