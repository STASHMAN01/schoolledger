"use client";

// Centre Management > Classes (Dylan 23 Sept): every class with its
// teacher(s), age group and how many children are in it; people who manage
// classes can add a class and set its age group here. Fees stay in
// Accounting > Classes; teachers are assigned in Settings > Team.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ageGroupLabel, monthsToYears as years } from "@/lib/ageGroup";

type ClassRow = {
  id: string;
  name: string;
  archived: boolean;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  childCount: number;
  teachers: { id: string; name: string }[];
};

// "2.5" years -> 30 months; blank -> null.
function toMonths(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : Math.round(n * 12);
}

export default function CentreClassesPage() {
  const { organizationId, permissions } = useOrg();
  const canManage = permissions.includes("MANAGE_CLASSES");
  const canAssign = permissions.includes("MANAGE_TEAM");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", minYears: "", maxYears: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/categories`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setClasses((data.categories as ClassRow[]).filter((c) => !c.archived));
      else setError(data.error ?? "Couldn't load classes.");
    } catch {
      setError("Couldn't load classes — check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm({ name: "", minYears: "", maxYears: "" });
    setAdding(true);
  }

  function startEdit(c: ClassRow) {
    setAdding(false);
    setEditingId(c.id);
    setForm({
      name: c.name,
      minYears: c.ageMinMonths == null ? "" : years(c.ageMinMonths),
      maxYears: c.ageMaxMonths == null ? "" : years(c.ageMaxMonths),
    });
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Give the class a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        ageMinMonths: toMonths(form.minYears),
        ageMaxMonths: toMonths(form.maxYears),
      };
      const res = await fetch(
        editingId
          ? `/api/organizations/${organizationId}/categories/${editingId}`
          : `/api/organizations/${organizationId}/categories`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "The class couldn't be saved.");
        return;
      }
      setAdding(false);
      setEditingId(null);
      await load();
    } catch {
      setError("The class couldn't be saved — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const formFields = (
    <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
      <div>
        <Label htmlFor="cls-name">Class name</Label>
        <Input id="cls-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="cls-min">Age from (years)</Label>
        <Input
          id="cls-min"
          type="number"
          min={0}
          max={20}
          step={0.5}
          value={form.minYears}
          onChange={(e) => setForm({ ...form, minYears: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="cls-max">Age to (years)</Label>
        <Input
          id="cls-max"
          type="number"
          min={0}
          max={20}
          step={0.5}
          value={form.maxYears}
          onChange={(e) => setForm({ ...form, maxYears: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setAdding(false);
            setEditingId(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="animate-in max-w-4xl">
      <PageHeader
        title="Classes"
        description="Each class with its teacher, age group and number of children."
        actions={
          canManage && !adding ? (
            <Button size="sm" onClick={startAdd}>
              Add class
            </Button>
          ) : undefined
        }
      />

      {adding && <Card as="div" className="mb-4 p-4">{formFields}</Card>}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description={canManage ? "Add your first class to start enrolling children." : "Ask the principal to add your classes."}
        />
      ) : (
        <Card as="div" className="divide-y divide-border">
          {classes.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="p-4">
                {formFields}
              </div>
            ) : (
              <div key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-foreground">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {ageGroupLabel(c.ageMinMonths, c.ageMaxMonths) ?? "No age group set"}
                  </p>
                </div>
                <div className="min-w-40 text-sm">
                  <p className="text-xs text-muted-foreground">Teacher</p>
                  {c.teachers.length > 0 ? (
                    <p className="text-foreground">{c.teachers.map((t) => t.name).join(", ")}</p>
                  ) : canAssign ? (
                    <Link href="/dashboard/accounting/settings/team" className="text-danger underline">
                      None — assign one
                    </Link>
                  ) : (
                    <p className="text-danger">None assigned</p>
                  )}
                </div>
                <Link
                  href="/dashboard/centre/enrolled"
                  className="w-20 text-center text-sm hover:text-brand"
                  title="See the children in Enrolled"
                >
                  <span className="font-display block text-xl font-semibold text-foreground">{c.childCount}</span>
                  <span className="text-xs text-muted-foreground">children</span>
                </Link>
                {canManage && (
                  <Button size="sm" variant="secondary" onClick={() => startEdit(c)}>
                    Edit
                  </Button>
                )}
              </div>
            )
          )}
        </Card>
      )}
    </div>
  );
}
