"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Card, Input } from "@/components/ui";

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
  PARTIALLY_PAID: "text-accent",
  OUTSTANDING: "text-danger",
  UPCOMING: "text-muted",
  CANCELLED: "text-muted line-through",
};

export default function ChildDetailPage() {
  const { organizationId } = useOrg();
  const params = useParams<{ childId: string }>();
  const [child, setChild] = useState<ChildDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [siblings, setSiblings] = useState<SiblingCandidate[]>([]);
  const [selectedSiblingIds, setSelectedSiblingIds] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/organizations/${organizationId}/children/${params.childId}`
    );
    const data = await res.json();
    if (res.ok) {
      setChild(data.child);

      const allRes = await fetch(`/api/organizations/${organizationId}/children`);
      const allData = await allRes.json();
      if (allRes.ok) {
        setSiblings(
          allData.children.filter(
            (c: SiblingCandidate & { id: string }) =>
              c.id !== params.childId &&
              c.lastName.toLowerCase() === data.child.lastName.toLowerCase()
          )
        );
      }
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!child) return <p className="text-sm text-muted-foreground">Not found.</p>;

  const totalDue = child.planEntries.reduce((sum, e) => sum + e.amountDueCents, 0);
  const totalPaid = child.planEntries.reduce((sum, e) => sum + e.amountPaidCents, 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div className="animate-in">
      <Link
        href="/dashboard/children"
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
        <a
          href={statementUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
        >
          View / download statement (PDF)
        </a>
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
                <td className="px-3 py-2 text-foreground">R{(e.amountDueCents / 100).toFixed(2)}</td>
                <td className="px-3 py-2 text-foreground">R{(e.amountPaidCents / 100).toFixed(2)}</td>
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
