"use client";

// Attendance > Monthly register (Dylan, 15 Oct 2026): the office picks a
// class and a month, sees every child in that class against every school
// day (P / A, blank = register not taken), and downloads the same thing as
// the printable PDF that Files > Attendance registers has always opened.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Select } from "@/components/ui";
import { canShareFiles, sharePdfFromUrl } from "@/lib/sharePdf";

type Category = { id: string; name: string };
type Row = {
  childId: string;
  firstName: string;
  lastName: string;
  marks: Record<number, "P" | "A">;
  present: number;
  absent: number;
};
type MonthData = {
  className: string;
  month: string;
  days: number[];
  rows: Row[];
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];

/** This month and the 11 before it, newest first, as YYYY-MM. */
function recentMonths(today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function MonthlyRegister({
  organizationId,
  categories,
  categoryId,
  onCategoryChange,
}: {
  organizationId: string;
  categories: Category[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
}) {
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after mount
    setCanShare(canShareFiles());
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ categoryId, month });
      const res = await fetch(
        `/api/organizations/${organizationId}/attendance/register/month?${qs}`,
      );
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setData(null);
        setError(body.error ?? "Couldn't load the register. Please try again.");
        return;
      }
      setData(body as MonthData);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, categoryId, month]);

  const pdfUrl = (download: boolean) =>
    `/api/organizations/${organizationId}/attendance/register/pdf?${new URLSearchParams(
      {
        categoryId,
        month,
        ...(download ? { download: "1" } : {}),
      },
    )}`;

  async function share() {
    setSharing(true);
    setError("");
    const result = await sharePdfFromUrl(
      pdfUrl(true),
      "attendance-register.pdf",
    );
    setSharing(false);
    if (!result.ok && !result.cancelled) setError(result.message);
  }

  const [y, m] = month.split("-").map(Number);
  const weekday = (day: number) =>
    WEEKDAY_INITIAL[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];

  return (
    <div>
      <Card as="div" className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-40 flex-1 sm:flex-none">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Class
          </label>
          <Select
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {categories.length === 0 && (
              <option value="">No classes yet</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-40 flex-1 sm:flex-none">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Month
          </label>
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((k) => (
              <option key={k} value={k}>
                {monthName(k)}
              </option>
            ))}
          </Select>
        </div>
        {categoryId && (
          <div className="flex items-center gap-4">
            <a
              href={pdfUrl(true)}
              className="transition-standard inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover sm:min-h-0"
            >
              Download PDF
            </a>
            <a
              href={pdfUrl(false)}
              target="_blank"
              rel="noopener"
              className="text-sm font-medium text-brand hover:underline"
            >
              Open to print
            </a>
            {canShare && (
              <Button
                variant="secondary"
                size="sm"
                onClick={share}
                disabled={sharing}
              >
                {sharing ? "Preparing…" : "Share"}
              </Button>
            )}
          </div>
        )}
      </Card>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!categoryId ? (
        <EmptyState
          title="No class selected"
          description="Pick a class above to see its register."
        />
      ) : loading || !data ? (
        !error && <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState
          title="No children in this class"
          description={`${data.className} has no children for ${monthName(data.month)}.`}
        />
      ) : (
        <Card as="div" className="p-0">
          <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
            {data.className} · {monthName(data.month)} · {data.rows.length}{" "}
            children. P = present, A = absent, blank = register not taken.
          </p>
          {/* The grid scrolls sideways inside the card on phones; the name
              column stays put so you always know whose row it is. */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">
                    Child
                  </th>
                  {data.days.map((d) => (
                    <th
                      key={d}
                      className="min-w-7 px-1 py-2 text-center font-medium"
                    >
                      <span className="block">{weekday(d)}</span>
                      <span className="block text-foreground">{d}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium">P</th>
                  <th className="px-2 py-2 text-center font-medium">A</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.childId} className="border-t border-border">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2 font-medium text-foreground">
                      {r.firstName} {r.lastName}
                    </td>
                    {data.days.map((d) => {
                      const mark = r.marks[d];
                      return (
                        <td
                          key={d}
                          className={`px-1 py-2 text-center font-semibold ${
                            mark === "A"
                              ? "bg-danger/10 text-danger"
                              : mark === "P"
                                ? "text-success"
                                : ""
                          }`}
                        >
                          {mark ?? ""}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-foreground">
                      {r.present}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-foreground">
                      {r.absent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
