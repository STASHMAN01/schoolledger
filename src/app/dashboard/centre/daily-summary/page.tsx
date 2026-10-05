"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, Input, Label, PageHeader, Textarea } from "@/components/ui";

// Daily summary (Dylan, 4 Oct 2026). A class teacher answers it once a day
// from 12:00; everyone else sees which classes have and haven't.

type Summary = {
  id: string;
  anyoneHurt: boolean;
  incidentReported: boolean | null;
  noReportReason: string | null;
  anyoneIll?: boolean | null;
  illDetails?: string | null;
  routineFollowed?: "YES" | "MOSTLY" | "NO" | null;
  routineNote?: string | null;
  childrenNote?: string | null;
  needsNote?: string | null;
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
  incidentsSince?: number;
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

const ROUTINE_TEXT = { YES: "Yes, as planned", MOSTLY: "Mostly", NO: "No" } as const;

function Answer({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-xs text-muted-foreground">{q}</p>
      <p className="text-sm text-foreground">{children}</p>
    </div>
  );
}

/** All five answers, as the teacher gave them (older summaries only have the first). */
function SummaryAnswer({ s }: { s: Summary }) {
  return (
    <div className="divide-y divide-border">
      <Answer q="Was any child hurt?">
        {!s.anyoneHurt ? (
          <span className="text-success">Nobody was hurt</span>
        ) : s.incidentReported ? (
          "A child was hurt · incident report made"
        ) : (
          <>A child was hurt · no report. Reason: &ldquo;{s.noReportReason}&rdquo;</>
        )}
      </Answer>
      {s.anyoneIll != null && (
        <Answer q="Did any child fall ill or show symptoms?">
          {s.anyoneIll ? <>Yes: {s.illDetails}</> : <span className="text-success">No</span>}
        </Answer>
      )}
      {s.routineFollowed && (
        <Answer q="Did the day follow the routine and lesson plan?">
          {ROUTINE_TEXT[s.routineFollowed]}
          {s.routineNote ? ` · ${s.routineNote}` : ""}
        </Answer>
      )}
      {s.anyoneIll != null && (
        <Answer q="Anything about a child's behaviour, mood or progress?">
          {s.childrenNote || <span className="text-muted-foreground">Nothing to report</span>}
        </Answer>
      )}
      {s.anyoneIll != null && (
        <Answer q="Anything that needs attention (supplies, repairs, safety, a parent)?">
          {s.needsNote || <span className="text-muted-foreground">Nothing to report</span>}
        </Answer>
      )}
    </div>
  );
}

function TeacherSummary({ organizationId }: { organizationId: string }) {
  const [status, setStatus] = useState<TeacherStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anyoneHurt, setAnyoneHurt] = useState<boolean | null>(null);
  const [reported, setReported] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [anyoneIll, setAnyoneIll] = useState<boolean | null>(null);
  const [illDetails, setIllDetails] = useState("");
  const [routine, setRoutine] = useState<"YES" | "MOSTLY" | "NO" | null>(null);
  const [routineNote, setRoutineNote] = useState("");
  const [childrenNote, setChildrenNote] = useState("");
  const [needsNote, setNeedsNote] = useState("");
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
        anyoneIll,
        ...(anyoneIll ? { illDetails } : {}),
        routineFollowed: routine,
        ...(routine && routine !== "YES" ? { routineNote } : {}),
        childrenNote,
        needsNote,
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
        <p className="mb-2 text-sm font-medium text-success">Sent ✓</p>
        <SummaryAnswer s={status.summary} />
        <p className="mt-2 text-xs text-muted-foreground">
          {status.className} · {day} · sent at {timeOf(status.summary.submittedAt)}
          {status.summary.submittedBy ? ` by ${status.summary.submittedBy.name}` : ""}
        </p>
      </Card>
    );
  }

  const incidents = status.incidentsToday ?? 0;
  const hurtReady =
    anyoneHurt === false ||
    (anyoneHurt === true && reported === true && incidents > 0) ||
    (anyoneHurt === true && reported === false && reason.trim().length >= 3);
  const illReady = anyoneIll === false || (anyoneIll === true && illDetails.trim().length >= 3);
  const routineReady = routine === "YES" || (routine !== null && routineNote.trim().length >= 3);
  const ready = hurtReady && illReady && routineReady;

  return (
    <Card className="max-w-xl p-5">
      <p className="mb-4 text-xs text-muted-foreground">
        {status.className} · {day}
        {!status.isDue && ` · due from ${status.dueFrom ?? "12:00"}, but you can send it now`}
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-medium text-foreground">
          1. Did any child get hurt today under your supervision?
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

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-medium text-foreground">
          2. Did any child fall ill or show symptoms today (fever, vomiting, rash, a cough…)?
        </legend>
        <div className="flex gap-2">
          <Button variant={anyoneIll === true ? "primary" : "secondary"} onClick={() => setAnyoneIll(true)}>
            Yes
          </Button>
          <Button variant={anyoneIll === false ? "primary" : "secondary"} onClick={() => setAnyoneIll(false)}>
            No
          </Button>
        </div>
        {anyoneIll === true && (
          <Textarea
            className="mt-3"
            rows={2}
            value={illDetails}
            onChange={(e) => setIllDetails(e.target.value)}
            placeholder="Who was unwell, what you noticed, and what you did (e.g. parent called, sent home)"
          />
        )}
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-medium text-foreground">
          3. Did the day follow the routine and lesson plan?
        </legend>
        <div className="flex flex-wrap gap-2">
          <Button variant={routine === "YES" ? "primary" : "secondary"} onClick={() => setRoutine("YES")}>
            Yes
          </Button>
          <Button variant={routine === "MOSTLY" ? "primary" : "secondary"} onClick={() => setRoutine("MOSTLY")}>
            Mostly
          </Button>
          <Button variant={routine === "NO" ? "primary" : "secondary"} onClick={() => setRoutine("NO")}>
            No
          </Button>
        </div>
        {routine !== null && routine !== "YES" && (
          <Textarea
            className="mt-3"
            rows={2}
            value={routineNote}
            onChange={(e) => setRoutineNote(e.target.value)}
            placeholder="What changed or was missed, and why (e.g. rain, no outdoor play)"
          />
        )}
      </fieldset>

      <Label className="mb-5 flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          4. Anything about a child&apos;s behaviour, mood or progress we should know? (optional)
        </span>
        <Textarea
          rows={2}
          value={childrenNote}
          onChange={(e) => setChildrenNote(e.target.value)}
          placeholder="e.g. a child was very tearful, or took their first steps on the balance beam"
        />
      </Label>

      <Label className="mb-5 flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          5. Does anything need attention — supplies, repairs, safety or a parent matter? (optional)
        </span>
        <Textarea
          rows={2}
          value={needsNote}
          onChange={(e) => setNeedsNote(e.target.value)}
          placeholder="e.g. we are running low on paint, the gate latch is loose"
        />
      </Label>

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
                  ? `Due from 12:00. ${missing} not sent yet.`
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
                {c.summary ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-sm text-brand">Read the report</summary>
                    <div className="mt-1">
                      <SummaryAnswer s={c.summary} />
                    </div>
                  </details>
                ) : (
                  <p className="text-sm text-muted-foreground">Not sent</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {c.incidents} incident report{c.incidents === 1 ? "" : "s"} that day
                  {c.summary ? ` · sent ${timeOf(c.summary.submittedAt)}` : ""}
                </p>
                {c.summary && (c.incidentsSince ?? 0) > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-danger">
                    {c.incidentsSince} incident report{c.incidentsSince === 1 ? "" : "s"} filed after this report was sent
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {c.summary ? (
                  <Badge variant={c.summary.anyoneHurt || c.summary.anyoneIll ? "danger" : "success"}>
                    {c.summary.anyoneHurt ? "Child hurt" : c.summary.anyoneIll ? "Child unwell" : "All fine"}
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
        title={isTeacher ? "Daily report" : "Daily reports"}
        description={
          isTeacher
            ? "Every school day from 12 noon: five quick questions about how the day went."
            : "Each class teacher answers five questions every weekday from 12 noon: injuries, illness, the routine, the children and anything that needs attention."
        }
      />
      {isTeacher ? <TeacherSummary organizationId={organizationId} /> : <AdminSummaries organizationId={organizationId} />}
    </div>
  );
}
