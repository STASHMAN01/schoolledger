"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { EventForm } from "../../EventForm";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { formatDateZA } from "@/lib/date";

type Category = { id: string; name: string; archived: boolean };
type EventRow = {
  id: string;
  name: string;
  eventDate: string;
  isPaid: boolean;
  amountCents: number | null;
  categories: { id: string; name: string }[];
  childCount: number;
  totalDueCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
};

export default function EventsPage() {
  const { organizationId, permissions, currencyCode } = useOrg();
  const canManage = permissions.includes("MANAGE_EVENTS");
  const canSeeMoney = permissions.includes("VIEW_MONEY");

  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, eventRes] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/categories`),
      fetch(`/api/organizations/${organizationId}/events`),
    ]);
    const [catData, eventData] = await Promise.all([catRes.json().catch(() => ({})), eventRes.json().catch(() => ({}))]);
    if (catRes.ok) setCategories(catData.categories.filter((c: Category) => !c.archived));
    if (eventRes.ok) setEvents(eventData.events);
    else setError(eventData.error ?? "Couldn't load events.");
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Events"
        description="A one-time calendar entry for a trip, fundraiser or anything outside the regular monthly fee — optionally with a fee, charged to every active child in one or more classes. Once created, you can remove an individual child from a paid event's charge if they're not attending (as long as they haven't paid anything toward it yet)."
      />

      {canManage && (
        <Card as="div" className="mb-8 p-4">
          <EventForm
            organizationId={organizationId}
            categories={categories}
            canSeeMoney={canSeeMoney}
            onCreated={({ name, isPaid, chargedChildCount }) => {
              setSuccess(
                isPaid ? `Created "${name}" — charged ${chargedChildCount} children.` : `Created "${name}" as a free event.`
              );
              setError(null);
              load();
            }}
          />
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {success && <p className="mb-4 text-sm text-success">{success}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <EmptyState title="No events yet" description="Create your first event above." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-left">
              <tr>
                <th className="px-3 py-2 text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-muted-foreground">Classes</th>
                <th className="px-3 py-2 text-muted-foreground">Children</th>
                <th className="px-3 py-2 text-muted-foreground">Collected</th>
                <th className="px-3 py-2 text-muted-foreground">Outstanding</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{e.name}</td>
                  <td className="px-3 py-2 text-foreground">
                    {formatDateZA(e.eventDate)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {e.categories.map((c) => c.name).join(", ")}
                  </td>
                  {e.isPaid ? (
                    <>
                      <td className="px-3 py-2 text-foreground">{e.childCount}</td>
                      <td className="px-3 py-2 text-foreground">
                        {formatCents(e.totalPaidCents, currencyCode)}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {formatCents(e.totalOutstandingCents, currencyCode)}
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                      <Badge>Free event</Badge>
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    {e.isPaid && (
                      <Link
                        href={`/dashboard/accounting/events/${e.id}`}
                        className="transition-standard text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
