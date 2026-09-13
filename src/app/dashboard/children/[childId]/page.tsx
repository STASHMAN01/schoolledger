"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../OrgContext";

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
  PAID: "text-green-700",
  PARTIALLY_PAID: "text-amber-700",
  OUTSTANDING: "text-red-700",
  UPCOMING: "text-neutral-500",
  CANCELLED: "text-neutral-400 line-through",
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

  if (loading) return <p className="text-sm text-neutral-500">Loading...</p>;
  if (!child) return <p className="text-sm text-neutral-500">Not found.</p>;

  const totalDue = child.planEntries.reduce((sum, e) => sum + e.amountDueCents, 0);
  const totalPaid = child.planEntries.reduce((sum, e) => sum + e.amountPaidCents, 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div>
      <Link href="/dashboard/children" className="text-sm text-neutral-500 underline">
        &larr; Back to children
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">
        {child.firstName} {child.lastName}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        {child.category.name} · Parent/guardian: {child.parentName}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Total outstanding</p>
          <p className="text-xl font-semibold">R{(outstanding / 100).toFixed(2)}</p>
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Total paid</p>
          <p className="text-xl font-semibold">R{(totalPaid / 100).toFixed(2)}</p>
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Credit balance</p>
          <p className="text-xl font-semibold">
            R{((child.creditBalance?.amountCents ?? 0) / 100).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded border border-neutral-200 p-4">
        <label className="flex flex-col gap-1 text-sm">
          Statement year
          <input
            type="number"
            className="w-28 rounded border border-neutral-300 px-3 py-2"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        {siblings.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 text-neutral-500">
              Same surname found — include in a joint statement?
            </p>
            {siblings.map((s) => (
              <label key={s.id} className="mr-4 inline-flex items-center gap-1">
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
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          View / download statement (PDF)
        </a>
      </div>

      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {child.planEntries.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  {e.month ? `${e.year}-${String(e.month).padStart(2, "0")}` : e.year}
                </td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2">R{(e.amountDueCents / 100).toFixed(2)}</td>
                <td className="px-3 py-2">R{(e.amountPaidCents / 100).toFixed(2)}</td>
                <td className={`px-3 py-2 ${statusColor[e.status] ?? ""}`}>
                  {e.status.replace("_", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
