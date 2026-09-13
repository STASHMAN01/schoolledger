"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../OrgContext";

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

const emptyForm = {
  name: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  categoryIds: [] as string[],
};

export default function EventsPage() {
  const { organizationId, role } = useOrg();
  const canManage = role === "ADMIN" || role === "ACCOUNTANT";

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
    const [catData, eventData] = await Promise.all([catRes.json(), eventRes.json()]);
    if (catRes.ok) setCategories(catData.categories.filter((c: Category) => !c.archived));
    if (eventRes.ok) setEvents(eventData.events);
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
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create event.");
      return;
    }
    setSuccess(`Created "${form.name}" — charged ${data.chargedChildCount} children.`);
    setForm(emptyForm);
    await load();
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Events</h1>
      <p className="mb-6 text-sm text-neutral-600">
        A one-time charge applied to every active child in one or more classes —
        a trip, a fundraiser, anything outside the regular monthly fee. Once
        created, you can remove an individual child from the charge if they&apos;re
        not attending (as long as they haven&apos;t paid anything toward it yet).
      </p>

      {canManage && (
        <form
          onSubmit={createEvent}
          className="mb-8 grid grid-cols-1 gap-3 rounded border border-neutral-200 p-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. September Trip"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              required
              type="date"
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Amount per child
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              inputMode="decimal"
              placeholder="e.g. 750"
            />
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Applies to</legend>
            <div className="flex flex-wrap gap-3">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                  {c.name}
                </label>
              ))}
              {categories.length === 0 && (
                <span className="text-neutral-500">No categories yet.</span>
              )}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting || form.categoryIds.length === 0}
              className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create event"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-700">{success}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-neutral-500">No events yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Classes</th>
                <th className="px-3 py-2">Children</th>
                <th className="px-3 py-2">Collected</th>
                <th className="px-3 py-2">Outstanding</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2">{new Date(e.eventDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{e.categories.map((c) => c.name).join(", ")}</td>
                  <td className="px-3 py-2">{e.childCount}</td>
                  <td className="px-3 py-2">R{(e.totalPaidCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2">R{(e.totalOutstandingCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/dashboard/events/${e.id}`} className="text-xs underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
