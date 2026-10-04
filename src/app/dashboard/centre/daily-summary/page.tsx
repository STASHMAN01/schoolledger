"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, Input, Label, PageHeader, Textarea } from "@/components/ui";

// Daily summary (Dylan, 4 Oct 2026). A class teacher answers it once a day
// from 16:00; everyone else sees which classes have and haven't.

type Summary = {
  id: string;
  anyoneHurt: boolean;
  incidentReported: boolean | null;
  noReportReason: string | null;
  submittedAt: string;
  submittedBy: { name: string } | null;
};

type TeacherStatus = {
  date: string;
  dueFrom?: string;
  isDue: boolean;
  noClass?: boolean;
  className?: string | null;
  summary?: Summary | null;
  incidentsToday?: number;
};

type ClassRow = {
  id: string;
  name: string;
  teachers: string[];
  summary: Summary | null;
  incidents: number;
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function SummaryAnswer({ s }: { s: Summary }) {
  if (!s.anyoneHurt) return <span className="text-success">Nobody was hurt</span>;
  if (s.incidentReported) return <span className="text-foreground">A child was hurt · incident report made</span>;
  return (
    <span className="text-foreground">
      A child was hurt · no report. Reason: &ldquo;{s.noReportReason}&rdquo;
    </span>
  );
}

function TeacherSummary({ organizationId }: { organizationId: string }) {
  const [status, setStatus] = useState<TeacherStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anyoneHurt, setAnyoneHurt] = useState<boolean | null>(null);
  const [reported, setReported] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/daily-summary`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStatus(data);
    else setError(data.error ?? "Couldn't load today's summary.");
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function submit() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/organizations/${organizationId}/daily-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anyoneHurt,
        ...(anyoneHurt ? { incidentReported: reported ?? undefined } : {}),
        ...(anyoneHurt && reported === false ? { noReportReason: reason } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't send. Please try again.");
      return;
    }
    await load();
  }

  if (error && !status) return <p className="text-sm text-danger">{error}</p>;
  if (!status) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (status.noClass) {
    return <Card className="p-4 text-sm text-muted-foreground">You aren&apos;t assigned to a class yet. Ask the admin.</Card>;
  }

  const day = new Date(`${status.date}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (status.summary) {
    return (
      <Card className="p-5">
        <p className="mb-1 text-sm font-medium text-success">Sent ✓</p>
        <p className="text-sm text-foreground">
          <SummaryAnswer s={status.summary} />
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {status.className} · {day} · sent at {timeOf(status.summary.submittedAt)}
          {status.summary.submittedBy ? ` by ${status.summary.submittedBy.name}` : ""}
        </p>
      </Card>
    );
  }

  const incidents = status.incidentsToday ?? 0;
  const ready =
    anyoneHurt === false ||
    (anyoneHurt === true && reported === true && incidents > 0) ||
    (anyoneHurt === true && reported === false && reason.trim().length >= 3);

  return (
    <Card className="max-w-xl p-5">
      <p className="mb-4 text-xs text-muted-foreground">
        {status.className} · {day}
        {!status.isDue && ` · due from ${status.dueFrom ?? "16:00"}, but you can send it now`}
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-medium text-foreground">
          Did any child get hurt today under your supervision?
        </legend>
        <div className="flex gap-2">
          <Button
            variant={anyoneHurt === true ? "primary" : "secondary"}
            onClick={() => setAnyoneHurt(true)}
          >
            Yes
          </Button>
          <Button
            variant={anyoneHurt === false ? "primary" : "secondary"}
            onClick={() => {
              setAnyoneHurt(false);
              setReported(null);
            }}
          >
            No
          </Button>
        </div>
      </fieldset>

      {anyoneHurt === true && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-medium text-foreground">Did you make an incident report?</legend>
          <p className="mb-2 text-xs text-muted-foreground">
            {incidents === 0
              ? "No incident report for your class today yet."
              : `${incidents} incident report${incidents === 1 ? "" : "s"} for your class today.`}
          </p>
          <div className="flex gap-2">
            <Button variant={reported === true ? "primary" : "secondary"} onClick={() => setReported(true)}>
              Yes
            </Button>
            <Button variant={reported === false ? "primary" : "secondary"} onClick={() => setReported(false)}>
              No
            </Button>
          </div>

          {reported === true && incidents === 0 && (
            <p className="mt-3 text-sm text-danger">
              There&apos;s no report for today yet.{" "}
              <Link href="/dashboard/centre/reports?new=INCIDENT&back=summary" className="font-medium underline">
                Make the report now
              </Link>
            </p>
          )}

          {reported === false && (
            <div className="mt-4 rounded-lg border border-border p-3">
              <p className="mb-3 text-sm text-foreground">Make the report now, or give a reason why not.</p>
              <Link
                href="/dashboard/centre/reports?new=INCIDENT&back=summary"
                className="mb-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
              >
                Make the report now
              </Link>
              <Label className="flex flex-col gap-1">
                Or give a reason
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. a small scrape, cleaned and the parent was told at pick-up"
                />
              </Label>
            </div>
          )}
        </fieldset>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Button onClick={submit} disabled={!ready || saving}>
        {saving ? "Sending…" : "Send today's summary"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">You can&apos;t change it after sending.</p>
    </Card>
  );
}

function AdminSummaries({ organizationId }: { organizationId: string }) {
  const [date, setDate] = useState<string>("");
  const [data, setData] = useState<{ date: string; today: string; isDue: boolean; classes: ClassRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = date ? `?date=${date}` : "";
    const res = await fetch(`/api/organizations/${organizationId}/daily-summary${qs}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setData(json);
      setError(null);
    } else setError(json.error ?? "Couldn't load summaries.");
  }, [organizationId, date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount / date change
    load();
  }, [load]);

  const missing = data ? data.classes.filter((c) => !c.summary).length : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Label className="flex flex-col gap-1">
          Day
          <Input type="date" value={date || data?.date || ""} onChange={(e) => setDate(e.target.value)} />
        </Label>
        {data && (
          <p className="pb-2 text-sm text-muted-foreground">
            {data.classes.length === 0
              ? "No class has a teacher assigned yet."
              : missing === 0
                ? "Every class has sent its summary."
                : data.date === data.today && !data.isDue
                  ? `Due from 16:00. ${missing} not sent yet.`
                  : `${missing} of ${data.classes.length} not sent.`}
          </p>
        )}
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {data && data.classes.length > 0 && (
        <Card className="divide-y divide-border">
          {data.classes.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {c.name}{" "}
                  <span className="font-normal text-muted-foreground">· {c.teachers.join(", ")}</span>
                </p>
                <p className="text-sm">
                  {c.summary ? (
                    <SummaryAnswer s={c.summary} />
                  ) : (
                    <span className="text-muted-foreground">Not sent</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.incidents} incident report{c.incidents === 1 ? "" : "s"} that day
                  {c.summary ? ` · sent ${timeOf(c.summary.submittedAt)}` : ""}
                </p>
              </div>
              <div className="shrink-0">
                {c.summary ? (
                  <Badge variant={c.summary.anyoneHurt ? "danger" : "success"}>
                    {c.summary.anyoneHurt ? "Child hurt" : "All fine"}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Waiting</Badge>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export default function DailySummaryPage() {
  const { organizationId, role } = useOrg();
  const isTeacher = role === "TEACHER";
  return (
    <div className="animate-in">
      <PageHeader
        title={isTeacher ? "Today's summary" : "Daily summaries"}
        description={
          isTeacher
            ? "Every day from 4 pm: tell us if any child got hurt under your supervision."
            : "Each class teacher answers this every weekday from 4 pm: was any child hurt, and was it reported?"
        }
      />
      {isTeacher ? <TeacherSummary organizationId={organizationId} /> : <AdminSummaries organizationId={organizationId} />}
    </div>
  );
}
