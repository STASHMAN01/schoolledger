"use client";

// Add a child from Centre Management > Enrolled (Dylan 23 Sept: "when
// adding a child all the details are required, the same details as when a
// parent fills in a form"). Agreed rule: the CORE details are required
// here -- name, date of birth, gender, class, start date and one
// parent/guardian with a phone number. Everything else (ID numbers,
// medical info, more guardians, photo) is added on the child's profile
// afterwards; a child missing core details is flagged "incomplete".
import { useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { todayLocal } from "@/lib/date";

type ClassOption = { id: string; name: string };

export function AddChildForm({
  organizationId,
  classes,
  onAdded,
  onCancel,
}: {
  organizationId: string;
  classes: ClassOption[];
  onAdded: (childId: string) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    categoryId: classes[0]?.id ?? "",
    enrollmentDate: todayLocal(),
    childIdNumber: "",
    gRelationship: "Mother",
    gFirstName: "",
    gLastName: "",
    gPhone: "",
    gEmail: "",
    gIdNumber: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const required: [string, string][] = [
      [f.firstName, "the child's first name"],
      [f.lastName, "the child's surname"],
      [f.dateOfBirth, "date of birth"],
      [f.gender, "gender"],
      [f.categoryId, "a class"],
      [f.enrollmentDate, "a start date"],
      [f.gRelationship, "the parent/guardian's relationship to the child"],
      [f.gFirstName, "the parent/guardian's first name"],
      [f.gLastName, "the parent/guardian's surname"],
      [f.gPhone, "the parent/guardian's phone number"],
    ];
    const missing = required.filter(([v]) => !v.trim()).map(([, label]) => label);
    if (missing.length > 0) {
      setError(`Please add ${missing.join(", ")}.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: f.categoryId,
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          dateOfBirth: f.dateOfBirth,
          gender: f.gender,
          enrollmentDate: f.enrollmentDate,
          childIdNumber: f.childIdNumber || undefined,
          // Billing contact = this first guardian.
          parentName: `${f.gFirstName.trim()} ${f.gLastName.trim()}`,
          parentPhone: f.gPhone,
          parentEmail: f.gEmail || undefined,
          guardian: {
            relationship: f.gRelationship,
            firstName: f.gFirstName,
            lastName: f.gLastName,
            phone: f.gPhone,
            email: f.gEmail || undefined,
            idNumber: f.gIdNumber || undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstIssue = data?.issues?.fieldErrors
          ? Object.entries(data.issues.fieldErrors as Record<string, string[]>)[0]
          : null;
        setError(
          firstIssue
            ? `${firstIssue[0] === "parentPhone" ? "Phone number" : firstIssue[0]}: ${firstIssue[1][0]}`
            : data.error ?? "The child couldn't be added. Please check the details and try again."
        );
        return;
      }
      onAdded(data.child.id);
    } catch {
      setError("The child couldn't be added — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="div" className="mb-6 p-5">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">Add a child</h2>
          <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fields marked * are required. ID numbers, medical details, more guardians and a photo can be added on the
          child&apos;s profile afterwards.
        </p>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-display mb-2 text-sm font-semibold text-foreground">Child</legend>
          <Field label="First name *" id="ac-first">
            <Input id="ac-first" value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          </Field>
          <Field label="Surname *" id="ac-last">
            <Input id="ac-last" value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} />
          </Field>
          <Field label="Date of birth *" id="ac-dob">
            <Input id="ac-dob" type="date" value={f.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
          </Field>
          <Field label="Gender *" id="ac-gender">
            <Select id="ac-gender" value={f.gender} onChange={(e) => set({ gender: e.target.value })}>
              <option value="">Choose…</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Class *" id="ac-class">
            <Select id="ac-class" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              {classes.length === 0 && <option value="">No classes yet — add one under Classes</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date *" id="ac-start">
            <Input id="ac-start" type="date" value={f.enrollmentDate} onChange={(e) => set({ enrollmentDate: e.target.value })} />
          </Field>
          <Field label="Child's ID / birth certificate number" id="ac-cid">
            <Input id="ac-cid" value={f.childIdNumber} onChange={(e) => set({ childIdNumber: e.target.value })} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-display mb-2 text-sm font-semibold text-foreground">Parent / guardian</legend>
          <Field label="Relationship *" id="ac-rel">
            <Input
              id="ac-rel"
              value={f.gRelationship}
              placeholder="Mother, Father, Grandmother…"
              onChange={(e) => set({ gRelationship: e.target.value })}
            />
          </Field>
          <div className="hidden sm:block" />
          <Field label="First name *" id="ac-gfirst">
            <Input id="ac-gfirst" value={f.gFirstName} onChange={(e) => set({ gFirstName: e.target.value })} />
          </Field>
          <Field label="Surname *" id="ac-glast">
            <Input id="ac-glast" value={f.gLastName} onChange={(e) => set({ gLastName: e.target.value })} />
          </Field>
          <Field label="Phone *" id="ac-gphone">
            <Input
              id="ac-gphone"
              type="tel"
              inputMode="tel"
              placeholder="082 123 4567"
              value={f.gPhone}
              onChange={(e) => set({ gPhone: e.target.value })}
            />
          </Field>
          <Field label="Email" id="ac-gemail">
            <Input id="ac-gemail" type="email" value={f.gEmail} onChange={(e) => set({ gEmail: e.target.value })} />
          </Field>
          <Field label="ID number" id="ac-gid">
            <Input id="ac-gid" value={f.gIdNumber} onChange={(e) => set({ gIdNumber: e.target.value })} />
          </Field>
        </fieldset>

        {error && <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || classes.length === 0}>
            {saving ? "Adding…" : "Add child"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
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
