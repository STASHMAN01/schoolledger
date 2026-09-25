"use client";

// Centre Management > Events (Dylan's mock-up, 23 Sept; event creation
// added 25 Sept): what's coming up and which classes it's for, plus a
// create form so a free event (a sports day, a photo day) never needs a
// trip through Accounting at all. A *paid* event still needs VIEW_MONEY --
// entering an amount is money wherever the form lives -- so the "this
// event has a fee" tick box and amount field only render for someone who
// has it (see EventForm). The per-child charge breakdown for a paid event
// still lives only in Accounting.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { EventForm } from "../../EventForm";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { todayLocal } from "@/lib/date";

type Category = { id: string; name: string; archived: boolean };
type UpcomingEvent = {
  id: string;
  name: string;
  eventDate: string;
  classes: string[];
  isPaid: boolean;
  amountCents?: number;
};

export default function CentreEventsPage() {
  const { organizationId, permissions } = useOrg();
  const canSeeMoney = permissions.includes("VIEW_MONEY");
  const canOpen = canSeeMoney && permissions.includes("VIEW_ACCOUNTING");
  const canCreate = permissions.includes("MANAGE_EVENTS");
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests = [fetch(`/api/organizations/${organizationId}/events/upcoming?from=${todayLocal()}`)];
      if (canCreate) requests.push(fetch(`/api/organizations/${organizationId}/categories`));
      const [eventRes, catRes] = await Promise.all(requests);
      const data = await eventRes.json().catch(() => ({}));
      if (eventRes.ok) {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      } else setError(data.error ?? "Couldn't load events.");
      if (catRes) {
        const catData = await catRes.json().catch(() => ({}));
        if (catRes.ok) setCategories((catData.categories ?? []).filter((c: Category) => !c.archived));
      }
    } catch {
      setError("Couldn't load events — check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, canCreate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Events"
        description="Outings, concerts, sports days and anything else coming up. Free by default -- tick 'this event has a fee' below only if it should charge children's accounts."
      />

      {canCreate && (
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{e.name}</p>
                    {!e.isPaid && <Badge>Free</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.classes.length > 0 ? e.classes.join(", ") : "All classes"}
                  </p>
                </div>
              </>
            );
            return canOpen && e.isPaid ? (
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
