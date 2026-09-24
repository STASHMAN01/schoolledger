"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../../OrgContext";
import { Card, Input } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";

type Entry = {
  id: string;
  year: number;
  month: number | null;
  description: string;
  amountDueCents: number;
  amountPaidCents: number;
  status: string;
  paymentType: { name: string };
};

type ChildDetail = {
  id: string;
  firstName: string;
  lastName: string;
  parentName: string;
  category: { name: string };
  creditBalance: { amountCents: number } | null;
  planEntries: Entry[];
};

type SiblingCandidate = { id: string; firstName: string; lastName: string };

const statusColor: Record<string, string> = {
  PAID: "text-success",
  // M5: was "text-accent" — safe when --accent was amber (#d97706), but
  // --accent is now the logo's yellow (#fed503), which fails WCAG AA as
  // text on a light background (yellow-on-white is ~1.3:1). Using the
  // soft-foreground token instead, which is designed to be read as text.
  PARTIALLY_PAID: "text-accent-soft-foreground",
  OUTSTANDING: "text-danger",
  UPCOMING: "text-muted",
  CANCELLED: "text-muted line-through",
};

export default function ChildDetailPage() {
  const { organizationId, currencyCode, permissions } = useOrg();
  const canViewMoney = permissions.includes("VIEW_MONEY");
  const params = useParams<{ childId: string }>();
  const [child, setChild] = useState<ChildDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [siblings, setSiblings] = useState<SiblingCandidate[]>([]);
  const [selectedSiblingIds, setSelectedSiblingIds] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Feature-detect the Web Share API (files) rather than assuming — this is
  // the actual fix for "on the phone, after opening the PDF there's no
  // share/download button": instead of relying on whatever chrome the
  // phone's built-in PDF viewer happens to show (inconsistent across
  // browsers, and sometimes there's genuinely nothing), this button pulls
  // the PDF into the app itself and hands it to the OS's native share
  // sheet (Messages, WhatsApp, Mail, Save to Files, AirDrop, ...) directly.
  // Desktop browsers mostly don't support it, so it only renders when
  // canShare actually exists.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time feature detection on mount
    setCanShareFiles(
      typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/organizations/${organizationId}/children/${params.childId}`
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setChild(data.child);

      const allRes = await fetch(`/api/organizations/${organizationId}/children`);
      const allData = await allRes.json().catch(() => ({}));
      if (allRes.ok) {
        setSiblings(
          allData.children.filter(
            (c: SiblingCandidate & { id: string }) =>
              c.id !== params.childId &&
              c.lastName.toLowerCase() === data.child.lastName.toLowerCase()
          )
        );
      }
    } else if (res.status !== 404) {
      setLoadError(data.error ?? "This child's details couldn't be loaded. Please refresh the page.");
    }
    setLoading(false);
  }, [organizationId, params.childId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  function toggleSibling(id: string) {
    setSelectedSiblingIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  const statementUrl = `/api/organizations/${organizationId}/children/${params.childId}/statement?year=${year}${
    selectedSiblingIds.length ? `&siblingIds=${selectedSiblingIds.join(",")}` : ""
  }`;
  const downloadUrl = `${statementUrl}&download=1`;

  async function shareStatement() {
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        setShareError("Could not load the statement.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "statement.pdf";
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        setShareError("Sharing isn't supported on this device — use Download instead.");
      }
    } catch (err) {
      // The user cancelling the native share sheet throws an AbortError —
      // that's a normal outcome, not a failure worth showing an error for.
      if (err instanceof Error && err.name !== "AbortError") {
        setShareError("Could not share the statement.");
      }
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!child) {
    return loadError ? (
      <p className="text-sm text-danger">{loadError}</p>
    ) : (
      <p className="text-sm text-muted-foreground">Not found.</p>
    );
  }

  const totalDue = child.planEntries.reduce((sum, e) => sum + e.amountDueCents, 0);
  const totalPaid = child.planEntries.reduce((sum, e) => sum + e.amountPaidCents, 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div className="animate-in">
      <Link
        href="/dashboard/accounting/children"
        className="transition-standard text-sm text-muted-foreground underline hover:text-foreground"
      >
        &larr; Back to children
      </Link>
      <h1 className="font-display mt-2 mb-1 text-2xl font-semibold text-foreground">
        {child.firstName} {child.lastName}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {child.category.name} · Parent/guardian: {child.parentName}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total outstanding</p>
          <p className="font-display mt-1 text-xl font-semibold text-foreground">
            R{(outstanding / 100).toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total paid</p>
          <p className="font-display mt-1 text-xl font-semibold text-foreground">
            R{(totalPaid / 100).toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Credit balance</p>
          <p className="font-display mt-1 text-xl font-semibold text-foreground">
            R{((child.creditBalance?.amountCents ?? 0) / 100).toFixed(2)}
          </p>
        </Card>
      </div>

      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          Statement year
          <Input
            type="number"
            className="w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        {siblings.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 text-muted-foreground">
              Same surname found — include in a joint statement?
            </p>
            {siblings.map((s) => (
              <label key={s.id} className="mr-4 inline-flex items-center gap-1 text-foreground">
                <input
                  type="checkbox"
                  checked={selectedSiblingIds.includes(s.id)}
                  onChange={() => toggleSibling(s.id)}
                />
                {s.firstName} {s.lastName}
              </label>
            ))}
          </div>
        )}
        {canViewMoney && (
          <div className="flex flex-wrap gap-2">
            <a
              href={statementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
            >
              View statement
            </a>
            <a
              href={downloadUrl}
              download
              className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background"
            >
              Download PDF
            </a>
            {canShareFiles && (
              <button
                type="button"
                onClick={shareStatement}
                disabled={sharing}
                className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
              >
                {sharing ? "Preparing…" : "Share"}
              </button>
            )}
          </div>
        )}
        {shareError && <p className="w-full text-xs text-danger">{shareError}</p>}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background text-left">
            <tr>
              <th className="px-3 py-2 text-muted-foreground">Period</th>
              <th className="px-3 py-2 text-muted-foreground">Description</th>
              <th className="px-3 py-2 text-muted-foreground">Due</th>
              <th className="px-3 py-2 text-muted-foreground">Paid</th>
              <th className="px-3 py-2 text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {child.planEntries.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-3 py-2 text-foreground">
                  {e.month ? `${e.year}-${String(e.month).padStart(2, "0")}` : e.year}
                </td>
                <td className="px-3 py-2 text-foreground">{e.description}</td>
                <td className="px-3 py-2 text-foreground">{formatCents(e.amountDueCents, currencyCode)}</td>
                <td className="px-3 py-2 text-foreground">{formatCents(e.amountPaidCents, currencyCode)}</td>
                <td className={`px-3 py-2 ${statusColor[e.status] ?? ""}`}>
                  {e.status.replace("_", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
