"use client";

// Attendance -- take the register, and look back at past ones.
// Phase 3 Session 1 started this as "today only, one class, tap to flip
// absent, one Save" so a teacher can do it on a phone in under a minute;
// that's still what the page opens on. Past registers (Dylan, 3 Nov 2026):
// admins and teachers can step back to any earlier day to view it, but
// can only change today and the 2 school days before it (the same rule is
// enforced by the API, see src/lib/attendanceEditWindow.ts). Older days are
// read-only, and the Monthly register tab shows a whole month as a grid
// with a PDF download. A TEACHER never sees a class picker (the API forces
// their own assignedCategoryId); anyone else with MANAGE_ATTENDANCE picks
// a class first.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { formatDateZA, todayLocal } from "@/lib/date";
import { isWeekendDate } from "@/lib/lessonPlan";
import {
  nextSchoolDay,
  previousSchoolDay,
  REGISTER_EDIT_PAST_SCHOOL_DAYS,
} from "@/lib/attendanceEditWindow";
import { MonthlyRegister } from "./MonthlyRegister";

type Category = { id: string; name: string; archived: boolean };
type Status = "PRESENT" | "ABSENT";
type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: Status | null;
};
type RegisterResponse = {
  error?: string;
  category?: { id: string; name: string };
  children?: ChildRow[];
  editable?: boolean;
  taken?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayLabel(date: string, today: string): string {
  const long = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (date === today) return `Today, ${long}`;
  if (date === previousSchoolDay(today) && nextSchoolDay(date) === today) {
    return `${long} (previous school day)`;
  }
  return long;
}

export default function AttendancePage() {
  const { organizationId, role } = useOrg();
  const isTeacher = role === "TEACHER";
  const [today] = useState(todayLocal);

  // View and date live in the URL (?view=month, ?date=YYYY-MM-DD) so
  // refresh and Back stay put. A missing, malformed or future date means today.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: "day" | "month" = searchParams.get("view") === "month" ? "month" : "day";
  const dateParam = searchParams.get("date");
  const date = useMemo(
    () => (dateParam && DATE_RE.test(dateParam) && dateParam <= today ? dateParam : today),
    [dateParam, today]
  );
  const weekend = isWeekendDate(date);
  const isToday = date === today;

  function setUrl(next: { view?: "day" | "month"; date?: string }) {
    const params = new URLSearchParams();
    const v = next.view ?? view;
    const d = next.date ?? date;
    if (v === "month") {
      params.set("view", "month");
      // Open the month of the day being looked at, not always this month.
      if (d.slice(0, 7) !== today.slice(0, 7)) params.set("month", d.slice(0, 7));
    }
    if (v === "day" && d !== today) params.set("date", d);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const [categories, setCategories] = useState<Category[]>([]);
  const [pickedCategoryId, setPickedCategoryId] = useState("");
  const [loadedCategory, setLoadedCategory] = useState<{ id: string; name: string } | null>(null);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Status | null>>({});
  const [editable, setEditable] = useState(false);
  const [taken, setTaken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
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
      let res: Response;
      let data: RegisterResponse;
      try {
        res = await fetch(`/api/organizations/${organizationId}/attendance/register?${params.toString()}`);
        data = await res.json().catch(() => ({}));
      } catch {
        setError("Couldn't load the register — check your connection and try again.");
        setLoading(false);
        return;
      }
      if (res.ok && data.category && data.children) {
        const canEdit = Boolean(data.editable);
        setLoadedCategory(data.category);
        setChildren(data.children);
        setEditable(canEdit);
        setTaken(Boolean(data.taken));
        // A register that can still be saved starts everyone on Present;
        // a locked one shows exactly what's on file (blank = not taken).
        const initial: Record<string, Status | null> = {};
        for (const c of data.children) initial[c.id] = c.status ?? (canEdit ? "PRESENT" : null);
        setDraft(initial);
      } else {
        setLoadedCategory(null);
        setChildren([]);
        setEditable(false);
        setTaken(false);
        setError(data.error ?? "Could not load the register.");
      }
      setLoading(false);
    },
    [organizationId, date]
  );

  useEffect(() => {
    if (view === "month") return;
    if (weekend) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no register on weekends
      setLoading(false);
    } else if (isTeacher) {
      loadRegister();
    } else if (pickedCategoryId) {
      loadRegister(pickedCategoryId);
    } else {
      setLoading(false);
    }
  }, [view, weekend, isTeacher, pickedCategoryId, loadRegister]);

  function toggle(childId: string) {
    if (!editable) return;
    setSavedAt(null);
    setDraft((prev) => ({
      ...prev,
      [childId]: prev[childId] === "ABSENT" ? "PRESENT" : "ABSENT",
    }));
  }

  async function save() {
    if (!loadedCategory || !editable) return;
    setSaving(true);
    setError("");
    // Never leave the button stuck on "Saving…" (final inspection B2).
    try {
      const res = await fetch(`/api/organizations/${organizationId}/attendance/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: loadedCategory.id,
          date,
          records: children.map((c) => ({ childId: c.id, status: draft[c.id] ?? "PRESENT" })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSavedAt(Date.now());
        setTaken(true);
      } else {
        setError(data.error ?? "Could not save the register.");
        // The day locked while the page was open (e.g. left open overnight).
        if (res.status === 403) setEditable(false);
      }
    } catch {
      setError("The register wasn't saved — check your connection and tap Save again.");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = children.filter((c) => draft[c.id] === "PRESENT").length;
  const absentCount = children.filter((c) => draft[c.id] === "ABSENT").length;
  const notTakenCount = children.length - presentCount - absentCount;
  const nextDay = nextSchoolDay(date);
  const editRule = `Registers can be changed for today and the ${REGISTER_EDIT_PAST_SCHOOL_DAYS} school days before it.`;

  return (
    <div className="animate-in">
      <PageHeader
        title="Attendance"
        description={
          view === "month"
            ? "Every child in a class against every school day of the month -- view it here, then download or print it."
            : weekend
              ? "Attendance is taken Monday to Friday."
              : editable || loading
                ? `${dayLabel(date, today)}. Everyone defaults to Present -- tap a child to mark them Absent.`
                : `${dayLabel(date, today)}. This register is read-only.`
        }
        actions={
          // Contacting parents is admin work (Dylan, 4 Oct 2026).
          isTeacher ? undefined : (
            <Link
              href="/dashboard/centre/attendance/absent"
              className="text-sm font-medium text-brand hover:underline"
            >
              Absent & notify parents →
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Attendance view">
        {(
          [
            ["day", "Daily register"],
            ["month", "Monthly register"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setUrl({ view: key })}
            className={`transition-standard rounded-lg px-3 py-2 text-sm font-medium ${
              view === key
                ? "bg-brand-soft text-brand-soft-foreground"
                : "bg-surface text-muted-foreground hover:bg-background"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "month" ? (
        <MonthlyRegister
          organizationId={organizationId}
          categories={categories}
          categoryId={pickedCategoryId}
          onCategoryChange={setPickedCategoryId}
          ownClassOnly={isTeacher}
          initialMonth={searchParams.get("month") ?? undefined}
        />
      ) : (
      <>
      <Card as="div" className="mb-4 flex flex-wrap items-end gap-3 p-4">
        {!isTeacher && (
          <div className="min-w-40 flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
            <Select value={pickedCategoryId} onChange={(e) => setPickedCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">No classes yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex-1 sm:flex-none">
          <label htmlFor="register-date" className="mb-1 block text-xs font-medium text-muted-foreground">
            Day
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Previous school day"
              onClick={() => setUrl({ date: previousSchoolDay(date) })}
            >
              ‹
            </Button>
            <Input
              id="register-date"
              type="date"
              className="w-auto"
              value={date}
              max={today}
              onChange={(e) => {
                const v = e.target.value;
                if (DATE_RE.test(v) && v <= today) setUrl({ date: v });
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Next school day"
              disabled={nextDay > today}
              onClick={() => setUrl({ date: nextDay })}
            >
              ›
            </Button>
            {!isToday && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setUrl({ date: today })}>
                Today
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {weekend ? (
        <EmptyState
          title={isToday ? "No school today" : "No school on weekends"}
          description="Attendance is taken Monday to Friday. Use ‹ to go back to the last school day."
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !loadedCategory ? (
        isTeacher ? (
          <EmptyState
            title="No class assigned yet"
            description="Ask an admin to assign you to a class from Settings → Team."
          />
        ) : (
          <EmptyState title="No class selected" description="Pick a class above to see its register." />
        )
      ) : children.length === 0 ? (
        <EmptyState
          title="No children in this class"
          description={`${loadedCategory.name} has no currently-enrolled children yet.`}
        />
      ) : (
        <>
          {!editable ? (
            <p className="mb-4 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Locked, view only.</span>{" "}
              {taken
                ? `${editRule} `
                : `This register was never taken. ${editRule} `}
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                onClick={() => setUrl({ view: "month" })}
              >
                See the month or download it as a PDF →
              </button>
            </p>
          ) : !isToday ? (
            <p className="mb-4 rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm text-foreground">
              {taken
                ? `You're changing the register for ${formatDateZA(date)}. ${editRule}`
                : `The register for ${formatDateZA(date)} wasn't taken. Everyone starts as Present -- mark who was absent and save. ${editRule}`}
            </p>
          ) : null}

          <Card as="div" className="mb-4 flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {loadedCategory.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {presentCount} present, {absentCount} absent
                {notTakenCount > 0 ? `, ${notTakenCount} not marked` : ""}, {children.length} total
              </p>
            </div>
            {editable && (
              <div className="flex items-center gap-3">
                {savedAt && <span className="text-xs text-success">Saved</span>}
                <Button onClick={save} disabled={saving} size="sm">
                  {saving ? "Saving…" : "Save register"}
                </Button>
              </div>
            )}
          </Card>

          <Card as="div" className={`p-2 ${editable ? "mb-24 md:mb-0" : ""}`}>
            <div className="divide-y divide-border">
              {children.map((c) => {
                const status = draft[c.id];
                const badge =
                  status === "ABSENT" ? (
                    <Badge variant="danger">Absent</Badge>
                  ) : status === "PRESENT" ? (
                    <Badge variant="success">Present</Badge>
                  ) : (
                    <Badge variant="neutral">Not marked</Badge>
                  );
                const name = (
                  <span className="text-sm font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </span>
                );
                return editable ? (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="transition-standard flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-background"
                  >
                    {name}
                    {badge}
                  </button>
                ) : (
                  <div
                    key={c.id}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3"
                  >
                    {name}
                    {badge}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Phones: a full-width Save always in reach at the bottom, so a
              teacher never scrolls back up a long class list (final
              inspection B5, "under a minute on a phone"). */}
          {editable && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface p-3 shadow-lg md:hidden">
              <Button onClick={save} disabled={saving} className="h-12 w-full text-base">
                {saving ? "Saving…" : savedAt ? "Saved ✓ — save again" : `Save register (${absentCount} absent)`}
              </Button>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}
