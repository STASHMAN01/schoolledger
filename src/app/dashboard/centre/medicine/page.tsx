"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg, useHasPermission } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { ChildPicker, type PickableChild } from "@/components/ChildPicker";
import { Sheet } from "@/components/Sheet";
import { SignaturePad } from "@/components/SignaturePad";
import {
  DOSE_OUTCOMES,
  DOSE_OUTCOME_LABELS,
  RELATIONSHIPS,
  ROUTES,
  ROUTE_LABELS,
  STORAGE,
  STORAGE_LABELS,
  consentStatements,
} from "@/lib/medicine";

// Medicine register (Dylan, 5 Oct 2026). A parent brings medicine, staff fill
// in this form together with the parent, the parent signs on the tablet, and
// each dose given is recorded. Phones and tablets first: every form is a
// full-screen sheet with the buttons pinned to the bottom.

type Dose = {
  id: string;
  givenAt: string;
  outcome: string;
  doseGiven: string | null;
  note: string | null;
  witnessName: string | null;
  givenBy: string;
};
type Rec = {
  id: string;
  medicineName: string;
  reason: string;
  isPrescribed: boolean;
  prescriberName: string | null;
  dose: string;
  route: string;
  frequency: string;
  scheduledTimes: string[];
  startDate: string;
  endDate: string;
  lastDoseAtHome: string | null;
  storage: string;
  expiryDate: string | null;
  specialInstructions: string | null;
  signed: boolean;
  signedAt: string | null;
  parentName: string | null;
  parentRelationship: string | null;
  returnedAt: string | null;
  returnedNote: string | null;
  child: { id: string; firstName: string; lastName: string; allergies: string | null; parentName: string; parentPhone: string | null };
  category: { id: string; name: string };
  createdBy: string;
  dosesToday: Dose[];
};
type Listing = {
  date: string;
  today: string;
  timezone: string;
  records: Rec[];
  summary: { children: number; unsigned: number; total: number };
};
type ChildOption = PickableChild & { parentName?: string; parentPhone?: string | null };

function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

function prettyDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function timeOf(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone });
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{message}</p>;
}

// ── Parent consent: the wording, the details and the signature ────────────

type ParentFields = {
  parentName: string;
  parentRelationship: string;
  parentPhone: string;
  agreed: boolean;
  signature: string | null;
};

function ConsentPanel({
  schoolName,
  fields,
  onChange,
}: {
  schoolName: string;
  fields: ParentFields;
  onChange: (next: ParentFields) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Parent permission</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          {consentStatements(schoolName).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>

      <div>
        <Label htmlFor="parent-name">Parent or guardian&apos;s full name</Label>
        <Input
          id="parent-name"
          className="mt-1"
          autoComplete="off"
          value={fields.parentName}
          onChange={(e) => onChange({ ...fields, parentName: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
        <div>
          <Label htmlFor="parent-rel">Relationship</Label>
          <Select
            id="parent-rel"
            className="mt-1"
            value={fields.parentRelationship}
            onChange={(e) => onChange({ ...fields, parentRelationship: e.target.value })}
          >
            <option value="">Choose…</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="parent-phone">Phone today</Label>
          <Input
            id="parent-phone"
            type="tel"
            inputMode="tel"
            className="mt-1"
            value={fields.parentPhone}
            onChange={(e) => onChange({ ...fields, parentPhone: e.target.value })}
          />
        </div>
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0"
          checked={fields.agreed}
          onChange={(e) => onChange({ ...fields, agreed: e.target.checked })}
        />
        <span>I have read the above and I agree.</span>
      </label>

      <div>
        <Label>Signature</Label>
        <div className="mt-1">
          <SignaturePad onChange={(signature) => onChange({ ...fields, signature })} />
        </div>
      </div>
    </div>
  );
}

function parentReady(f: ParentFields) {
  return (
    f.parentName.trim().length >= 2 &&
    f.parentRelationship !== "" &&
    f.parentPhone.trim().length >= 7 &&
    f.agreed &&
    f.signature !== null
  );
}

function parentPayload(f: ParentFields) {
  return {
    parentName: f.parentName.trim(),
    parentRelationship: f.parentRelationship,
    parentPhone: f.parentPhone.trim(),
    signature: f.signature,
    agreed: true,
  };
}

// ── Sign a form that was saved unsigned ───────────────────────────────────

function SignSheet({
  rec,
  base,
  schoolName,
  onClose,
  onDone,
}: {
  rec: Rec;
  base: string;
  schoolName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fields, setFields] = useState<ParentFields>({
    parentName: rec.child.parentName ?? "",
    parentRelationship: "",
    parentPhone: rec.child.parentPhone ?? "",
    agreed: false,
    signature: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`${base}/medicine/${rec.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parentPayload(fields)),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save the signature.");
      return;
    }
    onDone();
  }

  return (
    <Sheet
      title="Parent signs"
      onClose={onClose}
      busy={saving}
      footer={
        <div className="space-y-2">
          <ErrorBox message={error} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving || !parentReady(fields)}>
              {saving ? "Saving…" : "Save signature"}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {rec.child.firstName} {rec.child.lastName} · {rec.medicineName}, {rec.dose}, {rec.frequency}
      </p>
      <ConsentPanel schoolName={schoolName} fields={fields} onChange={setFields} />
    </Sheet>
  );
}

// ── Record a dose ─────────────────────────────────────────────────────────

function DoseSheet({
  rec,
  base,
  onClose,
  onDone,
}: {
  rec: Rec;
  base: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<(typeof DOSE_OUTCOMES)[number]>("GIVEN");
  const [doseGiven, setDoseGiven] = useState(rec.dose);
  const [witness, setWitness] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`${base}/medicine/${rec.id}/dose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, doseGiven, witnessName: witness, note }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    onDone();
  }

  return (
    <Sheet
      title="Record a dose"
      onClose={onClose}
      busy={saving}
      footer={
        <div className="space-y-2">
          <ErrorBox message={error} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-medium text-foreground">
            {rec.child.firstName} {rec.child.lastName}
          </p>
          <p className="text-foreground">
            {rec.medicineName} · {rec.dose} · {ROUTE_LABELS[rec.route as (typeof ROUTES)[number]] ?? rec.route}
          </p>
          <p className="text-muted-foreground">{rec.frequency}</p>
          {rec.child.allergies && <p className="mt-1 text-danger">Allergies: {rec.child.allergies}</p>}
          {rec.specialInstructions && <p className="mt-1 text-muted-foreground">{rec.specialInstructions}</p>}
        </div>
        <p className="text-xs text-muted-foreground">
          Before you give it: right child, right medicine, right dose, right time, and the label matches.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {DOSE_OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOutcome(o)}
              className={`min-h-12 rounded-lg border px-3 py-2 text-sm font-medium ${
                outcome === o ? "border-brand bg-brand-soft text-brand-soft-foreground" : "border-border-strong bg-surface text-foreground"
              }`}
            >
              {DOSE_OUTCOME_LABELS[o]}
            </button>
          ))}
        </div>

        {outcome === "GIVEN" && (
          <div>
            <Label htmlFor="dose-given">Amount given</Label>
            <Input id="dose-given" className="mt-1" value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} />
          </div>
        )}
        <div>
          <Label htmlFor="dose-witness">Second staff member who checked (optional)</Label>
          <Input id="dose-witness" className="mt-1" value={witness} onChange={(e) => setWitness(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="dose-note">Note (optional)</Label>
          <Textarea
            id="dose-note"
            className="mt-1"
            rows={2}
            maxLength={1000}
            placeholder={outcome === "GIVEN" ? "Anything to remember" : "What happened? Did you call the parent?"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}

// ── Take in a medicine (two steps: staff details, then the parent) ────────

type FormState = {
  childId: string;
  medicineName: string;
  reason: string;
  isPrescribed: boolean;
  prescriberName: string;
  dose: string;
  route: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate: string;
  lastDoseAtHome: string;
  storage: string;
  expiryDate: string;
  originalContainer: boolean;
  labelMatches: boolean;
  notExpired: boolean;
  specialInstructions: string;
};

function emptyForm(): FormState {
  const today = localToday();
  return {
    childId: "",
    medicineName: "",
    reason: "",
    isPrescribed: false,
    prescriberName: "",
    dose: "",
    route: "ORAL",
    frequency: "",
    times: [],
    startDate: today,
    endDate: today,
    lastDoseAtHome: "",
    storage: "ROOM",
    expiryDate: "",
    originalContainer: false,
    labelMatches: false,
    notExpired: false,
    specialInstructions: "",
  };
}

function NewMedicineSheet({
  base,
  schoolName,
  kids,
  onClose,
  onDone,
}: {
  base: string;
  schoolName: string;
  kids: ChildOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [parent, setParent] = useState<ParentFields>({
    parentName: "",
    parentRelationship: "",
    parentPhone: "",
    agreed: false,
    signature: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scrollTop = useRef<HTMLDivElement>(null);

  const child = kids.find((k) => k.id === form.childId);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  function next() {
    setError("");
    if (!form.childId) return setError("Choose the child.");
    if (form.medicineName.trim().length < 2) return setError("Enter the medicine's name.");
    if (form.reason.trim().length < 2) return setError("Say what the medicine is for.");
    if (!form.dose.trim()) return setError("Enter the dose, e.g. 5 ml.");
    if (form.frequency.trim().length < 2) return setError("Say how often, e.g. twice a day.");
    if (form.times.some((t) => !t)) return setError("Fill in every time, or remove the empty one.");
    if (form.endDate < form.startDate) return setError("The last day can't be before the first day.");
    if (!form.originalContainer || !form.labelMatches || !form.notExpired) {
      return setError("Tick all three checks. We can only take medicine in its original, labelled container, and in date.");
    }
    // Hand over to the parent: pre-fill what we know.
    setParent((p) => ({
      ...p,
      parentName: p.parentName || child?.parentName || "",
      parentPhone: p.parentPhone || child?.parentPhone || "",
    }));
    setStep(2);
  }

  async function save(withSignature: boolean) {
    setSaving(true);
    setError("");
    const res = await fetch(`${base}/medicine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: form.childId,
        medicineName: form.medicineName,
        reason: form.reason,
        isPrescribed: form.isPrescribed,
        prescriberName: form.prescriberName,
        dose: form.dose,
        route: form.route,
        frequency: form.frequency,
        scheduledTimes: form.times,
        startDate: form.startDate,
        endDate: form.endDate,
        lastDoseAtHome: form.lastDoseAtHome,
        storage: form.storage,
        expiryDate: form.expiryDate,
        originalContainer: form.originalContainer,
        labelMatches: form.labelMatches,
        notExpired: form.notExpired,
        specialInstructions: form.specialInstructions,
        ...(withSignature ? { sign: parentPayload(parent) } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save the form.");
      if (step === 2 && /day|expire|container|label|form|medicine|dose|often/i.test(data.error ?? "")) {
        setStep(1);
      }
      return;
    }
    onDone();
  }

  const checks: { key: "originalContainer" | "labelMatches" | "notExpired"; text: string }[] = [
    { key: "originalContainer", text: "It is in its original container or packaging" },
    { key: "labelMatches", text: "The label matches this form (name, dose, and the child's name if prescribed)" },
    { key: "notExpired", text: "It is not past its expiry date" },
  ];

  return (
    <Sheet
      title={step === 1 ? "Medicine brought in" : "Parent signs"}
      onClose={onClose}
      busy={saving}
      footer={
        <div className="space-y-2">
          <ErrorBox message={error} />
          {step === 1 ? (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={next}>
                Next: parent signs
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => save(true)} disabled={saving || !parentReady(parent)}>
                  {saving ? "Saving…" : "Save with signature"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError("");
                    setStep(1);
                    scrollTop.current?.scrollIntoView();
                  }}
                  disabled={saving}
                >
                  Back
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => save(false)} disabled={saving}>
                Parent isn&apos;t here: save and sign later
              </Button>
            </>
          )}
        </div>
      }
    >
      <div ref={scrollTop} />
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">Step 1 of 2: fill this in with the parent.</p>
          <div>
            <Label>Child</Label>
            <div className="mt-1">
              <ChildPicker options={kids} value={form.childId} onChange={(id) => set("childId", id)} />
            </div>
          </div>

          <div>
            <Label htmlFor="med-name">Medicine name</Label>
            <Input id="med-name" className="mt-1" value={form.medicineName} onChange={(e) => set("medicineName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="med-reason">What is it for?</Label>
            <Input
              id="med-reason"
              className="mt-1"
              placeholder="e.g. Ear infection, asthma, fever"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
            />
          </div>

          <div>
            <Label>Where did it come from?</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                { v: true, l: "Prescribed by a doctor" },
                { v: false, l: "Over the counter" },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => set("isPrescribed", o.v)}
                  className={`min-h-12 rounded-lg border px-3 py-2 text-sm font-medium ${
                    form.isPrescribed === o.v
                      ? "border-brand bg-brand-soft text-brand-soft-foreground"
                      : "border-border-strong bg-surface text-foreground"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {form.isPrescribed && (
              <Input
                className="mt-2"
                placeholder="Doctor's name (optional)"
                value={form.prescriberName}
                onChange={(e) => set("prescriberName", e.target.value)}
                aria-label="Doctor's name"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <div>
              <Label htmlFor="med-dose">Dose</Label>
              <Input
                id="med-dose"
                className="mt-1"
                placeholder="e.g. 5 ml"
                value={form.dose}
                onChange={(e) => set("dose", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="med-route">How it is given</Label>
              <Select id="med-route" className="mt-1" value={form.route} onChange={(e) => set("route", e.target.value)}>
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {ROUTE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="med-freq">How often</Label>
            <Input
              id="med-freq"
              className="mt-1"
              placeholder="e.g. Twice a day, after food"
              value={form.frequency}
              onChange={(e) => set("frequency", e.target.value)}
            />
          </div>

          <div>
            <Label>Times to give it at school</Label>
            <div className="mt-1 space-y-2">
              {form.times.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={t}
                    aria-label={`Time ${i + 1}`}
                    onChange={(e) => set("times", form.times.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`Remove time ${i + 1}`}
                    onClick={() => set("times", form.times.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {form.times.length < 8 && (
                <Button type="button" variant="secondary" size="sm" onClick={() => set("times", [...form.times, ""])}>
                  + Add a time
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <div>
              <Label htmlFor="med-start">First day</Label>
              <Input id="med-start" type="date" className="mt-1" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="med-end">Last day</Label>
              <Input id="med-end" type="date" className="mt-1" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="med-last">When was the last dose given at home? (optional)</Label>
            <Input
              id="med-last"
              className="mt-1"
              placeholder="e.g. 6:30 this morning"
              value={form.lastDoseAtHome}
              onChange={(e) => set("lastDoseAtHome", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <div>
              <Label htmlFor="med-storage">Where we keep it</Label>
              <Select id="med-storage" className="mt-1" value={form.storage} onChange={(e) => set("storage", e.target.value)}>
                {STORAGE.map((s) => (
                  <option key={s} value={s}>
                    {STORAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="med-expiry">Expiry date (on the box)</Label>
              <Input id="med-expiry" type="date" className="mt-1" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="med-instr">Special instructions or side effects to watch for (optional)</Label>
            <Textarea
              id="med-instr"
              className="mt-1"
              rows={3}
              maxLength={2000}
              placeholder="e.g. Give with food. May make her sleepy."
              value={form.specialInstructions}
              onChange={(e) => set("specialInstructions", e.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-muted-foreground">Check the medicine, then tick</legend>
            {checks.map((c) => (
              <label key={c.key} className="flex min-h-11 items-start gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0"
                  checked={form[c.key]}
                  onChange={(e) => set(c.key, e.target.checked)}
                />
                <span>{c.text}</span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Please hand the tablet to the parent.</p>
          <div className="rounded-lg border border-border bg-background p-3 text-sm">
            <p className="font-medium text-foreground">
              {child?.firstName} {child?.lastName}
            </p>
            <p className="text-foreground">
              {form.medicineName}, {form.dose}, {form.frequency}
            </p>
            <p className="text-muted-foreground">
              {form.startDate === form.endDate ? prettyDay(form.startDate) : `${prettyDay(form.startDate)} to ${prettyDay(form.endDate)}`}
              {form.times.length > 0 ? ` · at ${[...form.times].sort().join(", ")}` : ""}
            </p>
          </div>
          <ConsentPanel schoolName={schoolName} fields={parent} onChange={setParent} />
        </div>
      )}
    </Sheet>
  );
}

// ── One medicine on the register ──────────────────────────────────────────

function RecordCard({
  rec,
  base,
  timezone,
  isToday,
  onSign,
  onDose,
  onChanged,
}: {
  rec: Rec;
  base: string;
  timezone: string;
  isToday: boolean;
  onSign: () => void;
  onDose: () => void;
  onChanged: () => void;
}) {
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const given = rec.dosesToday.filter((d) => d.outcome === "GIVEN").length;
  const due = rec.scheduledTimes.length;

  async function markReturned() {
    setBusy(true);
    setError("");
    const res = await fetch(`${base}/medicine/${rec.id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save.");
      return;
    }
    setConfirmReturn(false);
    onChanged();
  }

  return (
    <Card className={`p-4 ${!rec.signed && !rec.returnedAt ? "border-danger" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-foreground">
            {rec.child.firstName} {rec.child.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{rec.category.name}</p>
        </div>
        {rec.returnedAt ? (
          <Badge variant="neutral">Handed back</Badge>
        ) : rec.signed ? (
          <Badge variant="success">Parent signed</Badge>
        ) : (
          <Badge variant="danger">Not signed</Badge>
        )}
      </div>

      {rec.child.allergies && (
        <p className="mt-2 rounded-lg bg-danger-soft px-2 py-1 text-xs text-danger">Allergies: {rec.child.allergies}</p>
      )}

      <div className="mt-3 text-sm text-foreground">
        <p className="font-medium">
          {rec.medicineName} · {rec.dose}
        </p>
        <p className="text-muted-foreground">
          {rec.reason} · {ROUTE_LABELS[rec.route as (typeof ROUTES)[number]] ?? rec.route}
        </p>
        <p className="text-muted-foreground">{rec.frequency}</p>
        {rec.scheduledTimes.length > 0 && (
          <p className="mt-1">
            At school: <span className="font-medium">{rec.scheduledTimes.join(", ")}</span>
            {isToday && <span className="ml-2 text-xs text-muted-foreground">({given} of {due} given)</span>}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {rec.startDate === rec.endDate ? prettyDay(rec.startDate) : `${prettyDay(rec.startDate)} to ${prettyDay(rec.endDate)}`}
          {" · "}
          {STORAGE_LABELS[rec.storage as (typeof STORAGE)[number]] ?? rec.storage}
        </p>
        {rec.lastDoseAtHome && <p className="text-xs text-muted-foreground">Last dose at home: {rec.lastDoseAtHome}</p>}
        {rec.specialInstructions && <p className="mt-1 text-xs text-muted-foreground">{rec.specialInstructions}</p>}
      </div>

      {rec.dosesToday.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {rec.dosesToday.map((d) => (
            <li key={d.id} className="text-sm text-foreground">
              <span className="font-medium">{timeOf(d.givenAt, timezone)}</span>{" "}
              {DOSE_OUTCOME_LABELS[d.outcome as (typeof DOSE_OUTCOMES)[number]] ?? d.outcome}
              {d.doseGiven ? `: ${d.doseGiven}` : ""}
              <span className="text-muted-foreground"> · {d.givenBy}</span>
              {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
            </li>
          ))}
        </ul>
      )}

      {!rec.signed && !rec.returnedAt && (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-2 text-sm text-danger">
          Don&apos;t give this medicine until the parent has signed.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {!rec.signed && !rec.returnedAt && (
          <Button size="sm" onClick={onSign}>
            Parent signs now
          </Button>
        )}
        {rec.signed && !rec.returnedAt && isToday && (
          <Button size="sm" onClick={onDose}>
            Record a dose
          </Button>
        )}
        <a
          href={`${base}/medicine/${rec.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="transition-standard inline-flex min-h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background sm:min-h-0"
        >
          Print / PDF
        </a>
        {!rec.returnedAt &&
          (confirmReturn ? (
            <>
              <Button size="sm" variant="danger" onClick={markReturned} disabled={busy}>
                {busy ? "Saving…" : "Yes, handed back / finished"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmReturn(false)} disabled={busy}>
                No
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirmReturn(true)}>
              Handed back / finished
            </Button>
          ))}
      </div>
    </Card>
  );
}

// ── The page ──────────────────────────────────────────────────────────────

function MedicineRegister() {
  const { organizationId, organizationName, role } = useOrg();
  const canWrite = useHasPermission("MANAGE_REPORTS");
  const isTeacher = role === "TEACHER";
  const searchParams = useSearchParams();
  const base = `/api/organizations/${organizationId}`;

  const [date, setDate] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [classes, setClasses] = useState<{ id: string; name: string; archived: boolean }[]>([]);
  const [data, setData] = useState<Listing | null>(null);
  const [kids, setKids] = useState<ChildOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [signing, setSigning] = useState<Rec | null>(null);
  const [dosing, setDosing] = useState<Rec | null>(null);
  const openedFromLink = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    if (!isTeacher && classFilter) qs.set("categoryId", classFilter);
    const res = await fetch(`${base}/medicine?${qs}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setData(json);
      if (!date) setDate(json.date);
    } else {
      setError(json.error ?? "Could not load the medicine register.");
    }
    setLoading(false);
  }, [base, date, classFilter, isTeacher]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the day or class changes
    load();
  }, [load]);

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`${base}/categories`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setClasses((json.categories as { id: string; name: string; archived: boolean }[]).filter((c) => !c.archived));
    })();
  }, [base, isTeacher]);

  useEffect(() => {
    if (!canWrite) return;
    (async () => {
      const res = await fetch(`${base}/children`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setKids((json.children as (ChildOption & { archived?: boolean; exitDate?: string | null })[]).filter((c) => !c.archived));
    })();
  }, [base, canWrite]);

  useEffect(() => {
    if (openedFromLink.current || !canWrite) return;
    if (searchParams.get("new") === "1") {
      openedFromLink.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- open the form once from the link
      setCreating(true);
    }
  }, [searchParams, canWrite]);

  const isToday = !data || data.date === data.today;
  const open = data?.records.filter((r) => !r.returnedAt) ?? [];
  const finished = data?.records.filter((r) => r.returnedAt) ?? [];

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Medicine register"
        description="Medicine parents bring in, their signed permission, and every dose we give."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">
              Medicine brought in
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 divide-x divide-border text-center">
          <div className="px-2">
            <p className="font-display text-3xl font-semibold text-foreground">{loading && !data ? "…" : data?.summary.children ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {(data?.summary.children ?? 0) === 1 ? "child has" : "children have"} medicine {isToday ? "today" : "this day"}
            </p>
          </div>
          <div className="px-2">
            <p className={`font-display text-3xl font-semibold ${(data?.summary.unsigned ?? 0) > 0 ? "text-danger" : "text-success"}`}>
              {loading && !data ? "…" : data?.summary.unsigned ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">not signed by a parent yet</p>
          </div>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="med-date">Day</Label>
          <Input id="med-date" type="date" className="mt-1 w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!isTeacher && (
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <Label htmlFor="med-class">Class</Label>
            <Select id="med-class" className="mt-1" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      {!loading && data && data.records.length === 0 ? (
        <EmptyState
          title="No medicine on the register"
          description={isToday ? "When a parent brings medicine, tap “Medicine brought in”." : "Nothing was on the register on that day."}
        />
      ) : (
        <div className="space-y-3">
          {open.map((r) => (
            <RecordCard
              key={r.id}
              rec={r}
              base={base}
              timezone={data?.timezone ?? "Africa/Johannesburg"}
              isToday={isToday}
              onSign={() => setSigning(r)}
              onDose={() => setDosing(r)}
              onChanged={load}
            />
          ))}
          {finished.length > 0 && (
            <>
              <h2 className="font-display pt-2 text-sm font-semibold text-muted-foreground">Handed back or finished</h2>
              {finished.map((r) => (
                <RecordCard
                  key={r.id}
                  rec={r}
                  base={base}
                  timezone={data?.timezone ?? "Africa/Johannesburg"}
                  isToday={isToday}
                  onSign={() => setSigning(r)}
                  onDose={() => setDosing(r)}
                  onChanged={load}
                />
              ))}
            </>
          )}
        </div>
      )}

      {creating && (
        <NewMedicineSheet
          base={base}
          schoolName={organizationName}
          kids={kids}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {signing && (
        <SignSheet
          rec={signing}
          base={base}
          schoolName={organizationName}
          onClose={() => setSigning(null)}
          onDone={() => {
            setSigning(null);
            load();
          }}
        />
      )}
      {dosing && (
        <DoseSheet
          rec={dosing}
          base={base}
          onClose={() => setDosing(null)}
          onDone={() => {
            setDosing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function MedicinePage() {
  return (
    <Suspense fallback={null}>
      <MedicineRegister />
    </Suspense>
  );
}
