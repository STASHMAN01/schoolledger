"use client";

// Centre Management Reports (Dylan, 1 Oct 2026 to-do): incident, academic
// and disciplinary/behaviour reports. One page: a type tab bar, a list for
// the selected type, and a slide-in form to write a new one or edit an
// existing one. A Teacher only ever sees/writes reports for their own
// class -- enforced server-side (src/lib/reports.ts), this page just
// doesn't offer a class picker for one.
import { useCallback, useEffect, useState } from "react";
import { useOrg, useHasPermission } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { REPORT_TYPE_INFO, REPORT_TYPES, type ReportTypeValue } from "@/lib/reports";

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

type ChildOption = { id: string; firstName: string; lastName: string };

type FormState = {
  id: string | null;
  childId: string;
  type: ReportTypeValue;
  occurredAt: string;
  summary: string;
  parentNotified: boolean;
  injury: boolean;
  firstAidGiven: boolean;
  witnesses: string;
  actionTaken: string;
  term: string;
  developmentArea: string;
  rating: string;
  behaviour: string;
  followUp: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
    firstAidGiven: false,
    witnesses: "",
    actionTaken: "",
    term: "",
    developmentArea: "",
    rating: "",
    behaviour: "",
    followUp: "",
  };
}

export default function ReportsPage() {
  const { organizationId } = useOrg();
  const canManage = useHasPermission("MANAGE_REPORTS");
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

  async function save() {
    if (!form) return;
    if (!form.childId) {
      setError("Choose a child first.");
      return;
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
      firstAidGiven: r.firstAidGiven ?? false,
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
        {REPORT_TYPES.map((t) => (
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
                  {canManage && (
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

      {form && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onClick={() => !saving && setForm(null)}
        >
          <Card
            className="animate-in max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-base font-semibold text-foreground">
              {form.id ? `Edit ${REPORT_TYPE_INFO[form.type].label.toLowerCase()}` : `New ${REPORT_TYPE_INFO[form.type].label.toLowerCase()}`}
            </h2>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <Label htmlFor="rep-child">Child</Label>
                <Select
                  id="rep-child"
                  className="mt-1"
                  value={form.childId}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, childId: e.target.value })}
                >
                  <option value="">Choose a child…</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </Select>
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
                <Label htmlFor="rep-summary">{form.type === "DISCIPLINARY" ? "What happened" : "Summary"}</Label>
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
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={form.injury}
                        onChange={(e) => setForm({ ...form, injury: e.target.checked })}
                      />
                      Injury
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={form.firstAidGiven}
                        onChange={(e) => setForm({ ...form, firstAidGiven: e.target.checked })}
                      />
                      First aid given
                    </label>
                  </div>
                  <div>
                    <Label htmlFor="rep-witnesses">Witnesses</Label>
                    <Textarea
                      id="rep-witnesses"
                      className="mt-1"
                      rows={2}
                      value={form.witnesses}
                      onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rep-action">Action taken</Label>
                    <Textarea
                      id="rep-action"
                      className="mt-1"
                      rows={2}
                      value={form.actionTaken}
                      onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                    />
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

            <div className="mt-6 flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
