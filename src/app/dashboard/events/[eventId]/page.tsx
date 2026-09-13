"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../OrgContext";

type Entry = {
  id: string;
  amountDueCents: number;
  amountPaidCents: number;
  status: string;
  child: { id: string; firstName: string; lastName: string };
};

type EventDetail = {
  id: string;
  name: string;
  eventDate: string;
  amountCents: number;
  categories: { id: string; name: string }[];
  entries: Entry[];
};

export default function EventDetailPage() {
  const { organizationId, role } = useOrg();
  const params = useParams<{ eventId: string }>();
  const canManage = role === "ADMIN" || role === "ACCOUNTANT";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/organizations/${organizationId}/events/${params.eventId}`
    );
    const data = await res.json();
    if (res.ok) setEvent(data.event);
    else setError(data.error ?? "Could not load event.");
    setLoading(false);
  }, [organizationId, params.eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function removeChild(childId: string) {
    if (!confirm("Remove this child from the event? Their charge will be deleted.")) return;
    setError(null);
    setRemovingId(childId);
    const res = await fetch(
      `/api/organizations/${organizationId}/events/${params.eventId}/children/${childId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    setRemovingId(null);
    if (!res.ok) {
      setError(data.error ?? "Could not remove child.");
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading...</p>;
  if (!event) return <p className="text-sm text-red-600">{error ?? "Not found."}</p>;

  return (
    <div>
      <Link href="/dashboard/events" className="mb-4 inline-block text-sm underline">
        ← All events
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">{event.name}</h1>
      <p className="mb-6 text-sm text-neutral-600">
        {new Date(event.eventDate).toLocaleDateString()} · R
        {(event.amountCents / 100).toFixed(2)} per child ·{" "}
        {event.categories.map((c) => c.name).join(", ")}
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left">
          <tr>
            <th className="px-3 py-2">Child</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Paid</th>
            <th className="px-3 py-2">Status</th>
            {canManage && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {event.entries.map((entry) => (
            <tr key={entry.id} className="border-t border-neutral-100">
              <td className="px-3 py-2">
                {entry.child.firstName} {entry.child.lastName}
              </td>
              <td className="px-3 py-2">R{(entry.amountDueCents / 100).toFixed(2)}</td>
              <td className="px-3 py-2">R{(entry.amountPaidCents / 100).toFixed(2)}</td>
              <td className="px-3 py-2">{entry.status}</td>
              {canManage && (
                <td className="px-3 py-2 text-right">
                  {entry.amountPaidCents === 0 ? (
                    <button
                      onClick={() => removeChild(entry.child.id)}
                      disabled={removingId === entry.child.id}
                      className="text-xs text-red-600 underline disabled:opacity-50"
                    >
                      {removingId === entry.child.id ? "Removing..." : "Remove"}
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-400">Paid — can&apos;t remove</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {event.entries.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No children were charged for this event.</p>
      )}
    </div>
  );
}
