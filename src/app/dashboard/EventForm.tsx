"use client";

// Shared "create an event" form for Accounting > Events and Centre
// Management > Events (Dylan, 25 Sept): a date picker, which classes it
// applies to, and a "this event has a fee" tick box. Unticked, it's just a
// calendar entry -- no PaymentType, no charge, no Accounting footprint at
// all. Ticked, an amount is required and every active child in the
// selected classes is charged, same as before this was optional. The fee
// tick box (and amount field) only render for someone with VIEW_MONEY --
// entering an amount is money, whichever mode the form is shown in.
import { useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { todayLocal } from "@/lib/date";

type Category = { id: string; name: string };

// A function, not a constant, so the default date is today *now* -- a
// module-level constant froze it at page load (final inspection B3).
const emptyForm = () => ({
  name: "",
  date: todayLocal(),
  isPaid: false,
  amount: "",
  categoryIds: [] as string[],
});

export function EventForm({
  organizationId,
  categories,
  canSeeMoney,
  onCreated,
}: {
  organizationId: string;
  categories: Category[];
  canSeeMoney: boolean;
  onCreated: (result: { name: string; isPaid: boolean; chargedChildCount: number }) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const isPaid = canSeeMoney && form.isPaid;
    const res = await fetch(`/api/organizations/${organizationId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        date: form.date,
        isPaid,
        ...(isPaid ? { amountCents: Math.round(Number(form.amount) * 100) } : {}),
        categoryIds: form.categoryIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create event.");
      return;
    }
    onCreated({ name: form.name, isPaid, chargedChildCount: data.chargedChildCount ?? 0 });
    setForm(emptyForm());
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      {canSeeMoney && (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isPaid}
              onChange={(e) => setForm({ ...form, isPaid: e.target.checked, amount: e.target.checked ? form.amount : "" })}
            />
            This event has a fee
          </label>
          {form.isPaid && (
            <Label className="flex max-w-xs flex-col gap-1">
              Amount per child
              <Input
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                inputMode="decimal"
                placeholder="e.g. 750"
              />
            </Label>
          )}
          {!form.isPaid && (
            <p className="text-xs text-muted-foreground">
              Free event — nothing is charged, and this never shows up in Accounting.
            </p>
          )}
        </div>
      )}

      <fieldset className="flex flex-col gap-1 text-sm sm:col-span-2">
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
          {categories.length === 0 && <span className="text-muted-foreground">No classes yet.</span>}
        </div>
      </fieldset>

      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={submitting || form.categoryIds.length === 0}>
          {submitting ? "Creating..." : "Create event"}
        </Button>
      </div>
    </form>
  );
}
