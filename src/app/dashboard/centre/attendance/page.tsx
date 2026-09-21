"use client";

// Take the register -- Phase 3 Session 1 (Daily running, see docs/PLAN.md).
// Deliberately no date picker or history browsing in this first pass:
// "a teacher can take the register on a phone in under a minute" means
// today, one class, tap-to-flip-absent, one Save. A TEACHER never sees a
// class picker (the API forces their own assignedCategoryId); anyone else
// with MANAGE_ATTENDANCE picks a class first.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, PageHeader, Select } from "@/components/ui";

type Category = { id: string; name: string; archived: boolean };
type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: "PRESENT" | "ABSENT" | null;
};
type Status = "PRESENT" | "ABSENT";

function todayLocal(): string {
  // yyyy-mm-dd in the browser's own local time, not UTC -- see the
  // comment on attendanceRegisterSchema in validation.ts for why the
  // server never guesses "today" itself.
  return new Date().toLocaleDateString("en-CA");
}

export default function AttendancePage() {
  const { organizationId, role } = useOrg();
  const isTeacher = role === "TEACHER";
  const [date] = useState(todayLocal);

  const [categories, setCategories] = useState<Category[]>([]);
  const [pickedCategoryId, setPickedCategoryId] = useState("");
  const [loadedCategory, setLoadedCategory] = useState<{ id: string; name: string } | null>(null);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`/api/organizations/${organizationId}/categories`);
      const data = await res.json();
      if (res.ok) {
        const active = (data.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- picking a sensible default once the list loads
        setPickedCategoryId((prev) => prev || active[0]?.id || "");
      }
    })();
  }, [organizationId, isTeacher]);

  const loadRegister = useCallback(
    async (categoryId?: string) => {
      setLoading(true);
      setError("");
      setSavedAt(null);
      const params = new URLSearchParams({ date });
      if (categoryId) params.set("categoryId", categoryId);
      const res = await fetch(
        `/api/organizations/${organizationId}/attendance/register?${params.toString()}`
      );
      const data = await res.json();
      if (res.ok) {
        setLoadedCategory(data.category);
        setChildren(data.children);
        const initial: Record<string, Status> = {};
        for (const c of data.children as ChildRow[]) initial[c.id] = c.status ?? "PRESENT";
        setDraft(initial);
      } else {
        setLoadedCategory(null);
        setChildren([]);
        setError(data.error ?? "Could not load the register.");
      }
      setLoading(false);
    },
    [organizationId, date]
  );

  useEffect(() => {
    if (isTeacher) {
      loadRegister();
    } else if (pickedCategoryId) {
      loadRegister(pickedCategoryId);
    } else {
      setLoading(false);
    }
  }, [isTeacher, pickedCategoryId, loadRegister]);

  function toggle(childId: string) {
    setSavedAt(null);
    setDraft((prev) => ({
      ...prev,
      [childId]: prev[childId] === "ABSENT" ? "PRESENT" : "ABSENT",
    }));
  }

  async function save() {
    if (!loadedCategory) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/attendance/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: loadedCategory.id,
        date,
        records: children.map((c) => ({ childId: c.id, status: draft[c.id] ?? "PRESENT" })),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSavedAt(Date.now());
    } else {
      setError(data.error ?? "Could not save the register.");
    }
    setSaving(false);
  }

  const presentCount = children.filter((c) => draft[c.id] !== "ABSENT").length;
  const absentCount = children.length - presentCount;

  return (
    <div className="animate-in">
      <PageHeader
        title="Attendance"
        description={`Today, ${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}. Everyone defaults to Present -- tap a child to mark them Absent.`}
        actions={
          <Link
            href="/dashboard/centre/attendance/absent"
            className="text-sm font-medium text-brand hover:underline"
          >
            Absent & notify parents →
          </Link>
        }
      />

      {!isTeacher && (
        <Card as="div" className="mb-4 p-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
          <Select
            value={pickedCategoryId}
            onChange={(e) => setPickedCategoryId(e.target.value)}
            className="max-w-xs"
          >
            {categories.length === 0 && <option value="">No classes yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !loadedCategory ? (
        isTeacher ? (
          <EmptyState
            title="No class assigned yet"
            description="Ask an admin to assign you to a class from Settings → Team."
          />
        ) : (
          <EmptyState title="No class selected" description="Pick a class above to take its register." />
        )
      ) : children.length === 0 ? (
        <EmptyState
          title="No children in this class"
          description={`${loadedCategory.name} has no currently-enrolled children yet.`}
        />
      ) : (
        <>
          <Card as="div" className="mb-4 flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {loadedCategory.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {presentCount} present, {absentCount} absent, {children.length} total
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savedAt && <span className="text-xs text-success">Saved</span>}
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? "Saving…" : "Save register"}
              </Button>
            </div>
          </Card>

          <Card as="div" className="p-2">
            <div className="divide-y divide-border">
              {children.map((c) => {
                const status = draft[c.id] ?? "PRESENT";
                const absent = status === "ABSENT";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="transition-standard flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-background"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {c.firstName} {c.lastName}
                    </span>
                    <Badge variant={absent ? "danger" : "success"}>
                      {absent ? "Absent" : "Present"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
