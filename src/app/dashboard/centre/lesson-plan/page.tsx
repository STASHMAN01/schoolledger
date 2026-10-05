"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { addDays, mondayOf } from "@/lib/lessonPlan";

// Lesson plan (Dylan, 5 Oct 2026): the admin writes a topic for each class
// for each school day; the class teacher reads today's.

type Day = { date: string; topic: string; notes: string; status?: string; reviewNote?: string };
type PendingClass = { id: string; name: string; days: { date: string; topic: string; notes: string; by: string }[] };
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
  const [pending, setPending] = useState<PendingClass[]>([]);
  const [returning, setReturning] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [sent, setSent] = useState("");
  const planNext = useRef(false);

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
      if (planNext.current) {
        planNext.current = false;
        setEditing(true);
      }
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

  const loadPending = useCallback(async () => {
    if (!canEdit) return;
    const res = await fetch(`/api/organizations/${organizationId}/lesson-plans/pending`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPending(data.classes);
  }, [organizationId, canEdit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the review list on mount
    loadPending();
  }, [loadPending]);

  async function review(id: string, action: "approve" | "return") {
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/lesson-plans/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: id, action, note: returnNote }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not save your decision.");
      return;
    }
    setReturning(null);
    setReturnNote("");
    loadPending();
    load();
  }

  async function submitForReview(andNext = false) {
    if (!weekStart) return;
    setSaving(true);
    setError("");
    setSent("");
    const res = await fetch(`/api/organizations/${organizationId}/lesson-plans/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart,
        days: days.filter((d) => d.status !== "APPROVED").map((d) => ({ date: d.date, topic: d.topic, notes: d.notes })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send your plan.");
      return;
    }
    setSent(data.submitted > 0 ? "Sent to the office for review." : "Nothing to send.");
    if (andNext) {
      planNext.current = true;
      setWeekStart(addDays(weekStart, 7));
    } else {
      load();
    }
  }

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
            ? "What your class is learning today. You can also plan a week and send it to the office for review."
            : "What each class is learning each day. Teachers see their own class's plan."
        }
        actions={
          !editing && days.length > 0 ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              {canEdit ? "Edit this week" : "Plan this week"}
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

      {canEdit && pending.length > 0 && (
        <Card as="div" className="mb-4 border-brand p-4">
          <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Waiting for your review</h2>
          <div className="space-y-4">
            {pending.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">from {c.days[0]?.by}</span>
                </p>
                <ul className="mt-2 space-y-1">
                  {c.days.map((d) => (
                    <li key={d.date} className="text-sm text-foreground">
                      <span className="text-muted-foreground">{prettyDate(d.date)}:</span> {d.topic}
                      {d.notes && <span className="block text-xs text-muted-foreground">{d.notes}</span>}
                    </li>
                  ))}
                </ul>
                {returning === c.id ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      rows={2}
                      value={returnNote}
                      onChange={(e) => setReturnNote(e.target.value)}
                      placeholder="What should the teacher change?"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(c.id, "return")}>
                        Send back
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setReturning(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => review(c.id, "approve")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setReturning(c.id)}>
                      Send back…
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {sent && <p className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{sent}</p>}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}

      {isTeacher && !loading && todayPlan && (todayPlan.status === "APPROVED" || todayPlan.status === "NONE") && weekStart && days.some((d) => d.date === today) && (
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
        <div className="mb-3 space-y-2">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <Button variant="secondary" size="sm" disabled={editing || loading} onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ← Prev
            </Button>
            <span className="text-center text-sm text-muted-foreground">Week of {prettyDate(weekStart)}</span>
            <Button variant="secondary" size="sm" disabled={editing || loading} onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next →
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="jump-date" className="text-xs font-medium text-muted-foreground">
              Jump to a date
            </label>
            <Input
              id="jump-date"
              type="date"
              className="w-auto"
              disabled={editing || loading}
              value=""
              onChange={(e) => e.target.value && setWeekStart(mondayOf(e.target.value))}
            />
          </div>
          {isTeacher && (
            <p className="text-xs text-muted-foreground">
              You can plan as far ahead as you like: use Next, or jump to a date, then fill in the days and send.
            </p>
          )}
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
              {d.status === "PENDING" && (
                <Badge variant="neutral" className="mb-2">
                  Waiting for review
                </Badge>
              )}
              {d.status === "RETURNED" && (
                <p className="mb-2 rounded-lg border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
                  Sent back: {d.reviewNote || "please change and send again"}
                </p>
              )}
              {editing && (canEdit || d.status !== "APPROVED") ? (
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
            <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-border bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <Button onClick={canEdit ? save : () => submitForReview(false)} disabled={saving}>
                {saving ? (canEdit ? "Saving…" : "Sending…") : canEdit ? "Save week" : "Submit for review"}
              </Button>
              {!canEdit && (
                <Button variant="secondary" onClick={() => submitForReview(true)} disabled={saving}>
                  Submit and plan next week
                </Button>
              )}
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
