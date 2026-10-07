"use client";

// Add a child from Centre Management > Enrolled (Dylan 23 Sept: "when
// adding a child all the details are required, the same details as when a
// parent fills in a form"). Agreed rule: the CORE details are required
// here -- name, date of birth, gender, class, start date and one
// parent/guardian with a phone number. A second parent/guardian, allergies
// and an emergency contact are optional here (Dylan, 28 Sept 2026); the
// emergency contact must be someone other than the parents
// (lib/emergencyContact.ts). A photo is added on the profile afterwards; a
// child missing core details is flagged "incomplete".
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { todayLocal } from "@/lib/date";
import { emergencyContactProblem } from "@/lib/emergencyContact";
import { ExtraPhonesField, cleanExtraPhones } from "@/components/ExtraPhonesField";
import { FormDocumentSlot } from "@/components/FormDocumentSlot";
import { DOCUMENT_TYPES, normaliseRequired } from "@/lib/documents";

// Documents picked on the form, uploaded right after the child is created.
type PickedDoc = { type: string; guardianIndex?: number; dataUrl: string; fileName: string };
const docKey = (type: string, guardianIndex?: number) => `${type}:${guardianIndex ?? ""}`;

type ClassOption = { id: string; name: string };

export function AddChildForm({
  organizationId,
  classes,
  onAdded,
  onCancel,
  showFee = false,
}: {
  organizationId: string;
  classes: ClassOption[];
  /** siblingCount: other children already on file with the same surname. */
  onAdded: (childId: string, siblingCount: number) => void;
  onCancel: () => void;
  /** Accounting only (VIEW_MONEY): an optional child-specific monthly fee. */
  showFee?: boolean;
}) {
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    categoryId: classes[0]?.id ?? "",
    enrollmentDate: todayLocal(),
    childIdNumber: "",
    homeAddress: "",
    gRelationship: "Mother",
    gFirstName: "",
    gLastName: "",
    gPhone: "",
    gExtraPhones: [] as string[],
    gEmail: "",
    gIdNumber: "",
    gOccupation: "",
    gAddress: "",
    g2Relationship: "Father",
    g2FirstName: "",
    g2LastName: "",
    g2Phone: "",
    g2ExtraPhones: [] as string[],
    g2Email: "",
    g2IdNumber: "",
    g2Occupation: "",
    g2Address: "",
    allergies: "",
    ecName: "",
    ecRelationship: "",
    ecPhone: "",
    feeOverride: "",
  });
  const [showSecond, setShowSecond] = useState(false);
  // Quick add (Dylan, 7 Oct 2026): just name, surname and class, so a child can
  // be on the class lists straight away and the rest filled in later.
  const [quick, setQuick] = useState(false);
  // Documents the school requires (Dylan, 30 Sept 2026) -- asked for here,
  // unless staff tick that they'll follow later.
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<string, PickedDoc>>({});
  const [docsLater, setDocsLater] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/organizations/${organizationId}/documents/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setRequiredDocs(normaliseRequired(d.requiredDocuments));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [organizationId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  // One upload line per required document; a parent's ID once per parent.
  function documentSlots(withSecond: boolean) {
    const slots: { key: string; type: string; guardianIndex?: number; label: string; hint: string }[] = [];
    for (const t of DOCUMENT_TYPES) {
      if (!requiredDocs.includes(t.type)) continue;
      if (t.perGuardian) {
        slots.push({ key: docKey(t.type, 0), type: t.type, guardianIndex: 0, label: `${t.label} — parent/guardian 1`, hint: t.hint });
        if (withSecond) {
          slots.push({ key: docKey(t.type, 1), type: t.type, guardianIndex: 1, label: `${t.label} — parent/guardian 2`, hint: t.hint });
        }
      } else {
        slots.push({ key: docKey(t.type), type: t.type, label: t.label, hint: t.hint });
      }
    }
    return slots;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const required: [string, string][] = quick
      ? [
          [f.firstName, "the child's first name"],
          [f.lastName, "the child's surname"],
          [f.categoryId || classes[0]?.id || "", "a class"],
          [f.enrollmentDate, "a start date"],
        ]
      : [
      [f.firstName, "the child's first name"],
      [f.lastName, "the child's surname"],
      [f.dateOfBirth, "date of birth"],
      [f.gender, "gender"],
      [f.categoryId || classes[0]?.id || "", "a class"],
      [f.enrollmentDate, "a start date"],
      [f.gRelationship, "the parent/guardian's relationship to the child"],
      [f.gFirstName, "the parent/guardian's first name"],
      [f.gLastName, "the parent/guardian's surname"],
      [f.gPhone, "the parent/guardian's phone number"],
    ];
    const hasSecond =
      !quick &&
      showSecond &&
      [f.g2FirstName, f.g2LastName, f.g2Phone, f.g2Email, f.g2IdNumber, f.g2Occupation, ...f.g2ExtraPhones].some((v) => v.trim());
    if (hasSecond) {
      required.push(
        [f.g2Relationship, "the second parent/guardian's relationship to the child"],
        [f.g2FirstName, "the second parent/guardian's first name"],
        [f.g2LastName, "the second parent/guardian's surname"]
      );
    }
    const missing = required.filter(([v]) => !v.trim()).map(([, label]) => label);
    if (missing.length > 0) {
      setError(`Please add ${missing.join(", ")}.`);
      return;
    }

    const docSlots = quick ? [] : documentSlots(hasSecond);
    const missingDocs = docSlots.filter((s) => !picked[s.key]).map((s) => s.label);
    if (missingDocs.length > 0 && !docsLater) {
      setError(
        `Please upload: ${missingDocs.join(", ")}. If the parent will bring them later, tick "Documents will follow" and they'll show under Missing documents.`
      );
      return;
    }

    const ecProblem = quick ? null : emergencyContactProblem(
      { name: f.ecName, relationship: f.ecRelationship, phone: f.ecPhone },
      [
        { firstName: f.gFirstName, lastName: f.gLastName, phone: f.gPhone, extraPhones: f.gExtraPhones },
        ...(hasSecond ? [{ firstName: f.g2FirstName, lastName: f.g2LastName, phone: f.g2Phone, extraPhones: f.g2ExtraPhones }] : []),
      ]
    );
    if (ecProblem) {
      setError(ecProblem);
      return;
    }

    let feeOverrideCents: number | undefined;
    if (!quick && showFee && f.feeOverride.trim()) {
      const rand = Number(f.feeOverride.replace(/[^\d.]/g, ""));
      if (Number.isNaN(rand) || rand < 0) {
        setError("The fee must be an amount in rand, e.g. 1500.");
        return;
      }
      feeOverrideCents = Math.round(rand * 100);
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          quick
            ? {
                quickAdd: true,
                categoryId: f.categoryId || classes[0]?.id,
                firstName: f.firstName.trim(),
                lastName: f.lastName.trim(),
                enrollmentDate: f.enrollmentDate,
              }
            : {
          categoryId: f.categoryId || classes[0]?.id,
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          dateOfBirth: f.dateOfBirth,
          gender: f.gender,
          enrollmentDate: f.enrollmentDate,
          childIdNumber: f.childIdNumber || undefined,
          feeOverrideCents,
          // Billing contact = this first guardian.
          parentName: `${f.gFirstName.trim()} ${f.gLastName.trim()}`,
          parentPhone: f.gPhone,
          parentEmail: f.gEmail || undefined,
          guardians: [
            {
              relationship: f.gRelationship,
              firstName: f.gFirstName,
              lastName: f.gLastName,
              phone: f.gPhone,
              extraPhones: cleanExtraPhones(f.gExtraPhones),
              email: f.gEmail || undefined,
              idNumber: f.gIdNumber || undefined,
              occupation: f.gOccupation || undefined,
              address: f.gAddress.trim() || undefined,
            },
            ...(hasSecond
              ? [
                  {
                    relationship: f.g2Relationship,
                    firstName: f.g2FirstName,
                    lastName: f.g2LastName,
                    phone: f.g2Phone || undefined,
                    extraPhones: cleanExtraPhones(f.g2ExtraPhones),
                    email: f.g2Email || undefined,
                    idNumber: f.g2IdNumber || undefined,
                    occupation: f.g2Occupation || undefined,
                    address: f.g2Address.trim() || undefined,
                  },
                ]
              : []),
          ],
          allergies: f.allergies.trim() || undefined,
          homeAddress: f.homeAddress.trim() || undefined,
          emergencyContactName: f.ecName.trim() || undefined,
          emergencyContactRelationship: f.ecRelationship.trim() || undefined,
          emergencyContactPhone: f.ecPhone.trim() || undefined,
            }
        ),
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
      // Upload the picked documents onto the new child's file.
      const failed: string[] = [];
      for (const s of docSlots) {
        const doc = picked[s.key];
        if (!doc) continue;
        const up = await fetch(`/api/organizations/${organizationId}/children/${data.child.id}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: doc.type,
            guardianId: doc.guardianIndex !== undefined ? data.guardianIds?.[doc.guardianIndex] : undefined,
            fileName: doc.fileName,
            file: doc.dataUrl,
          }),
        }).catch(() => null);
        if (!up || !up.ok) failed.push(s.label);
      }
      if (failed.length > 0) {
        window.alert(
          `${f.firstName.trim()} was added, but these documents didn't upload: ${failed.join(", ")}. Upload them on the child's profile.`
        );
      }
      const siblings = ((data.possibleSiblings ?? []) as { id: string }[]).filter((s) => s.id !== data.child.id);
      onAdded(data.child.id, siblings.length);
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
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={quick}
            onChange={(e) => setQuick(e.target.checked)}
          />
          <span>
            <span className="font-medium">Quick add</span>{" "}
            <span className="text-muted-foreground">
              — only the name, surname and class. The child goes on the class lists straight away; fill in the rest
              on their profile later (they&apos;ll show as an incomplete profile until then).
            </span>
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          {quick ? "Only the fields marked * are needed." : "Fields marked * are required."} A photo, and more guardians, can be added on the child&apos;s
          profile afterwards.
        </p>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-display mb-2 text-sm font-semibold text-foreground">Child</legend>
          <Field label="First name *" id="ac-first">
            <Input id="ac-first" value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          </Field>
          <Field label="Surname *" id="ac-last">
            <Input id="ac-last" value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} />
          </Field>
          {!quick && (<>
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
          </>)}
          <Field label="Class *" id="ac-class">
            <Select id="ac-class" value={f.categoryId || classes[0]?.id || ""} onChange={(e) => set({ categoryId: e.target.value })}>
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
          {!quick && (<>
          <Field label="Child's ID / birth certificate number" id="ac-cid">
            <Input id="ac-cid" value={f.childIdNumber} onChange={(e) => set({ childIdNumber: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Home address" id="ac-addr">
              <Input
                id="ac-addr"
                autoComplete="street-address"
                placeholder="Street, suburb, town"
                value={f.homeAddress}
                onChange={(e) => set({ homeAddress: e.target.value })}
              />
            </Field>
          </div>
          {showFee && (
            <Field label="Monthly fee for this child (R) — leave blank to use the class fee" id="ac-fee">
              <Input
                id="ac-fee"
                inputMode="decimal"
                placeholder="e.g. 1500"
                value={f.feeOverride}
                onChange={(e) => set({ feeOverride: e.target.value })}
              />
            </Field>
          )}
          </>)}
        </fieldset>

        {!quick && (<>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-display mb-2 text-sm font-semibold text-foreground">Parent / guardian 1</legend>
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
          <ExtraPhonesField idPrefix="ac-gphone-x" values={f.gExtraPhones} onChange={(v) => set({ gExtraPhones: v })} />
          <Field label="Email" id="ac-gemail">
            <Input id="ac-gemail" type="email" value={f.gEmail} onChange={(e) => set({ gEmail: e.target.value })} />
          </Field>
          <Field label="ID number" id="ac-gid">
            <Input id="ac-gid" value={f.gIdNumber} onChange={(e) => set({ gIdNumber: e.target.value })} />
          </Field>
          <Field label="Occupation" id="ac-gocc">
            <Input id="ac-gocc" value={f.gOccupation} onChange={(e) => set({ gOccupation: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address (only if different from the child's)" id="ac-gaddr">
              <Input id="ac-gaddr" value={f.gAddress} onChange={(e) => set({ gAddress: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Statements, fee reminders and absence messages go to this parent/guardian.
          </p>
        </fieldset>

        {showSecond ? (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="font-display mb-2 text-sm font-semibold text-foreground">
              Parent / guardian 2 <span className="font-normal text-muted-foreground">(optional)</span>
            </legend>
            <Field label="Relationship" id="ac-g2rel">
              <Input
                id="ac-g2rel"
                value={f.g2Relationship}
                placeholder="Father, Mother, Grandparent…"
                onChange={(e) => set({ g2Relationship: e.target.value })}
              />
            </Field>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSecond(false);
                  set({ g2FirstName: "", g2LastName: "", g2Phone: "", g2ExtraPhones: [], g2Email: "", g2IdNumber: "", g2Occupation: "", g2Address: "" });
                }}
                className="min-h-11 px-2 text-sm text-muted-foreground underline hover:text-foreground"
              >
                Remove second parent/guardian
              </button>
            </div>
            <Field label="First name" id="ac-g2first">
              <Input id="ac-g2first" value={f.g2FirstName} onChange={(e) => set({ g2FirstName: e.target.value })} />
            </Field>
            <Field label="Surname" id="ac-g2last">
              <Input id="ac-g2last" value={f.g2LastName} onChange={(e) => set({ g2LastName: e.target.value })} />
            </Field>
            <Field label="Phone" id="ac-g2phone">
              <Input
                id="ac-g2phone"
                type="tel"
                inputMode="tel"
                placeholder="082 123 4567"
                value={f.g2Phone}
                onChange={(e) => set({ g2Phone: e.target.value })}
              />
            </Field>
            <ExtraPhonesField idPrefix="ac-g2phone-x" values={f.g2ExtraPhones} onChange={(v) => set({ g2ExtraPhones: v })} />
            <Field label="Email" id="ac-g2email">
              <Input id="ac-g2email" type="email" value={f.g2Email} onChange={(e) => set({ g2Email: e.target.value })} />
            </Field>
            <Field label="ID number" id="ac-g2id">
              <Input id="ac-g2id" value={f.g2IdNumber} onChange={(e) => set({ g2IdNumber: e.target.value })} />
            </Field>
            <Field label="Occupation" id="ac-g2occ">
              <Input id="ac-g2occ" value={f.g2Occupation} onChange={(e) => set({ g2Occupation: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address (only if different from the child's)" id="ac-g2addr">
                <Input id="ac-g2addr" value={f.g2Address} onChange={(e) => set({ g2Address: e.target.value })} />
              </Field>
            </div>
          </fieldset>
        ) : (
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowSecond(true)}>
              + Add a second parent/guardian
            </Button>
          </div>
        )}

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-display mb-2 text-sm font-semibold text-foreground">
            Allergies &amp; emergency contact <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="ac-allergies">Allergies</Label>
            <textarea
              id="ac-allergies"
              rows={2}
              value={f.allergies}
              placeholder="e.g. peanuts, bee stings. Leave blank if none."
              onChange={(e) => set({ allergies: e.target.value })}
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Emergency contact: someone other than the parents/guardians above, to call if they can&apos;t be
            reached.
          </p>
          <Field label="Emergency contact name" id="ac-ecname">
            <Input id="ac-ecname" value={f.ecName} onChange={(e) => set({ ecName: e.target.value })} />
          </Field>
          <Field label="Relationship to child" id="ac-ecrel">
            <Input
              id="ac-ecrel"
              value={f.ecRelationship}
              placeholder="Grandmother, aunt, neighbour…"
              onChange={(e) => set({ ecRelationship: e.target.value })}
            />
          </Field>
          <Field label="Emergency contact phone" id="ac-ecphone">
            <Input
              id="ac-ecphone"
              type="tel"
              inputMode="tel"
              placeholder="082 123 4567"
              value={f.ecPhone}
              onChange={(e) => set({ ecPhone: e.target.value })}
            />
          </Field>
        </fieldset>

        {requiredDocs.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="font-display mb-2 text-sm font-semibold text-foreground">Documents</legend>
            {documentSlots(showSecond).map((s) => (
              <FormDocumentSlot
                key={s.key}
                label={s.label}
                hint={s.hint}
                required={!docsLater}
                fileName={picked[s.key]?.fileName ?? null}
                onPick={async (file) => {
                  setPicked((prev) => ({
                    ...prev,
                    [s.key]: { type: s.type, guardianIndex: s.guardianIndex, dataUrl: file.dataUrl, fileName: file.fileName },
                  }));
                  return null;
                }}
                onRemove={() =>
                  setPicked((prev) => {
                    const next = { ...prev };
                    delete next[s.key];
                    return next;
                  })
                }
              />
            ))}
            <label className="mt-1 flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" className="mt-0.5" checked={docsLater} onChange={(e) => setDocsLater(e.target.checked)} />
              <span>
                Documents will follow{" "}
                <span className="text-muted-foreground">
                  — add the child now; anything not uploaded shows under Missing documents, where you can send the
                  parent a link.
                </span>
              </span>
            </label>
          </fieldset>
        )}
        </>)}

        {error && <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || classes.length === 0}>
            {saving ? "Adding…" : quick ? "Quick add child" : "Add child"}
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
