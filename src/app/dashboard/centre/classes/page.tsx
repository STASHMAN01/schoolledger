"use client";

// Centre Management > Classes (Dylan 23 Sept): every class with its
// teacher(s), age group and how many children are in it; people who manage
// classes can add a class and set its age group here. Fees stay in
// Accounting > Classes; teachers are assigned in Settings > Team.
//
// Class groups (Dylan, 15 Oct 2026): a class such as Aftercare or Homeschool
// can have grades (Gr R to Gr 12). A grade is only a label for the children
// in the class; the teacher, register, fees etc. all stay on the class.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ageGroupLabel, monthsToYears as years } from "@/lib/ageGroup";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { DeletionControl, type DeletionRequestInfo } from "@/components/DeletionControl";
import { GRADE_PRESET, sameGradeName } from "@/lib/classGroups";

type GradeRow = { id: string; name: string; archived: boolean; childCount: number };
type ClassRow = {
  id: string;
  name: string;
  archived: boolean;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  childCount: number;
  grades: GradeRow[];
  teachers: { id: string; name: string }[];
  deletionRequest: DeletionRequestInfo | null;
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
  // "Add class": a standalone class (today's form) or a group with grades.
  const [kind, setKind] = useState<"standalone" | "group">("standalone");
  const [presetOn, setPresetOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GRADE_PRESET.map((g) => [g, true]))
  );
  const [extraGrades, setExtraGrades] = useState<string[]>([]);
  const [extraInput, setExtraInput] = useState("");
  // Grades of an existing class: which class is getting a new grade, and
  // which grade is being renamed.
  const [addGradeFor, setAddGradeFor] = useState<string | null>(null);
  const [newGradeName, setNewGradeName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [gradeBusy, setGradeBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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
    setKind("standalone");
    setPresetOn(Object.fromEntries(GRADE_PRESET.map((g) => [g, true])));
    setExtraGrades([]);
    setExtraInput("");
    setAdding(true);
  }

  function addExtraGrade() {
    const name = extraInput.trim();
    if (!name) return;
    if ([...GRADE_PRESET, ...extraGrades].some((g) => sameGradeName(g, name))) {
      setError(`"${name}" is already in the list.`);
      return;
    }
    setError(null);
    setExtraGrades((prev) => [...prev, name]);
    setExtraInput("");
  }

  // One call to the grades endpoints; returns an error message or null.
  async function gradeCall(url: string, init: RequestInit): Promise<string | null> {
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      return res.ok ? null : (data.error ?? "That didn't work. Please try again.");
    } catch {
      return "That didn't work — check your connection and try again.";
    }
  }

  async function addGrades(c: ClassRow, names: string[]) {
    setGradeBusy(true);
    setError(null);
    let problem: string | null = null;
    for (const name of names) {
      problem = await gradeCall(`/api/organizations/${organizationId}/categories`, {
        method: "POST",
        body: JSON.stringify({ name, parentId: c.id }),
      });
      if (problem) break;
    }
    setGradeBusy(false);
    if (problem) setError(problem);
    else {
      setAddGradeFor(null);
      setNewGradeName("");
    }
    await load();
  }

  async function renameGrade() {
    if (!renaming) return;
    setGradeBusy(true);
    setError(null);
    const problem = await gradeCall(`/api/organizations/${organizationId}/categories/${renaming.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: renaming.name }),
    });
    setGradeBusy(false);
    if (problem) setError(problem);
    else setRenaming(null);
    await load();
  }

  async function toggleGradeArchive(g: GradeRow) {
    setGradeBusy(true);
    setError(null);
    const problem = await gradeCall(
      g.archived
        ? `/api/organizations/${organizationId}/categories/${g.id}/restore`
        : `/api/organizations/${organizationId}/categories/${g.id}`,
      { method: g.archived ? "POST" : "DELETE" }
    );
    setGradeBusy(false);
    if (problem) setError(problem);
    await load();
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
    const group = !editingId && kind === "group";
    const grades = group ? [...GRADE_PRESET.filter((g) => presetOn[g]), ...extraGrades] : [];
    if (group && grades.length === 0) {
      setError("Pick at least one grade, or choose Standalone class.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = group
        ? { name: form.name.trim(), grades }
        : {
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

  const showGroupForm = adding && !editingId && kind === "group";
  const saveButtons = (
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
  );
  const formFields = showGroupForm ? (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <Label htmlFor="cls-name">Class name</Label>
        <Input
          id="cls-name"
          placeholder="e.g. Aftercare"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-foreground">Grades in this class</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Untick the grades you don&apos;t need. Children are put in the class and carry one of these grades.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {GRADE_PRESET.map((g) => (
            <label key={g} className="flex min-h-9 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={presetOn[g] ?? false}
                onChange={(e) => setPresetOn((prev) => ({ ...prev, [g]: e.target.checked }))}
              />
              {g}
            </label>
          ))}
          {extraGrades.map((g) => (
            <span key={g} className="flex min-h-9 items-center gap-2 text-sm text-foreground">
              {g}
              <button
                type="button"
                onClick={() => setExtraGrades((prev) => prev.filter((x) => x !== g))}
                className="text-xs text-muted-foreground underline hover:text-foreground"
                aria-label={`Remove ${g}`}
              >
                remove
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex max-w-sm items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="cls-extra">Add another grade</Label>
            <Input
              id="cls-extra"
              placeholder="e.g. Playgroup"
              value={extraInput}
              onChange={(e) => setExtraInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExtraGrade();
                }
              }}
            />
          </div>
          <Button variant="secondary" onClick={addExtraGrade}>
            Add
          </Button>
        </div>
      </fieldset>
      {saveButtons}
    </div>
  ) : (
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
      {saveButtons}
    </div>
  );

  // The standalone / group choice, shown above the form when adding.
  const kindChoice = adding && !editingId && (
    <fieldset className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
      <legend className="sr-only">What kind of class?</legend>
      <label className="flex min-h-9 items-center gap-2 text-sm text-foreground">
        <input type="radio" name="cls-kind" checked={kind === "standalone"} onChange={() => setKind("standalone")} />
        Standalone class
      </label>
      <label className="flex min-h-9 items-center gap-2 text-sm text-foreground">
        <input type="radio" name="cls-kind" checked={kind === "group"} onChange={() => setKind("group")} />
        Group with grades (e.g. Aftercare, Gr R to Gr 12)
      </label>
    </fieldset>
  );

  return (
    <div className="animate-in max-w-4xl">
      {confirmDialog}
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

      {adding && (
        <Card as="div" className="mb-4 p-4">
          {kindChoice}
          {formFields}
        </Card>
      )}

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
              <div key={c.id}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
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
                    <Link href="/dashboard/centre/settings/team" className="text-danger underline">
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
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(c)}>
                      Edit
                    </Button>
                    {/* Same request-with-reason + admin-approval flow as
                        Accounting > Classes; a deleted class goes to
                        Settings > Trash and can be restored for 30 days. */}
                    <DeletionControl
                      organizationId={organizationId}
                      targetType="CATEGORY"
                      targetId={c.id}
                      targetLabel={c.name}
                      deletionRequest={c.deletionRequest}
                      isAdmin={permissions.includes("APPROVE_DELETION")}
                      onChanged={load}
                      confirm={confirm}
                    />
                  </div>
                )}
              </div>
              {(c.grades.length > 0 || (canManage && addGradeFor === c.id)) && (
                <div className="border-t border-dashed border-border px-4 pb-3 pt-2">
                  <p className="mb-1 text-xs text-muted-foreground">Grades</p>
                  <ul className="flex flex-col">
                    {c.grades.map((g) => (
                      <li key={g.id} className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {renaming?.id === g.id ? (
                          <>
                            <Input
                              aria-label={`New name for ${g.name}`}
                              className="w-40"
                              value={renaming.name}
                              onChange={(e) => setRenaming({ id: g.id, name: e.target.value })}
                            />
                            <Button size="sm" onClick={renameGrade} disabled={gradeBusy}>
                              Save
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setRenaming(null)} disabled={gradeBusy}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className={g.archived ? "text-muted-foreground line-through" : "text-foreground"}>
                              {g.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {g.archived ? "archived" : `${g.childCount} ${g.childCount === 1 ? "child" : "children"}`}
                            </span>
                            {canManage && (
                              <span className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setRenaming({ id: g.id, name: g.name })}
                                  disabled={gradeBusy}
                                  className="text-xs text-muted-foreground underline hover:text-foreground"
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleGradeArchive(g)}
                                  disabled={gradeBusy}
                                  className="text-xs text-muted-foreground underline hover:text-foreground"
                                >
                                  {g.archived ? "Restore" : "Archive"}
                                </button>
                              </span>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canManage && (
                <div className="px-4 pb-3">
                  {addGradeFor === c.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <Label htmlFor={`grade-new-${c.id}`}>Grade name</Label>
                        <Input
                          id={`grade-new-${c.id}`}
                          className="w-44"
                          placeholder="e.g. Gr 3"
                          value={newGradeName}
                          onChange={(e) => setNewGradeName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newGradeName.trim()) {
                              e.preventDefault();
                              addGrades(c, [newGradeName.trim()]);
                            }
                          }}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addGrades(c, [newGradeName.trim()])}
                        disabled={gradeBusy || !newGradeName.trim()}
                      >
                        Add grade
                      </Button>
                      {c.grades.length === 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={gradeBusy}
                          onClick={() =>
                            addGrades(
                              c,
                              GRADE_PRESET.filter((p) => !c.grades.some((g) => sameGradeName(g.name, p)))
                            )
                          }
                        >
                          Add Gr R to Gr 12
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAddGradeFor(null);
                          setNewGradeName("");
                        }}
                        disabled={gradeBusy}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddGradeFor(c.id);
                        setNewGradeName("");
                      }}
                      className="text-xs text-brand underline hover:brightness-90"
                    >
                      {c.grades.length === 0 ? "Add grades to this class" : "Add a grade"}
                    </button>
                  )}
                </div>
              )}
              </div>
            )
          )}
        </Card>
      )}
    </div>
  );
}
