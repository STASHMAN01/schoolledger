"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../../OrgContext";
import { Card } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { formatDateZA } from "@/lib/date";

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
  const { organizationId, permissions, currencyCode } = useOrg();
  const params = useParams<{ eventId: string }>();
  const canManage = permissions.includes("MANAGE_EVENTS");

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/organizations/${organizationId}/events/${params.eventId}`
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) setEvent(data.event);
    else setError(data.error ?? "Couldn't load this event.");
    setLoading(false);
  }, [organizationId, params.eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function removeChild(childId: string) {
    const confirmed = await confirm({
      title: "Remove this child from the event?",
      description: "Their charge for this event will be deleted. This can't be undone.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!confirmed) return;
    setError(null);
    setRemovingId(childId);
    const res = await fetch(
      `/api/organizations/${organizationId}/events/${params.eventId}/children/${childId}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    setRemovingId(null);
    if (!res.ok) {
      setError(data.error ?? "Could not remove child.");
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!event) return <p className="text-sm text-danger">{error ?? "Not found."}</p>;

  return (
    <div className="animate-in">
      {confirmDialog}
      <Link
        href="/dashboard/accounting/events"
        className="transition-standard mb-4 inline-block text-sm text-muted-foreground underline hover:text-foreground"
      >
        ← All events
      </Link>
      <h1 className="font-display mb-1 text-2xl font-semibold text-foreground">{event.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {formatDateZA(event.eventDate)} ·{" "}
        {formatCents(event.amountCents, currencyCode)} per child ·{" "}
        {event.categories.map((c) => c.name).join(", ")}
      </p>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background text-left">
            <tr>
              <th className="px-3 py-2 text-muted-foreground">Child</th>
              <th className="px-3 py-2 text-muted-foreground">Due</th>
              <th className="px-3 py-2 text-muted-foreground">Paid</th>
              <th className="px-3 py-2 text-muted-foreground">Status</th>
              {canManage && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {event.entries.map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="px-3 py-2 text-foreground">
                  {entry.child.firstName} {entry.child.lastName}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {formatCents(entry.amountDueCents, currencyCode)}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {formatCents(entry.amountPaidCents, currencyCode)}
                </td>
                <td className="px-3 py-2 text-foreground">{entry.status}</td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    {entry.amountPaidCents === 0 ? (
                      <button
                        onClick={() => removeChild(entry.child.id)}
                        disabled={removingId === entry.child.id}
                        className="transition-standard text-xs text-danger underline disabled:opacity-50"
                      >
                        {removingId === entry.child.id ? "Removing..." : "Remove"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">Paid — can&apos;t remove</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {event.entries.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No children were charged for this event.
        </p>
      )}
    </div>
  );
}
