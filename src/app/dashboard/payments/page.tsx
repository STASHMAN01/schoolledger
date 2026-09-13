"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../OrgContext";

type Category = { id: string; name: string };
type Child = { id: string; firstName: string; lastName: string; categoryId: string };
type PaymentType = { id: string; name: string; isRecurring: boolean };
type Payment = {
  id: string;
  amountCents: number;
  method: string;
  date: string;
  reference: string | null;
  child: { id: string; firstName: string; lastName: string };
  recordedBy: { id: string; name: string };
  receipt: { number: string } | null;
};

const emptyForm = {
  categoryId: "",
  childId: "",
  paymentTypeId: "",
  amount: "",
  method: "EFT",
  date: new Date().toISOString().slice(0, 10),
  reference: "",
  notes: "",
};

export default function PaymentsPage() {
  const { organizationId, role } = useOrg();
  const canRecord = role === "ADMIN" || role === "ACCOUNTANT";

  const [categories, setCategories] = useState<Category[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [filterMethod, setFilterMethod] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterChild, setFilterChild] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLookups = useCallback(async () => {
    const [catRes, childRes, typeRes] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/categories`),
      fetch(`/api/organizations/${organizationId}/children`),
      fetch(`/api/organizations/${organizationId}/payment-types`),
    ]);
    const [catData, childData, typeData] = await Promise.all([
      catRes.json(),
      childRes.json(),
      typeRes.json(),
    ]);
    if (catRes.ok) setCategories(catData.categories.filter((c: { archived: boolean }) => !c.archived));
    if (childRes.ok) setChildren(childData.children);
    if (typeRes.ok)
      setPaymentTypes(typeData.paymentTypes.filter((t: { active: boolean }) => t.active));
  }, [organizationId]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterMethod) params.set("method", filterMethod);
    if (filterCategory) params.set("categoryId", filterCategory);
    if (filterChild) params.set("childId", filterChild);
    const res = await fetch(
      `/api/organizations/${organizationId}/payments?${params.toString()}`
    );
    const data = await res.json();
    if (res.ok) setPayments(data.payments);
    setLoading(false);
  }, [organizationId, filterMethod, filterCategory, filterChild]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when filters change
    loadPayments();
  }, [loadPayments]);

  const childrenInCategory = form.categoryId
    ? children.filter((c) => c.categoryId === form.categoryId)
    : children;

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/organizations/${organizationId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: form.childId,
        amountCents: Math.round(Number(form.amount) * 100),
        method: form.method,
        date: form.date,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        paymentTypeId: form.paymentTypeId || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not record payment.");
      return;
    }
    setSuccess(
      `Recorded. Receipt ${data.receipt.number}.` +
        (data.remainingCents > 0
          ? ` R${(data.remainingCents / 100).toFixed(2)} went to credit balance.`
          : "")
    );
    setForm({ ...emptyForm, categoryId: form.categoryId });
    await loadPayments();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Payments</h1>

      {canRecord && (
        <form
          onSubmit={recordPayment}
          className="mb-8 grid grid-cols-1 gap-3 rounded border border-neutral-200 p-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.categoryId}
              onChange={(e) =>
                setForm({ ...form, categoryId: e.target.value, childId: "" })
              }
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Child
            <select
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.childId}
              onChange={(e) => setForm({ ...form, childId: e.target.value })}
            >
              <option value="">Select a child...</option>
              {childrenInCategory.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Payment type (leave blank for general school fees)
            <select
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.paymentTypeId}
              onChange={(e) => setForm({ ...form, paymentTypeId: e.target.value })}
            >
              <option value="">General (oldest-first allocation)</option>
              {paymentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Amount
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              inputMode="decimal"
              placeholder="e.g. 1400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Method
            <select
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
            >
              <option value="CASH">Cash</option>
              <option value="EFT">EFT</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
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
            Reference
            <input
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Notes
            <input
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
              Record payment
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-700">{success}</p>}

      <h2 className="mb-3 text-lg font-medium">Payment history</h2>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
        >
          <option value="">All methods</option>
          <option value="CASH">Cash</option>
          <option value="EFT">EFT</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          value={filterChild}
          onChange={(e) => setFilterChild(e.target.value)}
        >
          <option value="">All children</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-neutral-500">No payments found.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Child</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Receipt</th>
                <th className="px-3 py-2">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {p.child.firstName} {p.child.lastName}
                  </td>
                  <td className="px-3 py-2">R{(p.amountCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2">{p.method}</td>
                  <td className="px-3 py-2">{p.receipt?.number ?? "-"}</td>
                  <td className="px-3 py-2">{p.recordedBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
