"use client";

// Today's absent children + a one-tap "notify parents" action -- what the
// dashboard's Attendance tile's Absent count links into. Phase 3 Session
// 1, see docs/PLAN.md ("Absent = clickable list with notify-parents by
// email").
import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../../OrgContext";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type AbsentRow = {
  id: string;
  childId: string;
  firstName: string;
  lastName: string;
  className: string;
  hasParentEmail: boolean;
  notifiedAt: string | null;
};

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

export default function AbsentTodayPage() {
  const { organizationId, role } = useOrg();
  const isTeacher = role === "TEACHER";
  const [date] = useState(todayLocal);
  const [rows, setRows] = useState<AbsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/organizations/${organizationId}/attendance/absent?date=${date}`
    );
    const data = await res.json();
    if (res.ok) setRows(data.records);
    setLoading(false);
  }, [organizationId, date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  const notYetNotified = rows.filter((r) => !r.notifiedAt);
  const withEmail = notYetNotified.filter((r) => r.hasParentEmail);

  async function notifyAll() {
    setNotifying(true);
    setError("");
    setResult("");
    const res = await fetch(`/api/organizations/${organizationId}/attendance/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(
        `Emailed ${data.notifiedCount} ${data.notifiedCount === 1 ? "parent" : "parents"}` +
          (data.skippedNoEmailCount > 0
            ? ` — ${data.skippedNoEmailCount} skipped (no parent email on file)`
            : "") +
          (data.failedCount > 0 ? ` — ${data.failedCount} failed to send` : "")
      );
      await load();
    } else {
      setError(data.error ?? "Could not send notifications.");
    }
    setNotifying(false);
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Absent today"
        description={
          isTeacher
            ? "Children marked absent today in your class."
            : "Children marked absent today, across every class."
        }
        actions={
          <Button onClick={notifyAll} disabled={notifying || withEmail.length === 0} size="sm">
            {notifying
              ? "Sending…"
              : `Notify absent parents${withEmail.length > 0 ? ` (${withEmail.length})` : ""}`}
          </Button>
        }
      />

      {result && (
        <p className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          {result}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No one absent today"
          description="Once a register marks a child Absent, they'll show up here."
        />
      ) : (
        <Card as="div" className="p-2">
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.className}
                    {!r.hasParentEmail && " · no parent email on file"}
                  </p>
                </div>
                {r.notifiedAt ? (
                  <Badge variant="neutral">Notified</Badge>
                ) : (
                  <Badge variant="accent">Not notified</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
