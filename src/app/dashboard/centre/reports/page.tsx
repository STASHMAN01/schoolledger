"use client";

// Centre Management Reports (Dylan, 1 Oct 2026 to-do): incident, academic
// and disciplinary/behaviour reports. One page: a type tab bar, a list for
// the selected type, and a slide-in form to write a new one or edit an
// existing one. A Teacher only ever sees/writes reports for their own
// class -- enforced server-side (src/lib/reports.ts), this page just
// doesn't offer a class picker for one.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { todayLocal } from "@/lib/date";
import { useOrg, useHasPermission } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { ChildPicker } from "@/components/ChildPicker";
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPES,
  REPORT_TYPE_INFO,
  REPORT_TYPES,
  ageAt,
  type IncidentTypeValue,
  type ReportTypeValue,
} from "@/lib/reports";

type ReportRow = {
  id: string;
  type: ReportTypeValue;
  occurredAt: string;
  summary: string;
  parentNotified: boolean;
  createdAt: string;
  child: { id: string; firstName: string; lastName: string };
  category: { id: string; name: string };
  createdBy: { id: string; name: string };
};

type ChildOption = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  category?: { name: string } | null;
};

type YesNo = boolean | null; // null = not answered

type FormState = {
  id: string | null;
  childId: string;
  type: ReportTypeValue;
  occurredAt: string;
  summary: string;
  parentNotified: boolean;
  injury: boolean;
  firstAidGiven: YesNo;
  emergencyCareRequired: YesNo;
  staffConsulted: YesNo;
  witnessesPresent: YesNo;
  incidentTime: string;
  location: string;
  incidentTypes: IncidentTypeValue[];
  incidentTypeOther: string;
  caregiver: string;
  witnesses: string;
  actionTaken: string;
  term: string;
  developmentArea: string;
  rating: string;
  behaviour: string;
  followUp: string;
};

// The viewer's own date: the UTC date is still yesterday in South Africa
// until 02:00.
function todayStr() {
  return todayLocal();
}

function emptyForm(type: ReportTypeValue, childId = ""): FormState {
  return {
    id: null,
    childId,
    type,
    occurredAt: todayStr(),
    summary: "",
    parentNotified: false,
    injury: false,
    firstAidGiven: null,
    emergencyCareRequired: null,
    staffConsulted: null,
    witnessesPresent: null,
    incidentTime: "",
    location: "",
    incidentTypes: [],
    incidentTypeOther: "",
    caregiver: "",
    witnesses: "",
    actionTaken: "",
    term: "",
    developmentArea: "",
    rating: "",
    behaviour: "",
    followUp: "",
  };
}

function YesNoRow({ label, value, onChange }: { label: string; value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex gap-4">
        {([true, false] as const).map((opt) => (
          <label key={String(opt)} className="flex items-center gap-1.5 text-sm text-foreground">
            <input type="radio" name={label} checked={value === opt} onChange={() => onChange(opt)} />
            {opt ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { organizationId, role } = useOrg();
  const canManage = useHasPermission("MANAGE_REPORTS");
  // Teachers write incident reports only and can't change or delete one
  // once saved (Dylan, 4 Oct 2026); the server enforces both.
  const isTeacher = role === "TEACHER";
  const visibleTypes = isTeacher ? REPORT_TYPES.filter((t) => t === "INCIDENT") : REPORT_TYPES;
  const canChange = canManage && !isTeacher;
  // ?new=INCIDENT opens a blank incident form straight away (the daily
  // summary's "Make the report now"); &back=summary returns there after
  // saving.
  const searchParams = useSearchParams();
  const router = useRouter();
  const backToSummary = searchParams.get("back") === "summary";
  const openedFromLink = useRef(false);
  const base = `/api/organizations/${organizationId}`;

  const [activeType, setActiveType] = useState<ReportTypeValue>("INCIDENT");
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReports(null);
    const res = await fetch(`${base}/reports?type=${activeType}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't load reports. Please refresh the page.");
      return;
    }
    setReports(data.reports);
  }, [base, activeType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/tab-change data load
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      const res = await fetch(`${base}/children`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setChildren(data.children);
    })();
  }, [base, canManage]);

  useEffect(() => {
    if (openedFromLink.current || !canManage) return;
    if (searchParams.get("new") === "INCIDENT") {
      openedFromLink.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- open the form once from the link
      setForm(emptyForm("INCIDENT"));
    }
  }, [searchParams, canManage]);

  async function save() {
    if (!form) return;
    if (!form.childId) {
      setError("Choose a child first.");
      return;
    }
    // A new incident report must be filled in like the paper form; older
    // reports can still be edited without these.
    if (form.type === "INCIDENT" && !form.id) {
      const missing = !form.incidentTime
        ? "Enter the time it happened."
        : form.incidentTypes.length === 0
          ? "Tick at least one type of incident."
          : form.incidentTypes.includes("OTHER") && !form.incidentTypeOther.trim()
            ? "Say what the other type of incident was."
            : !form.caregiver.trim()
              ? "Enter the caregiver's name."
              : !form.summary.trim()
                ? "Describe the incident."
                : null;
      if (missing) {
        setError(missing);
        return;
      }
    }
    setSaving(true);
    setError(null);
    const url = form.id ? `${base}/reports/${form.id}` : `${base}/reports`;
    const res = await fetch(url, {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save. Please try again.");
      return;
    }
    setForm(null);
    if (backToSummary && !form.id) {
      router.push("/dashboard/centre/daily-summary");
      return;
    }
    load();
  }

  async function remove(id: string) {
    setDeletingId(id);
    const res = await fetch(`${base}/reports/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't delete. Please try again.");
      return;
    }
    load();
  }

  async function startEdit(row: ReportRow) {
    const res = await fetch(`${base}/reports/${row.id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't open that report.");
      return;
    }
    const r = data.report;
    setForm({
      id: r.id,
      childId: r.child.id,
      type: r.type,
      occurredAt: new Date(r.occurredAt).toISOString().slice(0, 10),
      summary: r.summary ?? "",
      parentNotified: r.parentNotified,
      injury: r.injury ?? false,
      firstAidGiven: r.firstAidGiven ?? null,
      emergencyCareRequired: r.emergencyCareRequired ?? null,
      staffConsulted: r.staffConsulted ?? null,
      witnessesPresent: r.witnessesPresent ?? null,
      incidentTime: r.incidentTime ?? "",
      location: r.location ?? "",
      incidentTypes: r.incidentTypes ?? [],
      incidentTypeOther: r.incidentTypeOther ?? "",
      caregiver: r.caregiver ?? "",
      witnesses: r.witnesses ?? "",
      actionTaken: r.actionTaken ?? "",
      term: r.term ?? "",
      developmentArea: r.developmentArea ?? "",
      rating: r.rating ?? "",
      behaviour: r.behaviour ?? "",
      followUp: r.followUp ?? "",
    });
  }

  const info = REPORT_TYPE_INFO[activeType];
  const chosenChild = form ? children.find((c) => c.id === form.childId) : undefined;

  return (
    <div className="animate-in">
      <PageHeader
        title="Reports"
        description="Incident, academic and disciplinary reports -- each printable as a PDF for a parent or your own file."
        actions={
          canManage && (
            <Button onClick={() => setForm(emptyForm(activeType))}>New {info.label.toLowerCase()}</Button>
          )
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="mb-5 flex flex-wrap gap-2">
        {visibleTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveType(t)}
            className={`transition-standard rounded-lg px-3 py-2 text-sm font-medium ${
              activeType === t
                ? "bg-brand-soft text-brand-soft-foreground"
                : "bg-surface text-muted-foreground hover:bg-background"
            }`}
          >
            {REPORT_TYPE_INFO[t].plural}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{info.hint}</p>

      {reports === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <EmptyState
          title={`No ${info.plural.toLowerCase()} yet`}
          description="Reports you write will show here, newest first."
        />
      ) : (
        <Card as="div" className="divide-y divide-border">
          {reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {r.child.firstName} {r.child.lastName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{r.category.name}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(r.occurredAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  {" · "}
                  {r.createdBy.name}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-foreground">{r.summary}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {r.parentNotified ? (
                  <Badge variant="success">Parent notified</Badge>
                ) : (
                  <Badge variant="neutral">Parent not notified</Badge>
                )}
                <div className="flex gap-2">
                  <a
                    href={`${base}/reports/${r.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand underline underline-offset-2"
                  >
                    View PDF
                  </a>
                  {canChange && (
                    <>
                      <button type="button" onClick={() => startEdit(r)} className="text-sm text-brand underline underline-offset-2">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={deletingId === r.id}
                        className="text-sm text-danger underline underline-offset-2 disabled:opacity-50"
                      >
                        {deletingId === r.id ? "Deleting…" : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {form &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          onClick={() => !saving && setForm(null)}
        >
          {/* Phones: a full-screen sheet with the title on top, the fields
              scrolling in the middle and Save/Cancel always in reach at the
              bottom. Larger screens: a centred card. */}
          <div
            className="animate-in flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[90dvh] sm:rounded-xl sm:border sm:border-border sm:shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-3">
              <h2 className="font-display text-base font-semibold text-foreground">
                {form.id ? `Edit ${REPORT_TYPE_INFO[form.type].label.toLowerCase()}` : `New ${REPORT_TYPE_INFO[form.type].label.toLowerCase()}`}
              </h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={saving}
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-xl text-muted-foreground hover:bg-background"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <div>
                <Label>Child</Label>
                <div className="mt-1">
                  <ChildPicker
                    options={children}
                    value={form.childId}
                    disabled={!!form.id}
                    onChange={(id) => setForm({ ...form, childId: id })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rep-date">Date</Label>
                <Input
                  id="rep-date"
                  type="date"
                  className="mt-1"
                  value={form.occurredAt}
                  onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                />
              </div>

              {form.type === "INCIDENT" && (
                <>
                  {chosenChild && (
                    <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted-foreground">
                      Class: {chosenChild.category?.name ?? "—"} · Age:{" "}
                      {ageAt(chosenChild.dateOfBirth, form.occurredAt ? new Date(form.occurredAt) : undefined) ?? "not recorded"}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                    <div>
                      <Label htmlFor="rep-time">Time</Label>
                      <Input
                        id="rep-time"
                        type="time"
                        className="mt-1"
                        value={form.incidentTime}
                        onChange={(e) => setForm({ ...form, incidentTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rep-location">Location</Label>
                      <Input
                        id="rep-location"
                        className="mt-1"
                        placeholder="e.g. Playground"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="rep-caregiver">Caregiver (your name)</Label>
                    <Input
                      id="rep-caregiver"
                      className="mt-1"
                      value={form.caregiver}
                      onChange={(e) => setForm({ ...form, caregiver: e.target.value })}
                    />
                  </div>
                  <fieldset>
                    <legend className="text-sm font-medium text-foreground">Type of incident (tick all that apply)</legend>
                    <div className="mt-2 grid grid-cols-1 gap-1 min-[400px]:grid-cols-2">
                      {INCIDENT_TYPES.map((t) => (
                        <label key={t} className="flex min-h-11 items-center gap-3 text-base text-foreground sm:min-h-0 sm:gap-2 sm:text-sm">
                          <input
                            type="checkbox"
                            checked={form.incidentTypes.includes(t)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                incidentTypes: e.target.checked
                                  ? [...form.incidentTypes, t]
                                  : form.incidentTypes.filter((x) => x !== t),
                              })
                            }
                          />
                          {INCIDENT_TYPE_LABELS[t]}
                        </label>
                      ))}
                    </div>
                    {form.incidentTypes.includes("OTHER") && (
                      <Input
                        aria-label="Other type of incident"
                        className="mt-2"
                        placeholder="What kind of incident?"
                        value={form.incidentTypeOther}
                        onChange={(e) => setForm({ ...form, incidentTypeOther: e.target.value })}
                      />
                    )}
                  </fieldset>
                </>
              )}

              {form.type === "ACADEMIC" && (
                <>
                  <div>
                    <Label htmlFor="rep-term">Term</Label>
                    <Input
                      id="rep-term"
                      className="mt-1"
                      placeholder="e.g. Term 3 2026"
                      value={form.term}
                      onChange={(e) => setForm({ ...form, term: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rep-area">Development area</Label>
                    <Input
                      id="rep-area"
                      className="mt-1"
                      placeholder="e.g. Gross motor, Language, Social/emotional"
                      value={form.developmentArea}
                      onChange={(e) => setForm({ ...form, developmentArea: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rep-rating">Rating</Label>
                    <Input
                      id="rep-rating"
                      className="mt-1"
                      placeholder="e.g. Meeting expectations"
                      value={form.rating}
                      onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="rep-summary">{form.type === "DISCIPLINARY" ? "What happened" : form.type === "INCIDENT" ? "Describe the incident" : "Summary"}</Label>
                <Textarea
                  id="rep-summary"
                  className="mt-1"
                  rows={4}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>

              {form.type === "INCIDENT" && (
                <>
                  <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">Care and response</p>
                    <YesNoRow label="First aid provided?" value={form.firstAidGiven} onChange={(v) => setForm({ ...form, firstAidGiven: v })} />
                    <YesNoRow label="Emergency care required?" value={form.emergencyCareRequired} onChange={(v) => setForm({ ...form, emergencyCareRequired: v })} />
                    <YesNoRow label="Staff member or nurse consulted?" value={form.staffConsulted} onChange={(v) => setForm({ ...form, staffConsulted: v })} />
                    <div>
                      <Label htmlFor="rep-action">Describe the care or intervention provided</Label>
                      <Textarea
                        id="rep-action"
                        className="mt-1"
                        rows={2}
                        value={form.actionTaken}
                        onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    <YesNoRow label="Any witnesses?" value={form.witnessesPresent} onChange={(v) => setForm({ ...form, witnessesPresent: v })} />
                    {form.witnessesPresent && (
                      <div>
                        <Label htmlFor="rep-witnesses">Witness names</Label>
                        <Textarea
                          id="rep-witnesses"
                          className="mt-1"
                          rows={2}
                          value={form.witnesses}
                          onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {form.type === "DISCIPLINARY" && (
                <>
                  <div>
                    <Label htmlFor="rep-behaviour">Behaviour observed</Label>
                    <Textarea
                      id="rep-behaviour"
                      className="mt-1"
                      rows={2}
                      value={form.behaviour}
                      onChange={(e) => setForm({ ...form, behaviour: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rep-followup">Follow-up</Label>
                    <Textarea
                      id="rep-followup"
                      className="mt-1"
                      rows={2}
                      value={form.followUp}
                      onChange={(e) => setForm({ ...form, followUp: e.target.value })}
                    />
                  </div>
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.parentNotified}
                  onChange={(e) => setForm({ ...form, parentNotified: e.target.checked })}
                />
                Parent notified
              </label>
            </div>
            </div>

            <div className="shrink-0 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {error && <p className="mb-2 text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving} className="flex-1 sm:flex-none">
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => setForm(null)} disabled={saving} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
        , document.body)}
    </div>
  );
}
