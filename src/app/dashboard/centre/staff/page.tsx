"use client";

import { useCallback, useEffect, useState } from "react";
import { roleLabel } from "@/lib/permissions";
import { useOrg } from "../../OrgContext";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedClass: { id: string; name: string } | null;
};


export default function StaffPage() {
  const { organizationId, permissions } = useOrg();
  const canSee = permissions.includes("MANAGE_CLASSES") || permissions.includes("MANAGE_TEAM");
  const canManageTeam = permissions.includes("MANAGE_TEAM");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/staff`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStaff(data.staff);
    else setError(data.error ?? "Could not load staff.");
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    if (canSee) load();
  }, [canSee, load]);

  if (!canSee) {
    return (
      <div className="animate-in max-w-3xl">
        <PageHeader title="Staff" />
        <Card className="p-4 text-sm text-muted-foreground">Only the principal or an admin can view the staff list.</Card>
      </div>
    );
  }

  const teachers = staff.filter((s) => s.role === "TEACHER");
  const unassignedTeachers = teachers.filter((t) => !t.assignedClass).length;

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Staff"
        description="Everyone with a Crechely login, their role and the class they're assigned to."
        actions={
          canManageTeam ? (
            <LinkButton href="/dashboard/accounting/settings/team" size="sm" variant="secondary">
              Manage team
            </LinkButton>
          ) : undefined
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : staff.length === 0 ? (
        <EmptyState title="No staff yet" description="Invite your team from Settings → Team." />
      ) : (
        <>
          {unassignedTeachers > 0 && (
            <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {unassignedTeachers} {unassignedTeachers === 1 ? "teacher has" : "teachers have"} no class assigned yet
              {canManageTeam ? " — assign one in Settings → Team." : "."}
            </p>
          )}
          <Card className="divide-y divide-border">
            {staff.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                {s.assignedClass && <span className="text-xs text-muted-foreground">{s.assignedClass.name}</span>}
                <Badge variant={s.role === "TEACHER" ? "brand" : "neutral"}>{roleLabel(s.role)}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
