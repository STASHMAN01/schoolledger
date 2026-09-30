"use client";

// Shared public parent form (Phase 2 Session 4; new-family mode added in
// fix session B, 23 Sept). Two uses:
//   - /apply/[token]: a one-time link to UPDATE an existing child's details.
//   - /apply/school/[token]: the school's permanent link for NEW families
//     (isNewApplicant) -- also asks the child's name and preferred start
//     date, and the core fields (date of birth, gender, a guardian phone)
//     are required.
// Public parent-facing enrolment form (Phase 2 Session 4) -- no session,
// no account, the token in the URL is the only proof needed (same model
// as /reset-password/[token]). Submitting here never touches the real
// Child/Guardian records: it lands as a ParentSubmission for staff to
// review and explicitly approve or reject (Dylan's explicit choice,
// 2026-09-21) -- see the ParentSubmission model comment in schema.prisma.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { emergencyContactProblem } from "@/lib/emergencyContact";
import { ExtraPhonesField, cleanExtraPhones } from "@/components/ExtraPhonesField";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Logo } from "@/components/Logo";
import { FormDocumentSlot } from "@/components/FormDocumentSlot";
import type { MissingDocument } from "@/lib/documents";

type RequiredDoc = { type: string; label: string; hint: string; perGuardian: boolean };
type Uploaded = { id: string; fileName: string };

function newUploadKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 16).toString(16);
  const part = (n: number) => Array.from({ length: n }, h).join("");
  return `${part(8)}-${part(4)}-4${part(3)}-a${part(3)}-${part(12)}`;
}

const slotKey = (type: string, guardianIndex?: number) => `${type}:${guardianIndex ?? ""}`;

type GuardianDraft = {
  relationship: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  occupation: string;
  phone: string;
  extraPhones: string[];
  email: string;
  address: string;
  photoImage: string | null;
};

function blankGuardian(): GuardianDraft {
  return {
    relationship: "",
    firstName: "",
    lastName: "",
    idNumber: "",
    occupation: "",
    phone: "",
    extraPhones: [],
    email: "",
    address: "",
    photoImage: null,
  };
}

export function ParentForm({ apiPath, isNewApplicant }: { apiPath: string; isNewApplicant: boolean }) {

  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [childFirstName, setChildFirstName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredStartDate, setPreferredStartDate] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [childIdNumber, setChildIdNumber] = useState("");
  const [photoConsentGiven, setPhotoConsentGiven] = useState(false);
  const [childPhoto, setChildPhoto] = useState<string | null>(null);
  // Documents (Dylan, 30 Sept 2026): what the school requires, uploaded one
  // by one as they're picked; the submit then lists them.
  const [purpose, setPurpose] = useState<"details" | "documents">("details");
  const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
  const [stillNeeded, setStillNeeded] = useState<string[]>([]);
  const [missing, setMissing] = useState<MissingDocument[]>([]);
  const [received, setReceived] = useState<string[]>([]);
  const [uploadKey] = useState(newUploadKey);
  const [uploads, setUploads] = useState<Record<string, Uploaded>>({});
  const [guardians, setGuardians] = useState<GuardianDraft[]>([blankGuardian()]);
  const [allergies, setAllergies] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");
  const [ecPhone, setEcPhone] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const check = useCallback(async () => {
    const res = await fetch(apiPath);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLinkError(data?.error ?? "This link is invalid or has expired.");
    } else {
      setChildFirstName(data.childFirstName ?? "");
      setOrganizationName(data.organizationName);
      setPurpose(data.purpose === "documents" ? "documents" : "details");
      setRequiredDocs(data.requiredDocuments ?? []);
      setStillNeeded(data.stillNeeded ?? []);
      setMissing(data.missing ?? []);
    }
    setLoading(false);
  }, [apiPath]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial token check on mount
    check();
  }, [check]);

  // What to call the child in labels: the name the parent typed (new
  // family) or the existing child's first name (update link).
  const childName = isNewApplicant ? firstName.trim() || "your child" : childFirstName;

  function updateGuardian(index: number, patch: Partial<GuardianDraft>) {
    setGuardians((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  // Removing a parent clears the ID uploads of that parent and everyone
  // after them (their positions change), so those are uploaded again --
  // the server matches each ID to a parent by position.
  function removeGuardian(index: number) {
    setGuardians((prev) => prev.filter((_, idx) => idx !== index));
    setUploads((prev) => {
      const next: Record<string, Uploaded> = {};
      for (const [key, value] of Object.entries(prev)) {
        const gi = key.split(":")[1];
        if (gi === "" || Number(gi) < index) next[key] = value;
      }
      return next;
    });
  }

  // One upload line per required document: once per child (only those not
  // already on file), and a parent's ID once per parent on the form.
  const docSlots: { key: string; type: string; guardianIndex?: number; label: string; hint: string }[] = [];
  for (const d of requiredDocs) {
    if (d.perGuardian) {
      guardians.forEach((g, i) => {
        const who = `${g.firstName} ${g.lastName}`.trim() || `parent/guardian ${i + 1}`;
        docSlots.push({ key: slotKey(d.type, i), type: d.type, guardianIndex: i, label: `${d.label} — ${who}`, hint: d.hint });
      });
    } else if (stillNeeded.includes(d.type)) {
      docSlots.push({ key: slotKey(d.type), type: d.type, label: d.label, hint: d.hint });
    }
  }

  async function uploadDocument(
    slot: { key?: string; type: string; guardianIndex?: number; guardianId?: string },
    file: { dataUrl: string; fileName: string }
  ): Promise<string | null> {
    const res = await fetch(`${apiPath}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: slot.type,
        guardianIndex: slot.guardianIndex,
        guardianId: slot.guardianId,
        fileName: file.fileName,
        file: file.dataUrl,
        uploadKey: purpose === "documents" ? undefined : uploadKey,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) return data?.error ?? "Upload failed. Please try again.";
    if (purpose === "documents") {
      setMissing(data?.missing ?? []);
    } else if (slot.key) {
      setUploads((prev) => ({ ...prev, [slot.key!]: { id: data.document.id, fileName: file.fileName } }));
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (isNewApplicant) {
      if (!firstName.trim() || !lastName.trim()) {
        setSubmitError("Please enter your child's first name and surname.");
        return;
      }
      if (!dateOfBirth || !gender) {
        setSubmitError("Please enter your child's date of birth and gender.");
        return;
      }
      if (!guardians[0]?.phone.trim()) {
        setSubmitError("Please give a phone number for the first parent/guardian.");
        return;
      }
    }

    if (guardians.some((g) => !g.relationship.trim() || !g.firstName.trim() || !g.lastName.trim())) {
      setSubmitError("Each parent/guardian needs at least a relationship, first name, and last name.");
      return;
    }

    const ecProblem = emergencyContactProblem(
      { name: ecName, relationship: ecRelationship, phone: ecPhone },
      guardians,
    );
    if (ecProblem) {
      setSubmitError(ecProblem);
      return;
    }

    const notUploaded = docSlots.filter((s) => !uploads[s.key]).map((s) => s.label);
    if (notUploaded.length > 0) {
      setSubmitError(`Please upload: ${notUploaded.join(", ")}.`);
      return;
    }

    const body = {
      child: {
        ...(isNewApplicant
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              preferredStartDate: preferredStartDate || undefined,
            }
          : {}),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        childIdNumber: childIdNumber || undefined,
        photoImage: photoConsentGiven ? childPhoto || undefined : undefined,
        photoConsentGiven,
        allergies: allergies.trim() || undefined,
        homeAddress: homeAddress.trim() || undefined,
        emergencyContactName: ecName.trim() || undefined,
        emergencyContactRelationship: ecRelationship.trim() || undefined,
        emergencyContactPhone: ecPhone.trim() || undefined,
      },
      guardians: guardians.map((g) => ({
        relationship: g.relationship,
        firstName: g.firstName,
        lastName: g.lastName,
        idNumber: g.idNumber || undefined,
        occupation: g.occupation || undefined,
        phone: g.phone || undefined,
        extraPhones: cleanExtraPhones(g.extraPhones),
        email: g.email || undefined,
        address: g.address.trim() || undefined,
        photoImage: photoConsentGiven ? g.photoImage || undefined : undefined,
      })),
      uploadKey,
      documentIds: docSlots.map((s) => uploads[s.key]?.id).filter((id): id is string => Boolean(id)),
    };

    setSubmitting(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.error ?? "Could not submit the form.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="animate-in mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-4">
          <Logo variant="icon" size={44} className="rounded-xl" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {loading
            ? "Enrolment form"
            : isNewApplicant
              ? `Apply to ${organizationName || "the school"}`
              : purpose === "documents"
                ? `Documents for ${childFirstName}`
                : `Enrolment form for ${childFirstName}`}
        </h1>
        {!loading && !linkError && (
          <p className="mt-1 text-sm text-muted-foreground">{organizationName}</p>
        )}
      </div>

      <Card className="animate-in p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking your link…</p>
        ) : done ? (
          <p className="text-sm text-foreground">
            Thank you — your submission has been sent to {organizationName}. They&apos;ll review it
            and get in touch if anything else is needed.
          </p>
        ) : linkError ? (
          <p className="text-sm text-danger">{linkError}</p>
        ) : purpose === "documents" ? (
          // Documents-only link: each upload goes straight to the school.
          <div className="flex flex-col gap-3">
            {missing.length === 0 ? (
              <p className="text-sm text-foreground">
                Thank you — {organizationName} has everything it needs for {childFirstName}.
                {received.length > 0 ? ` Received: ${received.join(", ")}.` : ""}
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground">
                  {organizationName} still needs {missing.length === 1 ? "this document" : "these documents"} for{" "}
                  {childFirstName}. Take a clear photo of each (or upload a PDF). Each one is sent as soon as you
                  upload it.
                </p>
                {received.length > 0 && (
                  <p className="text-xs text-success">Received: {received.join(", ")}.</p>
                )}
                {missing.map((m) => (
                  <FormDocumentSlot
                    key={`${m.type}-${m.guardianId ?? ""}`}
                    label={m.label}
                    hint={requiredDocs.find((d) => d.type === m.type)?.hint}
                    required
                    fileName={null}
                    onPick={async (file) => {
                      const problem = await uploadDocument({ type: m.type, guardianId: m.guardianId }, file);
                      if (!problem) setReceived((prev) => [...prev, m.label]);
                      return problem;
                    }}
                  />
                ))}
                <p className="text-xs text-muted-foreground">
                  This link works for 7 days. Your documents are only seen by staff at {organizationName}.
                </p>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <p className="text-xs text-muted-foreground">
              This information is collected only to complete {childName}&apos;s enrolment at{" "}
              {organizationName}, is reviewed by staff before anything is saved to{" "}
              {childName}&apos;s record, and is processed only on {organizationName}&apos;s
              instructions.
            </p>

            <div className="flex flex-col gap-4">
              <h2 className="font-display text-sm font-semibold text-foreground">Child</h2>
              {isNewApplicant && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="childFirstName">First name *</Label>
                      <Input
                        id="childFirstName"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="childLastName">Surname *</Label>
                      <Input
                        id="childLastName"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="startDate">Preferred start date (optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={preferredStartDate}
                      onChange={(e) => setPreferredStartDate(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="dob">Date of birth{isNewApplicant ? " *" : ""}</Label>
                <Input
                  id="dob"
                  type="date"
                  required={isNewApplicant}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender{isNewApplicant ? " *" : ""}</Label>
                <Select
                  id="gender"
                  required={isNewApplicant}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">{isNewApplicant ? "Choose…" : "Not specified"}</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="childIdNumber">Child&apos;s ID number (if any)</Label>
                <Input
                  id="childIdNumber"
                  value={childIdNumber}
                  onChange={(e) => setChildIdNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="homeAddress">Home address</Label>
                <Input
                  id="homeAddress"
                  autoComplete="street-address"
                  placeholder="Street, suburb, town"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={photoConsentGiven}
                  onChange={(e) => setPhotoConsentGiven(e.target.checked)}
                />
                <span>
                  I consent to {childName}&apos;s (and any guardian&apos;s) photo below being
                  stored by {organizationName}, visible only to staff. Required to add a photo.
                </span>
              </label>
              <ImageUploadField
                label={`${childName}'s photo (optional)`}
                helpText="Only visible to staff at the school."
                value={childPhoto}
                disabled={!photoConsentGiven}
                round
                onChange={setChildPhoto}
              />
            </div>

            {guardians.map((g, i) => (
              <div key={i} className="flex flex-col gap-4 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Parent / guardian {guardians.length > 1 ? i + 1 : ""}
                  </h2>
                  {guardians.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGuardian(i)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div>
                  <Label htmlFor={`rel-${i}`}>Relationship to child</Label>
                  <Input
                    id={`rel-${i}`}
                    required
                    placeholder="Mother, Father, Grandmother, Legal guardian…"
                    value={g.relationship}
                    onChange={(e) => updateGuardian(i, { relationship: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`fn-${i}`}>First name</Label>
                    <Input
                      id={`fn-${i}`}
                      required
                      value={g.firstName}
                      onChange={(e) => updateGuardian(i, { firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`ln-${i}`}>Last name</Label>
                    <Input
                      id={`ln-${i}`}
                      required
                      value={g.lastName}
                      onChange={(e) => updateGuardian(i, { lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`id-${i}`}>ID number</Label>
                  <Input
                    id={`id-${i}`}
                    value={g.idNumber}
                    onChange={(e) => updateGuardian(i, { idNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`occ-${i}`}>Occupation</Label>
                  <Input
                    id={`occ-${i}`}
                    value={g.occupation}
                    onChange={(e) => updateGuardian(i, { occupation: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`phone-${i}`}>Phone{isNewApplicant && i === 0 ? " *" : ""}</Label>
                    <Input
                      id={`phone-${i}`}
                      type="tel"
                      required={isNewApplicant && i === 0}
                      value={g.phone}
                      onChange={(e) => updateGuardian(i, { phone: e.target.value })}
                    />
                  </div>
                  <ExtraPhonesField
                    idPrefix={`phone-${i}-x`}
                    values={g.extraPhones}
                    onChange={(v) => updateGuardian(i, { extraPhones: v })}
                  />
                  <div>
                    <Label htmlFor={`email-${i}`}>Email</Label>
                    <Input
                      id={`email-${i}`}
                      type="email"
                      value={g.email}
                      onChange={(e) => updateGuardian(i, { email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`addr-${i}`}>Address (only if different from the child&apos;s)</Label>
                  <Input
                    id={`addr-${i}`}
                    value={g.address}
                    onChange={(e) => updateGuardian(i, { address: e.target.value })}
                  />
                </div>
                <ImageUploadField
                  label="Photo (optional)"
                  helpText="Only visible to staff at the school. Needs the consent checkbox above."
                  value={g.photoImage}
                  disabled={!photoConsentGiven}
                  round
                  onChange={(dataUrl) => updateGuardian(i, { photoImage: dataUrl })}
                />
              </div>
            ))}

            {guardians.length < 6 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setGuardians((prev) => [...prev, blankGuardian()])}
              >
                Add another parent/guardian
              </Button>
            )}

            {docSlots.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <h2 className="font-display text-sm font-semibold text-foreground">Documents</h2>
                <p className="text-xs text-muted-foreground">
                  {organizationName} needs these. A clear photo from your phone is fine, or a PDF.
                </p>
                {docSlots.map((s) => (
                  <FormDocumentSlot
                    key={s.key}
                    label={s.label}
                    hint={s.hint}
                    required
                    fileName={uploads[s.key]?.fileName ?? null}
                    onPick={(file) => uploadDocument(s, file)}
                    onRemove={() =>
                      setUploads((prev) => {
                        const next = { ...prev };
                        delete next[s.key];
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-border pt-6">
              <h2 className="font-display text-sm font-semibold text-foreground">
                Allergies &amp; emergency contact
              </h2>
              <div>
                <Label htmlFor="allergies">Allergies or medical conditions (optional)</Label>
                <Textarea
                  id="allergies"
                  rows={2}
                  placeholder="e.g. Peanuts, bee stings, asthma pump in bag"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Emergency contact (optional): someone other than the parents/guardians above, for
                when you can&apos;t be reached. If you add one, give a name and phone number.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ecName">Name</Label>
                  <Input id="ecName" value={ecName} onChange={(e) => setEcName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ecRelationship">Relationship to child</Label>
                  <Input
                    id="ecRelationship"
                    placeholder="Aunt, Neighbour, Grandfather…"
                    value={ecRelationship}
                    onChange={(e) => setEcRelationship(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ecPhone">Phone</Label>
                <Input id="ecPhone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
              </div>
            </div>

            {submitError && <p className="text-sm text-danger">{submitError}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
