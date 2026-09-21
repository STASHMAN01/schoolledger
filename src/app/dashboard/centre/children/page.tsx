"use client";

// Centre Management's own children list -- deliberately no money anywhere
// on this page (no fees, no balances, no payment history), unlike the
// Accounting children list. This is also, today, the only place a
// TEACHER or RECEPTIONIST can add a child at all: neither role gets
// VIEW_ACCOUNTING by default, so the older Accounting-side add-child form
// is unreachable to them. Full Admissions/Enrolled tiles (sortable,
// dashboard-tile-driven) are Phase 2 Session 2 -- this is a plain list to
// make Session 1's profile work (photos, consent, guardians) actually
// reachable and usable in the meantime.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg, useHasPermission } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";

type Category = { id: string; name: string; archived: boolean };
type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  category: { id: string; name: string };
};

export default function CentreChildrenPage() {
  const { organizationId } = useOrg();
  const canManage = useHasPermission("MANAGE_CHILDREN");
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [parentName, setParentName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [childrenRes, categoriesRes] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/children`),
      fetch(`/api/organizations/${organizationId}/categories`),
    ]);
    const childrenData = await childrenRes.json();
    const categoriesData = await categoriesRes.json();
    if (childrenRes.ok) setChildren(childrenData.children);
    if (categoriesRes.ok) {
      const active = (categoriesData.categories as Category[]).filter((c) => !c.archived);
      setCategories(active);
      if (active.length > 0) setCategoryId((prev) => prev || active[0].id);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        categoryId,
        parentName: parentName || "Not yet provided",
        enrollmentDate: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add that child.");
      return;
    }
    setFirstName("");
    setLastName("");
    setParentName("");
    setShowAdd(false);
    load();
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Children"
        description="Names and classes only -- fees and payments live under Accounting."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Cancel" : "Add child"}
            </Button>
          )
        }
      />

      {showAdd && (
        <Card as="div" className="mb-6 p-5">
          <form onSubmit={addChild} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <Label>First name</Label>
              <Input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="min-w-[140px]">
              <Label>Last name</Label>
              <Input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <Label>Class</Label>
              <Select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.length === 0 && <option value="">No classes yet</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label>Parent/guardian name</Label>
              <Input
                placeholder="Can fill in later"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving || !categoryId}>
              {saving ? "Adding…" : "Add child"}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </Card>
      )}

      <Card as="div" className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : children.length === 0 ? (
          <EmptyState
            title="No children yet"
            description="Add a child to start building their profile -- photo, birthdate, and guardians all live on their profile page."
          />
        ) : (
          <div className="divide-y divide-border">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/dashboard/centre/children/${child.id}`}
                className="transition-standard flex items-center justify-between gap-3 py-3 hover:bg-background"
              >
                <span className="font-medium text-foreground">
                  {child.firstName} {child.lastName}
                </span>
                <Badge variant="brand">{child.category.name}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
