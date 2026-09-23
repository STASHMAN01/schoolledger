"use client";

// Centre Management > Events (Dylan's mock-up, 23 Sept): what's coming up
// and which classes it's for. Read-only and money-free -- events are
// created (and charged) under Accounting > Events; people who can see money
// get a link through to that page.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { todayLocal } from "@/lib/date";

type UpcomingEvent = { id: string; name: string; eventDate: string; classes: string[] };

export default function CentreEventsPage() {
  const { organizationId, permissions } = useOrg();
  const canOpen = permissions.includes("VIEW_MONEY") && permissions.includes("VIEW_ACCOUNTING");
  const canCreate = canOpen && permissions.includes("MANAGE_EVENTS");
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/events/upcoming?from=${todayLocal()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      } else setError(data.error ?? "Couldn't load events.");
    } catch {
      setError("Couldn't load events — check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Upcoming events"
        description={canCreate ? "Add or change events under Accounting → Events." : "Outings, concerts and other upcoming events."}
      />
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <EmptyState title="Nothing coming up" description="Upcoming events will show here." />
      ) : (
        <Card as="div" className="divide-y divide-border">
          {events.map((e) => {
            const when = new Date(e.eventDate).toLocaleDateString("en-ZA", {
              weekday: "short",
              day: "numeric",
              month: "long",
            });
            const body = (
              <>
                <div className="w-32 shrink-0 text-sm font-medium text-foreground">{when}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.classes.length > 0 ? e.classes.join(", ") : "All classes"}
                  </p>
                </div>
              </>
            );
            return canOpen ? (
              <Link
                key={e.id}
                href={`/dashboard/accounting/events/${e.id}`}
                className="transition-standard flex min-h-11 flex-wrap items-center gap-3 p-4 hover:bg-background"
              >
                {body}
              </Link>
            ) : (
              <div key={e.id} className="flex min-h-11 flex-wrap items-center gap-3 p-4">
                {body}
              </div>
            );
          })}
          {total > events.length && (
            <p className="p-4 text-xs text-muted-foreground">
              Showing the next {events.length} of {total}.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
