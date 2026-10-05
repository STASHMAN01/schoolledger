"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { addDays } from "@/lib/lessonPlan";

// Lesson plan (Dylan, 5 Oct 2026): the admin writes a topic for each class
// for each school day; the class teacher reads today's.

type Day = { date: string; topic: string; notes: string };
type Category = { id: string; name: string; archived: boolean };

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function prettyDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function LessonPlanPage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canEdit = !isTeacher && permissions.includes("MANAGE_CLASSES");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [today, setToday] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`/api/organizations/${organizationId}/categories`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const active = (data.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        setCategoryId((prev) => prev || active[0]?.id || "");
        if (active.length === 0) setLoading(false);
      }
    })();
  }, [organizationId, isTeacher]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setEditing(false);
    const qs = new URLSearchParams();
    if (!isTeacher) qs.set("categoryId", categoryId);
    if (weekStart) qs.set("weekStart", weekStart);
    const res = await fetch(`/api/organizations/${organizationId}/lesson-plans?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDays(data.days);
      setClassName(data.category.name);
      setToday(data.today);
      if (!weekStart) setWeekStart(data.weekStart);
    } else {
      setDays([]);
      setError(data.error ?? "Could not load the lesson plan.");
    }
    setLoading(false);
  }, [organizationId, isTeacher, categoryId, weekStart]);

  useEffect(() => {
    if (!isTeacher && !categoryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the class or week changes
    load();
  }, [isTeacher, categoryId, load]);

  function update(date: string, patch: Partial<Day>) {
    setDays(days.map((d) => (d.date === date ? { ...d, ...patch } : d)));
  }

  async function save() {
    if (!weekStart) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/lesson-plans`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, weekStart, days }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save the lesson plan.");
      return;
    }
    load();
  }

  const todayPlan = days.find((d) => d.date === today);

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Lesson plan"
        description={
          isTeacher
            ? "What your class is learning today, and the rest of the week."
            : "What each class is learning each day. Teachers see their own class's plan."
        }
        actions={
          canEdit && !editing && days.length > 0 ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit this week
            </Button>
          ) : undefined
        }
      />

      {!isTeacher && (
        <Card as="div" className="mb-4 p-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
            }}
            className="max-w-xs"
            disabled={editing}
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
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}

      {isTeacher && !loading && todayPlan && weekStart && days.some((d) => d.date === today) && (
        <Card as="div" className="mb-4 border-brand p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">Today · {className}</p>
          {todayPlan.topic ? (
            <>
              <h2 className="font-display mt-1 text-lg font-semibold text-foreground">{todayPlan.topic}</h2>
              {todayPlan.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{todayPlan.notes}</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No plan for today.</p>
          )}
        </Card>
      )}

      {weekStart && (
        <div className="mb-3 flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={editing || loading} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← Previous week
          </Button>
          <span className="text-sm text-muted-foreground">Week of {prettyDate(weekStart)}</span>
          <Button variant="secondary" size="sm" disabled={editing || loading} onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next week →
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {days.map((d, i) => (
            <Card as="div" key={d.date} className={`p-4 ${d.date === today ? "border-brand" : ""}`}>
              <h2 className="font-display mb-2 text-sm font-semibold text-foreground">
                {DAY_NAMES[i]} · {prettyDate(d.date)}
                {d.date === today && <span className="ml-2 text-xs font-normal text-brand">Today</span>}
              </h2>
              {editing ? (
                <div className="space-y-2">
                  <Input
                    value={d.topic}
                    maxLength={200}
                    placeholder="Topic, e.g. Colours and shapes"
                    onChange={(e) => update(d.date, { topic: e.target.value })}
                    aria-label={`${DAY_NAMES[i]} topic`}
                  />
                  <Textarea
                    value={d.notes}
                    rows={2}
                    maxLength={5000}
                    placeholder="Notes for the teacher (optional)"
                    onChange={(e) => update(d.date, { notes: e.target.value })}
                    aria-label={`${DAY_NAMES[i]} notes`}
                  />
                </div>
              ) : d.topic ? (
                <>
                  <p className="text-sm font-medium text-foreground">{d.topic}</p>
                  {d.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{d.notes}</p>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No plan for this day.</p>
              )}
            </Card>
          ))}
          {editing && (
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save week"}
              </Button>
              <Button variant="secondary" onClick={load} disabled={saving}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
