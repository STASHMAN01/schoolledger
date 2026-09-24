"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { todayLocal, formatDateZA } from "@/lib/date";

type Category = { id: string; name: string; archived: boolean };
type EventRow = {
  id: string;
  name: string;
  eventDate: string;
  amountCents: number;
  categories: { id: string; name: string }[];
  childCount: number;
  totalDueCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
};

// A function, not a constant, so the default date is today *now* -- a
// module-level constant froze it at page load (final inspection B3).
const emptyForm = () => ({
  name: "",
  date: todayLocal(),
  amount: "",
  categoryIds: [] as string[],
});

export default function EventsPage() {
  const { organizationId, permissions, currencyCode } = useOrg();
  const canManage = permissions.includes("MANAGE_EVENTS");

  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const res = await fetch(`/api/organizations/${organizationId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        date: form.date,
        amountCents: Math.round(Number(form.amount) * 100),
        categoryIds: form.categoryIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create event.");
      return;
    }
    setSuccess(`Created "${form.name}" — charged ${data.chargedChildCount} children.`);
    setForm(emptyForm());
    await load();
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Events"
        description="A one-time charge applied to every active child in one or more classes — a trip, a fundraiser, anything outside the regular monthly fee. Once created, you can remove an individual child from the charge if they're not attending (as long as they haven't paid anything toward it yet)."
      />

      {canManage && (
        <Card as="div" className="mb-8 p-4">
          <form onSubmit={createEvent} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Label className="flex flex-col gap-1">
              Name
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. September Trip"
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Date
              <Input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Amount per child
              <Input
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                inputMode="decimal"
                placeholder="e.g. 750"
              />
            </Label>
            <fieldset className="flex flex-col gap-1 text-sm">
              <legend className="mb-1 font-medium text-muted-foreground">Applies to</legend>
              <div className="flex flex-wrap gap-3">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-foreground">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
                {categories.length === 0 && (
                  <span className="text-muted-foreground">No classes yet.</span>
                )}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || form.categoryIds.length === 0}>
                {submitting ? "Creating..." : "Create event"}
              </Button>
            </div>
          </form>
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
                  <td className="px-3 py-2 text-foreground">{e.childCount}</td>
                  <td className="px-3 py-2 text-foreground">
                    {formatCents(e.totalPaidCents, currencyCode)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {formatCents(e.totalOutstandingCents, currencyCode)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/dashboard/accounting/events/${e.id}`}
                      className="transition-standard text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      View
                    </Link>
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
