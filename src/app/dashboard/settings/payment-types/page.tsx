"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";

type PaymentType = {
  id: string;
  name: string;
  isRecurring: boolean;
  defaultAmountCents: number | null;
  active: boolean;
  isEventType: boolean;
};

export default function PaymentTypesPage() {
  const { organizationId, role } = useOrg();
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [defaultAmount, setDefaultAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/payment-types`);
    const data = await res.json();
    // Event-generated types (one dedicated type per Event, e.g. "September
    // Trip") are managed from the Events page instead — hide them here so
    // this list stays the small, admin-curated set (School Fees,
    // Registration, Uniform, ...) rather than growing by one row per event.
    if (res.ok) setTypes(data.paymentTypes.filter((t: PaymentType) => !t.isEventType));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/payment-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        isRecurring,
        defaultAmountCents:
          defaultAmount.trim() === "" ? null : Math.round(Number(defaultAmount) * 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add payment type.");
      return;
    }
    setName("");
    setIsRecurring(false);
    setDefaultAmount("");
    await load();
  }

  async function toggleActive(type: PaymentType) {
    setError(null);
    const res = await fetch(
      `/api/organizations/${organizationId}/payment-types/${type.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !type.active }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not update payment type.");
      return;
    }
    await load();
  }

  if (role !== "ADMIN") {
    return <p className="text-sm text-neutral-500">Only an admin can manage payment types.</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Payment types</h1>

      <form
        onSubmit={addType}
        className="mb-8 flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            required
            className="rounded border border-neutral-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Stationery"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
          Recurring monthly
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Default amount (one-time types)
          <input
            className="w-40 rounded border border-neutral-300 px-3 py-2"
            value={defaultAmount}
            onChange={(e) => setDefaultAmount(e.target.value)}
            placeholder="e.g. 500"
            inputMode="decimal"
            disabled={isRecurring}
          />
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
          Add payment type
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Default amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2">{t.isRecurring ? "Recurring" : "One-time"}</td>
                <td className="px-3 py-2">
                  {t.defaultAmountCents !== null
                    ? `R${(t.defaultAmountCents / 100).toFixed(2)}`
                    : "-"}
                </td>
                <td className="px-3 py-2">{t.active ? "Active" : "Inactive"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => toggleActive(t)}
                    className="text-xs text-neutral-500 underline"
                  >
                    {t.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
