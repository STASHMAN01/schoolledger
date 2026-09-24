"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Input, Label, LinkButton, PageHeader, Select } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { DeletionControl, type DeletionRequestInfo } from "@/components/DeletionControl";
import { todayLocal } from "@/lib/date";

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
  deletionRequest: DeletionRequestInfo | null;
};

// A function, not a constant, so the default date is today *now* -- a
// module-level constant froze it at page load (final inspection B3).
const emptyForm = () => ({
  categoryId: "",
  childId: "",
  paymentTypeId: "",
  amount: "",
  method: "EFT",
  date: todayLocal(),
  reference: "",
  notes: "",
});

export default function PaymentsPage() {
  const { organizationId, permissions, currencyCode } = useOrg();
  const canRecord = permissions.includes("RECORD_PAYMENTS");
  const canRequestDeletion = permissions.includes("VIEW_MONEY");
  const isAdmin = permissions.includes("APPROVE_DELETION");
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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
      catRes.json().catch(() => ({})),
      childRes.json().catch(() => ({})),
      typeRes.json().catch(() => ({})),
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
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPayments(data.payments);
    else setError(data.error ?? "Couldn't load payments.");
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not record payment.");
      return;
    }
    setSuccess(
      `Recorded. Receipt ${data.receipt.number}.` +
        (data.remainingCents > 0
          ? ` ${formatCents(data.remainingCents, currencyCode)} went to credit balance.`
          : "")
    );
    setForm({ ...emptyForm(), categoryId: form.categoryId });
    await loadPayments();
  }

  if (!canRequestDeletion) {
    // canRequestDeletion === permissions.includes("VIEW_MONEY") here --
    // reused rather than a third boolean, since "can see payment amounts"
    // is exactly the gate for this whole page.
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to view payments. Ask an admin.
      </p>
    );
  }

  return (
    <div className="animate-in">
      {confirmDialog}
      <PageHeader title="Payments" />

      {canRecord && (
        <Card as="div" className="mb-8 p-4">
          <form
            onSubmit={recordPayment}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <Label className="flex flex-col gap-1">
              Class
              <Select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value, childId: "" })
                }
              >
                <option value="">All classes</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="flex flex-col gap-1">
              Child
              <Select
                required
                value={form.childId}
                onChange={(e) => setForm({ ...form, childId: e.target.value })}
              >
                <option value="">Select a child...</option>
                {childrenInCategory.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="flex flex-col gap-1">
              Payment type (leave blank for general school fees)
              <Select
                value={form.paymentTypeId}
                onChange={(e) => setForm({ ...form, paymentTypeId: e.target.value })}
              >
                <option value="">General (oldest-first allocation)</option>
                {paymentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="flex flex-col gap-1">
              Amount
              <Input
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                inputMode="decimal"
                placeholder="e.g. 1400"
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Method
              <Select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="CASH">Cash</option>
                <option value="EFT">EFT</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </Select>
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
              Reference
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1 sm:col-span-2">
              Notes
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Label>
            <div className="sm:col-span-2">
              <Button type="submit">Record payment</Button>
            </div>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {success && <p className="mb-4 text-sm text-success">{success}</p>}

      <h2 className="font-display mb-3 text-lg font-medium text-foreground">Payment history</h2>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          className="w-auto"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
        >
          <option value="">All methods</option>
          <option value="CASH">Cash</option>
          <option value="EFT">EFT</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </Select>
        <Select
          className="w-auto"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All classes</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-auto"
          value={filterChild}
          onChange={(e) => setFilterChild(e.target.value)}
        >
          <option value="">All children</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </Select>
        <LinkButton
          variant="secondary"
          size="sm"
          href={`/api/organizations/${organizationId}/payments/export?${new URLSearchParams(
            {
              ...(filterMethod ? { method: filterMethod } : {}),
              ...(filterCategory ? { categoryId: filterCategory } : {}),
              ...(filterChild ? { childId: filterChild } : {}),
            }
          ).toString()}`}
        >
          Export CSV
        </LinkButton>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments found.</p>
      ) : (
        <Card as="div" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-left">
              <tr>
                <th className="px-3 py-2 text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-muted-foreground">Child</th>
                <th className="px-3 py-2 text-muted-foreground">Amount</th>
                <th className="px-3 py-2 text-muted-foreground">Method</th>
                <th className="px-3 py-2 text-muted-foreground">Receipt</th>
                <th className="px-3 py-2 text-muted-foreground">Recorded by</th>
                <th className="px-3 py-2 text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-foreground">
                    {p.child.firstName} {p.child.lastName}
                  </td>
                  <td className="px-3 py-2 text-foreground">{formatCents(p.amountCents, currencyCode)}</td>
                  <td className="px-3 py-2 text-foreground">{p.method}</td>
                  <td className="px-3 py-2 text-foreground">{p.receipt?.number ?? "-"}</td>
                  <td className="px-3 py-2 text-foreground">{p.recordedBy.name}</td>
                  <td className="px-3 py-2 text-right">
                    <DeletionControl
                      organizationId={organizationId}
                      targetType="PAYMENT"
                      targetId={p.id}
                      targetLabel={`${formatCents(p.amountCents, currencyCode)} payment for ${p.child.firstName} ${p.child.lastName}`}
                      deletionRequest={p.deletionRequest}
                      canRequest={canRequestDeletion}
                      isAdmin={isAdmin}
                      onChanged={loadPayments}
                      confirm={confirm}
                    />
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
