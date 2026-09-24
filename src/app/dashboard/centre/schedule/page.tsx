"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { SCHOOL_DAYS, isoWeekday, scheduleItemProblem, sortScheduleItems } from "@/lib/schedule";

type Category = { id: string; name: string; archived: boolean };

type Row = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  activity: string;
  notes: string;
};

type ApiItem = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  activity: string;
  notes: string | null;
};

let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;

function toRows(items: ApiItem[]): Row[] {
  return items.map((i) => ({
    key: i.id,
    dayOfWeek: i.dayOfWeek,
    startTime: i.startTime,
    endTime: i.endTime ?? "",
    activity: i.activity,
    notes: i.notes ?? "",
  }));
}

export default function SchedulePage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canEdit = permissions.includes("MANAGE_CLASSES");
  const today = isoWeekday(new Date());

  const [categories, setCategories] = useState<Category[]>([]);
  const [pickedCategoryId, setPickedCategoryId] = useState("");
  const [loadedCategory, setLoadedCategory] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<ApiItem[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
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
        setPickedCategoryId((prev) => prev || active[0]?.id || "");
        if (active.length === 0) setLoading(false);
      }
    })();
  }, [organizationId, isTeacher]);

  const load = useCallback(
    async (categoryId?: string) => {
      setLoading(true);
      setError("");
      setEditing(false);
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
      const res = await fetch(`/api/organizations/${organizationId}/schedule${qs}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLoadedCategory(data.category);
        setItems(data.items);
        // Opening their own class's timetable clears a teacher's
        // "timetable changed" to-do. Fire-and-forget.
        if (isTeacher) {
          fetch(`/api/organizations/${organizationId}/schedule/acknowledge`, { method: "POST" }).catch(() => {});
        }
      } else {
        setLoadedCategory(null);
        setItems([]);
        setError(data.error ?? "Could not load the timetable.");
      }
      setLoading(false);
    },
    [organizationId, isTeacher]
  );

  useEffect(() => {
    if (!isTeacher && !pickedCategoryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load + reload when the class changes
    load(isTeacher ? undefined : pickedCategoryId);
  }, [isTeacher, pickedCategoryId, load]);

  function startEditing() {
    setRows(toRows(items));
    setError("");
    setEditing(true);
  }

  function addRow(dayOfWeek: number) {
    const sameDay = rows.filter((r) => r.dayOfWeek === dayOfWeek);
    const last = sameDay[sameDay.length - 1];
    setRows([
      ...rows,
      { key: newKey(), dayOfWeek, startTime: last?.endTime || "", endTime: "", activity: "", notes: "" },
    ]);
  }

  function copyMondayToAll() {
    const monday = rows.filter((r) => r.dayOfWeek === 1);
    const others = [2, 3, 4, 5].flatMap((d) => monday.map((r) => ({ ...r, key: newKey(), dayOfWeek: d })));
    setRows([...monday, ...others]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!loadedCategory) return;
    const payload = rows
      .filter((r) => r.activity.trim() || r.startTime)
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime || null,
        activity: r.activity,
        notes: r.notes || null,
      }));
    for (const item of payload) {
      const problem = scheduleItemProblem(item);
      if (problem) {
        const day = SCHOOL_DAYS.find((d) => d.day === item.dayOfWeek)?.label ?? "";
        setError(`${day}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: loadedCategory.id, items: payload }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save the timetable.");
      return;
    }
    setItems(data.items);
    setEditing(false);
  }

  return (
    <div className="animate-in max-w-4xl">
      <PageHeader
        title="Timetable"
        description={
          isTeacher
            ? "Your class's weekly timetable. If it changes, you'll see a to-do on your dashboard."
            : "Each class's fixed weekly timetable, Monday to Friday. Teachers see their own class's timetable and get a dashboard to-do when it changes."
        }
        actions={
          canEdit && loadedCategory && !editing ? (
            <Button size="sm" onClick={startEditing}>
              Edit timetable
            </Button>
          ) : undefined
        }
      />

      {!isTeacher && (
        <Card as="div" className="mb-4 p-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
          <Select
            value={pickedCategoryId}
            onChange={(e) => setPickedCategoryId(e.target.value)}
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !loadedCategory ? null : !editing && items.length === 0 ? (
        <EmptyState
          title={`No timetable for ${loadedCategory.name} yet`}
          description={canEdit ? "Click “Edit timetable” to add the daily routine." : "Ask the principal to add one."}
        />
      ) : (
        <div className="space-y-4">
          {editing && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={copyMondayToAll}>
                Copy Monday to every day
              </Button>
            </div>
          )}
          {SCHOOL_DAYS.map((d) => {
            const dayRows = editing ? sortScheduleItems(rows).filter((r) => r.dayOfWeek === d.day) : [];
            const dayItems = editing ? [] : items.filter((i) => i.dayOfWeek === d.day);
            if (!editing && dayItems.length === 0) return null;
            return (
              <Card as="div" key={d.day} className={`p-4 ${d.day === today ? "border-brand" : ""}`}>
                <h2 className="font-display mb-2 text-sm font-semibold text-foreground">
                  {d.label}
                  {d.day === today && <span className="ml-2 text-xs font-normal text-brand">Today</span>}
                </h2>
                {editing ? (
                  <div className="space-y-2">
                    {dayRows.map((r) => (
                      <div key={r.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[6rem_6rem_1fr_1fr_auto]">
                        <Input
                          type="time"
                          value={r.startTime}
                          onChange={(e) => updateRow(r.key, { startTime: e.target.value })}
                          aria-label="Start time"
                        />
                        <Input
                          type="time"
                          value={r.endTime}
                          onChange={(e) => updateRow(r.key, { endTime: e.target.value })}
                          aria-label="End time"
                        />
                        <Input
                          value={r.activity}
                          placeholder="Activity, e.g. Circle time"
                          maxLength={120}
                          onChange={(e) => updateRow(r.key, { activity: e.target.value })}
                          className="col-span-2 sm:col-span-1"
                        />
                        <Input
                          value={r.notes}
                          placeholder="Notes (optional)"
                          maxLength={500}
                          onChange={(e) => updateRow(r.key, { notes: e.target.value })}
                          className="col-span-2 sm:col-span-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                          aria-label="Remove row"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => addRow(d.day)}>
                      + Add row
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {dayItems.map((i) => (
                      <div key={i.id} className="flex gap-4 py-2 text-sm">
                        <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                          {i.startTime}
                          {i.endTime ? `–${i.endTime}` : ""}
                        </span>
                        <span className="min-w-0 flex-1 text-foreground">
                          {i.activity}
                          {i.notes && <span className="block text-xs text-muted-foreground">{i.notes}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {editing && (
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save timetable"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
