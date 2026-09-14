"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";

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
    return <p className="text-sm text-muted-foreground">Only an admin can manage payment types.</p>;
  }

  return (
    <div className="animate-in">
      <PageHeader title="Payment types" />

      <Card className="mb-8 p-4">
        <form onSubmit={addType} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pt-name">Name</Label>
            <Input
              id="pt-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stationery"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recurring monthly
          </label>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pt-amount">Default amount (one-time types)</Label>
            <Input
              id="pt-amount"
              className="w-40"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              placeholder="e.g. 500"
              inputMode="decimal"
              disabled={isRecurring}
            />
          </div>
          <Button type="submit">Add payment type</Button>
        </form>
      </Card>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Default amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {types.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-foreground">{t.name}</td>
                  <td className="px-3 py-2 text-foreground">
                    {t.isRecurring ? "Recurring" : "One-time"}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {t.defaultAmountCents !== null
                      ? `R${(t.defaultAmountCents / 100).toFixed(2)}`
                      : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={t.active ? "success" : "neutral"}>
                      {t.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(t)}>
                      {t.active ? "Deactivate" : "Reactivate"}
                    </Button>
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
