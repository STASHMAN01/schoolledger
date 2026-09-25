"use client";

// "Edit details" for a child after they were added (Dylan, 25 Sept): name,
// class, start and leaving dates, the child's own monthly fee (money roles
// only) and ID numbers. Used on BOTH the Accounting child page and the
// Centre profile -- it's one child record, so a change here shows on both.
//
// Changes that affect fees (class, own fee, dates) are previewed first:
// the server says how many unpaid monthly charges would be repriced,
// cancelled or brought back (lib/billing/planAdjust.ts), and nothing is
// saved until the person confirms. Paid and part-paid months never change.
import { useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";

export type EditableChild = {
  id: string;
  firstName: string;
  lastName: string;
  categoryId: string;
  enrollmentDate: string;
  exitDate: string | null;
  feeOverrideCents?: number | null;
  childIdNumber?: string | null;
  parentIdNumber?: string | null;
};

type Preview = {
  repriced: number;
  cancelled: number;
  restored: number;
  feeChanged: boolean;
  oldFeeCents?: number;
  newFeeCents?: number;
};

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function EditChildDetails({
  organizationId,
  child,
  canViewMoney,
  canChangeDates,
  currencyCode,
  onSaved,
}: {
  organizationId: string;
  child: EditableChild;
  canViewMoney: boolean;
  /** Class and start/leaving dates decide what's billed: office roles
   *  only, not teachers (the server enforces this too). */
  canChangeDates: boolean;
  currencyCode: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState(() => initial(child));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ patch: Record<string, unknown>; result: Preview } | null>(null);
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  function initial(c: EditableChild) {
    return {
      firstName: c.firstName,
      lastName: c.lastName,
      categoryId: c.categoryId,
      enrollmentDate: dateOnly(c.enrollmentDate),
      exitDate: dateOnly(c.exitDate),
      fee: c.feeOverrideCents != null ? String(c.feeOverrideCents / 100) : "",
      childIdNumber: "",
      parentIdNumber: "",
    };
  }

  async function openForm() {
    setF(initial(child));
    setError(null);
    setPreview(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/categories`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setClasses(
          (data.categories as { id: string; name: string; archived: boolean }[]).filter(
            (c) => !c.archived || c.id === child.categoryId
          )
        );
      } else {
        setError(data.error ?? "Couldn't load your classes.");
      }
    } catch {
      setError("Couldn't load your classes — check your connection.");
    }
  }

  /** Only the fields that actually changed. */
  function buildPatch(): Record<string, unknown> | string {
    const p: Record<string, unknown> = {};
    if (!f.firstName.trim() || !f.lastName.trim()) return "The child's first name and surname can't be empty.";
    if (f.firstName.trim() !== child.firstName) p.firstName = f.firstName.trim();
    if (f.lastName.trim() !== child.lastName) p.lastName = f.lastName.trim();
    if (canChangeDates) {
      if (f.categoryId !== child.categoryId) p.categoryId = f.categoryId;
      if (!f.enrollmentDate) return "Please add a start date.";
      if (f.enrollmentDate !== dateOnly(child.enrollmentDate)) p.enrollmentDate = f.enrollmentDate;
      if (f.exitDate !== dateOnly(child.exitDate)) p.exitDate = f.exitDate || null;
      if (f.exitDate && f.exitDate < f.enrollmentDate) return "The leaving date can't be before the start date.";
    }
    if (canViewMoney) {
      const current = child.feeOverrideCents ?? null;
      let next: number | null = null;
      if (f.fee.trim()) {
        const rand = Number(f.fee.replace(/[^\d.]/g, ""));
        if (Number.isNaN(rand) || rand < 0) return "The fee must be an amount in rand, e.g. 1500 — or leave it blank to use the class fee.";
        next = Math.round(rand * 100);
      }
      if (next !== current) p.feeOverrideCents = next;
    }
    if (f.childIdNumber.trim()) p.childIdNumber = f.childIdNumber.trim();
    if (f.parentIdNumber.trim()) p.parentIdNumber = f.parentIdNumber.trim();
    return p;
  }

  async function send(patch: Record<string, unknown>, previewOnly: boolean) {
    const res = await fetch(
      `/api/organizations/${organizationId}/children/${child.id}${previewOnly ? "?preview=1" : ""}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const firstIssue = data?.issues?.fieldErrors
        ? Object.entries(data.issues.fieldErrors as Record<string, string[]>)[0]
        : null;
      throw new Error(firstIssue ? `${firstIssue[0]}: ${firstIssue[1][0]}` : data.error ?? "Those changes couldn't be saved. Please try again.");
    }
    return data;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const patch = buildPatch();
    if (typeof patch === "string") {
      setError(patch);
      return;
    }
    if (Object.keys(patch).length === 0) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const affectsFees = ["categoryId", "enrollmentDate", "exitDate", "feeOverrideCents"].some((k) => k in patch);
      if (affectsFees) {
        const { preview: result } = (await send(patch, true)) as { preview: Preview };
        if (result.repriced + result.cancelled + result.restored > 0) {
          setPreview({ patch, result });
          return;
        }
      }
      await send(patch, false);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those changes couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSave() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      await send(preview.patch, false);
      setPreview(null);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those changes couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={openForm}>
        Edit details
      </Button>
    );
  }

  const money = (c?: number) => (c === undefined ? "" : formatCents(c, currencyCode));

  return (
    <Card as="div" className="mb-6 w-full p-5">
      {preview ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-base font-semibold text-foreground">Check the fee changes</h2>
          <ul className="list-disc pl-5 text-sm text-foreground">
            {preview.result.repriced > 0 && (
              <li>
                {preview.result.repriced} unpaid monthly charge{preview.result.repriced === 1 ? "" : "s"} from this
                month on will change
                {preview.result.oldFeeCents !== undefined && preview.result.newFeeCents !== undefined
                  ? ` from ${money(preview.result.oldFeeCents)} to ${money(preview.result.newFeeCents)}`
                  : " to the new class fee"}
                .
              </li>
            )}
            {preview.result.cancelled > 0 && (
              <li>
                {preview.result.cancelled} unpaid month{preview.result.cancelled === 1 ? "" : "s"} outside the new
                dates will be cancelled.
              </li>
            )}
            {preview.result.restored > 0 && (
              <li>
                {preview.result.restored} cancelled month{preview.result.restored === 1 ? "" : "s"} inside the new
                dates will be charged again.
              </li>
            )}
          </ul>
          <p className="text-xs text-muted-foreground">
            Paid and part-paid months, earlier months, registration and event charges are never changed.
          </p>
          {error && <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirmSave} disabled={saving}>
              {saving ? "Saving…" : "Yes, save these changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPreview(null)} disabled={saving}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">Edit details</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" id="ed-first">
              <Input id="ed-first" value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} />
            </Field>
            <Field label="Surname" id="ed-last">
              <Input id="ed-last" value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} />
            </Field>
            {canChangeDates && (
              <Field label="Class" id="ed-class">
                <Select id="ed-class" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  {classes.length === 0 && <option value={child.categoryId}>Loading…</option>}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {canViewMoney && (
              <Field label="Own monthly fee (R) — blank uses the class fee" id="ed-fee">
                <Input
                  id="ed-fee"
                  inputMode="decimal"
                  placeholder="Class fee"
                  value={f.fee}
                  onChange={(e) => set({ fee: e.target.value })}
                />
              </Field>
            )}
            {canChangeDates && (
              <>
                <Field label="Start date" id="ed-start">
                  <Input
                    id="ed-start"
                    type="date"
                    value={f.enrollmentDate}
                    onChange={(e) => set({ enrollmentDate: e.target.value })}
                  />
                </Field>
                <Field label="Leaving date (blank if still here)" id="ed-exit">
                  <div className="flex gap-2">
                    <Input
                      id="ed-exit"
                      type="date"
                      value={f.exitDate}
                      onChange={(e) => set({ exitDate: e.target.value })}
                    />
                    {f.exitDate && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => set({ exitDate: "" })}>
                        Clear
                      </Button>
                    )}
                  </div>
                </Field>
              </>
            )}
            <Field label="Child's ID / birth certificate number" id="ed-cid">
              <Input
                id="ed-cid"
                autoComplete="off"
                placeholder={child.childIdNumber ? `On file: ${child.childIdNumber}` : "Not on file"}
                value={f.childIdNumber}
                onChange={(e) => set({ childIdNumber: e.target.value })}
              />
            </Field>
            <Field label="Parent's ID number" id="ed-pid">
              <Input
                id="ed-pid"
                autoComplete="off"
                placeholder={child.parentIdNumber ? `On file: ${child.parentIdNumber}` : "Not on file"}
                value={f.parentIdNumber}
                onChange={(e) => set({ parentIdNumber: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave the ID fields blank to keep what&apos;s on file, or type a new number to replace it. Changes show
            on both Centre Management and Accounting. Parent contact details are edited under the guardians on the
            child&apos;s Centre profile.
          </p>

          {error && <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Checking…" : "Save changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
