"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { addDays, mondayOf } from "@/lib/lessonPlan";
import { IMPORT_TEMPLATE } from "@/lib/lessonImport";
import { parseCsv, toCsv } from "@/lib/csv";

// Lesson plan (Dylan, 5 Oct 2026). An admin sets a theme for a stretch of
// days ("Numbers and shapes", 5 to 9 Oct) for every class or chosen ones,
// then each class gets its own topic per day, pitched at its age, with an
// optional teaching guide only admins write. Teachers read their class's
// plan, and can propose topics for empty days for the office to review.
// A whole month can be imported from a spreadsheet.

type DayTheme = { id: string; title: string } | null;
type Day = {
  date: string;
  topic: string;
  notes: string;
  guide: string;
  status?: string;
  reviewNote?: string;
  theme?: DayTheme;
};
type WeekTheme = { id: string; title: string; description: string; startDate: string; endDate: string; allClasses: boolean };
type ThemeRow = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  categoryIds: string[];
  days: number;
};
type PendingClass = { id: string; name: string; days: { date: string; topic: string; notes: string; by: string }[] };
type Category = { id: string; name: string; archived: boolean };
type Preview = {
  themes: { title: string; startDate: string; endDate: string; classes: string[]; days: number; withGuide: number }[];
  days: number;
  replacing: number;
  errors: { row: number; error: string }[];
  errorCount: number;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function prettyDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function range(a: string, b: string) {
  return a === b ? prettyDate(a) : `${prettyDate(a)} to ${prettyDate(b)}`;
}

function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

async function readExcel(file: File): Promise<string[][]> {
  const { readSheet } = await import("read-excel-file/browser");
  const data = await readSheet(file);
  return data.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (cell instanceof Date) return cell.toISOString().slice(0, 10);
      return String(cell);
    })
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{message}</p>;
}

// ── Theme: name, dates and classes ────────────────────────────────────────

function ThemeSheet({
  base,
  categories,
  initial,
  defaultStart,
  onClose,
  onSaved,
}: {
  base: string;
  categories: Category[];
  initial: ThemeRow | null;
  defaultStart: string;
  onClose: () => void;
  onSaved: (startDate: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultStart);
  const [endDate, setEndDate] = useState(initial?.endDate ?? addDays(defaultStart, 4));
  const [allClasses, setAllClasses] = useState(initial ? initial.categoryIds.length === 0 : true);
  const [picked, setPicked] = useState<string[]>(initial?.categoryIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!allClasses && picked.length === 0) return setError("Choose at least one class, or All classes.");
    setSaving(true);
    const res = await fetch(initial ? `${base}/lesson-themes/${initial.id}` : `${base}/lesson-themes`, {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, startDate, endDate, categoryIds: allClasses ? [] : picked }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Could not save the theme.");
    onSaved(startDate);
  }

  return (
    <Sheet
      title={initial ? "Edit theme" : "New theme"}
      onClose={onClose}
      busy={saving}
      footer={
        <div className="space-y-2">
          <ErrorBox message={error} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save theme"}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          One topic for a stretch of days. After saving, open each class&apos;s week to write the topic for each day
          and an optional teaching guide.
        </p>
        <div>
          <Label htmlFor="theme-title">Theme</Label>
          <Input
            id="theme-title"
            className="mt-1"
            placeholder="e.g. Numbers and shapes"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
          <div>
            <Label htmlFor="theme-start">First day</Label>
            <Input id="theme-start" type="date" className="mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="theme-end">Last day</Label>
            <Input id="theme-end" type="date" className="mt-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="theme-desc">Notes for all teachers (optional)</Label>
          <Textarea
            id="theme-desc"
            className="mt-1"
            rows={3}
            maxLength={2000}
            placeholder="What the children should take away from this theme"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-muted-foreground">Classes</legend>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
            <input type="checkbox" className="h-5 w-5" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} />
            All classes
          </label>
          {!allClasses &&
            categories.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={picked.includes(c.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))}
                />
                {c.name}
              </label>
            ))}
        </fieldset>
      </div>
    </Sheet>
  );
}

// ── Import a month from a spreadsheet ─────────────────────────────────────

function ImportSheet({
  base,
  categories,
  onClose,
  onImported,
}: {
  base: string;
  categories: Category[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function send(rows: string[][], dryRun: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch(`${base}/lesson-plans/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: rows, dryRun }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.preview) setPreview(data.preview);
    if (!res.ok) {
      setError(data.error ?? "Could not read that file.");
      return false;
    }
    return true;
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setDone(false);
    setError("");
    let rows: string[][];
    try {
      rows = /\.xlsx$/i.test(file.name) ? await readExcel(file) : parseCsv(await file.text());
    } catch {
      setError(
        /\.xls$/i.test(file.name)
          ? "That's an older Excel file (.xls). In Excel choose File → Save As → Excel Workbook (.xlsx), then upload that."
          : "That file couldn't be read. Save it as .xlsx or .csv and try again."
      );
      return;
    }
    rows = rows.map((r) => r.slice(0, 20).map((c) => String(c ?? "").slice(0, 6000)));
    setTable(rows);
    await send(rows, true);
  }

  async function runImport() {
    if (!table) return;
    if (await send(table, false)) {
      setDone(true);
      onImported();
    }
  }

  function downloadTemplate() {
    const sample = IMPORT_TEMPLATE.map((r, i) => (i > 0 && i < 3 && categories[0] ? [...r.slice(0, 3), categories[0].name, ...r.slice(4)] : r));
    const blob = new Blob(["﻿" + toCsv(sample)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crechely-lesson-plan-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const canImport = preview && preview.days + preview.themes.length > 0 && !done;

  return (
    <Sheet
      title="Import lesson plans"
      onClose={onClose}
      busy={busy}
      footer={
        <div className="space-y-2">
          <ErrorBox message={error} />
          <div className="flex gap-2">
            {done ? (
              <Button className="flex-1" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button className="flex-1" onClick={runImport} disabled={busy || !canImport}>
                {busy ? "Working…" : preview ? `Import ${preview.days} day${preview.days === 1 ? "" : "s"}` : "Import"}
              </Button>
            )}
            {!done && (
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          One row per class per day, with these headings:{" "}
          <span className="font-medium">Theme, Start date, End date, Class, Date, Topic for the day, Teaching guide</span>.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Class can be one class, several separated by &quot;;&quot;, or &quot;All&quot;.</li>
          <li>Date can be a date (2026-10-05 or 05/10/2026) or a weekday like &quot;Monday&quot;.</li>
          <li>Teaching guide is optional.</li>
          <li>A day that already has a plan for that class is replaced.</li>
        </ul>
        <Button variant="secondary" size="sm" onClick={downloadTemplate}>
          Download the template
        </Button>

        <div>
          <Label htmlFor="lp-file">Spreadsheet (.xlsx or .csv)</Label>
          <input
            id="lp-file"
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="mt-1 block w-full text-sm text-foreground file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:text-sm file:font-medium file:text-brand-foreground"
            onChange={pick}
            disabled={busy}
          />
          {fileName && <p className="mt-1 text-xs text-muted-foreground">{fileName}</p>}
        </div>

        {busy && !preview && <p className="text-sm text-muted-foreground">Reading…</p>}

        {preview && (
          <div className="space-y-3">
            {done && (
              <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
                Imported {preview.days} day{preview.days === 1 ? "" : "s"} across {preview.themes.length} theme
                {preview.themes.length === 1 ? "" : "s"}.
              </p>
            )}
            {preview.themes.map((t) => (
              <Card key={`${t.title}${t.startDate}`} className="p-3">
                <p className="text-sm font-semibold text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {range(t.startDate, t.endDate)} · {t.classes.join(", ")}
                </p>
                <p className="mt-1 text-xs text-foreground">
                  {t.days} class-day{t.days === 1 ? "" : "s"}
                  {t.withGuide > 0 ? `, ${t.withGuide} with a teaching guide` : ""}
                </p>
              </Card>
            ))}
            {preview.replacing > 0 && !done && (
              <p className="text-sm text-muted-foreground">
                {preview.replacing} of these day{preview.replacing === 1 ? " already has" : "s already have"} a plan and will be replaced.
              </p>
            )}
            {preview.errorCount > 0 && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-sm font-medium text-danger">
                  {preview.errorCount} row{preview.errorCount === 1 ? "" : "s"} will be skipped:
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-danger">
                  {preview.errors.map((e) => (
                    <li key={`${e.row}${e.error}`}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ── The page ──────────────────────────────────────────────────────────────

export default function LessonPlanPage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canEdit = !isTeacher && permissions.includes("MANAGE_CLASSES");
  const base = `/api/organizations/${organizationId}`;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [today, setToday] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [weekThemes, setWeekThemes] = useState<WeekTheme[]>([]);
  const [allThemes, setAllThemes] = useState<ThemeRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingClass[]>([]);
  const [returning, setReturning] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [sent, setSent] = useState("");
  const [themeSheet, setThemeSheet] = useState<{ theme: ThemeRow | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const planNext = useRef(false);

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`${base}/categories`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const active = (data.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        setCategoryId((prev) => prev || active[0]?.id || "");
        if (active.length === 0) setLoading(false);
      }
    })();
  }, [base, isTeacher]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setEditing(false);
    const qs = new URLSearchParams();
    if (!isTeacher) qs.set("categoryId", categoryId);
    if (weekStart) qs.set("weekStart", weekStart);
    const res = await fetch(`${base}/lesson-plans?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDays(data.days);
      setWeekThemes(data.themes ?? []);
      setClassName(data.category.name);
      setToday(data.today);
      if (!weekStart) setWeekStart(data.weekStart);
      if (planNext.current) {
        planNext.current = false;
        setEditing(true);
      }
    } else {
      setDays([]);
      setWeekThemes([]);
      setError(data.error ?? "Could not load the lesson plan.");
    }
    setLoading(false);
  }, [base, isTeacher, categoryId, weekStart]);

  useEffect(() => {
    if (!isTeacher && !categoryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the class or week changes
    load();
  }, [isTeacher, categoryId, load]);

  const loadThemes = useCallback(async () => {
    if (!canEdit) return;
    const res = await fetch(`${base}/lesson-themes`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAllThemes(data.themes);
  }, [base, canEdit]);

  const loadPending = useCallback(async () => {
    if (!canEdit) return;
    const res = await fetch(`${base}/lesson-plans/pending`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPending(data.classes);
  }, [base, canEdit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the review list and themes on mount
    loadPending();
    loadThemes();
  }, [loadPending, loadThemes]);

  async function review(id: string, action: "approve" | "return") {
    setError("");
    const res = await fetch(`${base}/lesson-plans/review`, {
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
    const res = await fetch(`${base}/lesson-plans/submit`, {
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
    const res = await fetch(`${base}/lesson-plans`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        weekStart,
        days: days.map((d) => ({ date: d.date, topic: d.topic, notes: d.notes, guide: d.guide })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save the lesson plan.");
      return;
    }
    load();
    loadThemes();
  }

  async function removeTheme(id: string, withDays: boolean) {
    setError("");
    const res = await fetch(`${base}/lesson-themes/${id}${withDays ? "?days=1" : ""}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not remove the theme.");
      return;
    }
    setDeleting(null);
    load();
    loadThemes();
  }

  const todayPlan = days.find((d) => d.date === today);
  const upcoming = allThemes.filter((t) => t.endDate >= (today || localToday()));

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Lesson plan"
        description={
          isTeacher
            ? "Your class's theme, today's topic and the teaching guide. You can also plan empty days and send them to the office."
            : "Set a theme for a week or more, then a topic and an optional teaching guide for each class, each day."
        }
        actions={
          <>
            {canEdit && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setThemeSheet({ theme: null })}>
                  New theme
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
                  Import
                </Button>
              </>
            )}
            {!editing && days.length > 0 && (
              <Button size="sm" onClick={() => setEditing(true)}>
                {canEdit ? "Edit this week" : "Plan this week"}
              </Button>
            )}
          </>
        }
      />

      {!isTeacher && (
        <Card as="div" className="mb-4 p-4">
          <label htmlFor="lp-class" className="mb-1 block text-xs font-medium text-muted-foreground">
            Class
          </label>
          <Select id="lp-class" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:max-w-xs" disabled={editing}>
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
                    <Textarea rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="What should the teacher change?" />
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
      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      {isTeacher && !loading && todayPlan && (todayPlan.status === "APPROVED" || todayPlan.status === "NONE") && (
        <Card as="div" className="mb-4 border-brand p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Today · {className}
            {todayPlan.theme ? ` · ${todayPlan.theme.title}` : ""}
          </p>
          {todayPlan.topic ? (
            <>
              <h2 className="font-display mt-1 text-lg font-semibold text-foreground">{todayPlan.topic}</h2>
              {todayPlan.guide && (
                <div className="mt-3 rounded-lg bg-brand-soft p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-soft-foreground">Teaching guide</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{todayPlan.guide}</p>
                </div>
              )}
              {todayPlan.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{todayPlan.notes}</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No topic for today yet.</p>
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
        </div>
      )}

      {weekThemes.map((t) => {
        const row = allThemes.find((x) => x.id === t.id);
        return (
          <Card key={t.id} as="div" className="mb-3 border-l-4 border-l-brand p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-brand">Theme</p>
            <h2 className="font-display text-lg font-semibold text-foreground">{t.title}</h2>
            <p className="text-xs text-muted-foreground">
              {range(t.startDate, t.endDate)} · {t.allClasses ? "All classes" : "Some classes"}
            </p>
            {t.description && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{t.description}</p>}
            {canEdit && row && !editing && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setThemeSheet({ theme: row })}>
                  Edit theme
                </Button>
                {deleting === t.id ? (
                  <>
                    <Button size="sm" variant="danger" onClick={() => removeTheme(t.id, false)}>
                      Remove theme, keep daily topics
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeTheme(t.id, true)}>
                      Remove theme and its daily topics
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDeleting(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setDeleting(t.id)}>
                    Remove…
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {days.map((d, i) => {
            const editable = editing && (canEdit || d.status !== "APPROVED");
            return (
              <Card as="div" key={d.date} className={`p-4 ${d.date === today ? "border-brand" : ""}`}>
                <h2 className="font-display mb-1 text-sm font-semibold text-foreground">
                  {DAY_NAMES[i]} · {prettyDate(d.date)}
                  {d.date === today && <span className="ml-2 text-xs font-normal text-brand">Today</span>}
                </h2>
                {d.theme && <p className="mb-2 text-xs text-muted-foreground">{d.theme.title}</p>}
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
                {editable ? (
                  <div className="space-y-2">
                    <Input
                      value={d.topic}
                      maxLength={200}
                      placeholder={d.theme ? `Today's part of "${d.theme.title}", e.g. Counting 1 to 10` : "Topic, e.g. Colours and shapes"}
                      onChange={(e) => update(d.date, { topic: e.target.value })}
                      aria-label={`${DAY_NAMES[i]} topic`}
                    />
                    {canEdit && (
                      <Textarea
                        value={d.guide}
                        rows={4}
                        maxLength={5000}
                        placeholder="Teaching guide (optional): what to teach and how, for this class's age"
                        onChange={(e) => update(d.date, { guide: e.target.value })}
                        aria-label={`${DAY_NAMES[i]} teaching guide`}
                      />
                    )}
                    <Textarea
                      value={d.notes}
                      rows={2}
                      maxLength={5000}
                      placeholder="Notes (optional)"
                      onChange={(e) => update(d.date, { notes: e.target.value })}
                      aria-label={`${DAY_NAMES[i]} notes`}
                    />
                  </div>
                ) : d.topic ? (
                  <>
                    <p className="text-base font-medium text-foreground">{d.topic}</p>
                    {d.guide && (
                      <details className="mt-2 rounded-lg bg-brand-soft p-3" open={isTeacher && d.date === today}>
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-brand-soft-foreground">
                          Teaching guide
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{d.guide}</p>
                      </details>
                    )}
                    {d.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{d.notes}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No plan for this day.</p>
                )}
              </Card>
            );
          })}
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

      {canEdit && upcoming.length > 0 && !editing && (
        <Card as="div" className="mt-6 p-4">
          <h2 className="font-display mb-2 text-sm font-semibold text-foreground">Themes coming up</h2>
          <ul className="divide-y divide-border">
            {upcoming.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setWeekStart(mondayOf(t.startDate))}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {range(t.startDate, t.endDate)} ·{" "}
                      {t.categoryIds.length === 0
                        ? "All classes"
                        : t.categoryIds.map((id) => categories.find((c) => c.id === id)?.name ?? "").filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t.days} day{t.days === 1 ? "" : "s"} planned
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {themeSheet && (
        <ThemeSheet
          base={base}
          categories={categories}
          initial={themeSheet.theme}
          defaultStart={weekStart ?? localToday()}
          onClose={() => setThemeSheet(null)}
          onSaved={(start) => {
            setThemeSheet(null);
            loadThemes();
            const monday = mondayOf(start);
            if (monday === weekStart) load();
            else setWeekStart(monday);
          }}
        />
      )}
      {importing && (
        <ImportSheet
          base={base}
          categories={categories}
          onClose={() => setImporting(false)}
          onImported={() => {
            load();
            loadThemes();
          }}
        />
      )}
    </div>
  );
}
