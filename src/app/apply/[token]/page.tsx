"use client";

// Public parent-facing enrolment form (Phase 2 Session 4) -- no session,
// no account, the token in the URL is the only proof needed (same model
// as /reset-password/[token]). Submitting here never touches the real
// Child/Guardian records: it lands as a ParentSubmission for staff to
// review and explicitly approve or reject (Dylan's explicit choice,
// 2026-09-21) -- see the ParentSubmission model comment in schema.prisma.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Logo } from "@/components/Logo";

type GuardianDraft = {
  relationship: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  occupation: string;
  phone: string;
  email: string;
  photoImage: string | null;
  idPhoto: string | null;
};

function blankGuardian(): GuardianDraft {
  return {
    relationship: "",
    firstName: "",
    lastName: "",
    idNumber: "",
    occupation: "",
    phone: "",
    email: "",
    photoImage: null,
    idPhoto: null,
  };
}

export default function ParentApplyPage() {
  const params = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [childFirstName, setChildFirstName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [childIdNumber, setChildIdNumber] = useState("");
  const [photoConsentGiven, setPhotoConsentGiven] = useState(false);
  const [childPhoto, setChildPhoto] = useState<string | null>(null);
  const [childIdPhoto, setChildIdPhoto] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<GuardianDraft[]>([blankGuardian()]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const check = useCallback(async () => {
    const res = await fetch(`/api/apply/${params.token}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLinkError(data?.error ?? "This link is invalid or has expired.");
    } else {
      setChildFirstName(data.childFirstName);
      setOrganizationName(data.organizationName);
    }
    setLoading(false);
  }, [params.token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial token check on mount
    check();
  }, [check]);

  function updateGuardian(index: number, patch: Partial<GuardianDraft>) {
    setGuardians((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (guardians.some((g) => !g.relationship.trim() || !g.firstName.trim() || !g.lastName.trim())) {
      setSubmitError("Each parent/guardian needs at least a relationship, first name, and last name.");
      return;
    }

    const attachments: { kind: "CHILD_ID" | "GUARDIAN_ID"; guardianIndex?: number; label: string; image: string }[] = [];
    if (childIdPhoto) {
      attachments.push({ kind: "CHILD_ID", label: `${childFirstName}'s ID document`, image: childIdPhoto });
    }
    guardians.forEach((g, i) => {
      if (g.idPhoto) {
        attachments.push({
          kind: "GUARDIAN_ID",
          guardianIndex: i,
          label: `${g.firstName} ${g.lastName}'s ID document`.trim() || "Guardian's ID document",
          image: g.idPhoto,
        });
      }
    });

    const body = {
      child: {
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        childIdNumber: childIdNumber || undefined,
        photoImage: photoConsentGiven ? childPhoto || undefined : undefined,
        photoConsentGiven,
      },
      guardians: guardians.map((g) => ({
        relationship: g.relationship,
        firstName: g.firstName,
        lastName: g.lastName,
        idNumber: g.idNumber || undefined,
        occupation: g.occupation || undefined,
        phone: g.phone || undefined,
        email: g.email || undefined,
        photoImage: photoConsentGiven ? g.photoImage || undefined : undefined,
      })),
      attachments,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply/${params.token}`, {
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
          {loading ? "Enrolment form" : `Enrolment form for ${childFirstName}`}
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
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <p className="text-xs text-muted-foreground">
              This information is collected only to complete {childFirstName}&apos;s enrolment at{" "}
              {organizationName}, is reviewed by staff before anything is saved to{" "}
              {childFirstName}&apos;s record, and is processed only on {organizationName}&apos;s
              instructions.
            </p>

            <div className="flex flex-col gap-4">
              <h2 className="font-display text-sm font-semibold text-foreground">Child</h2>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Not specified</option>
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
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={photoConsentGiven}
                  onChange={(e) => setPhotoConsentGiven(e.target.checked)}
                />
                <span>
                  I consent to {childFirstName}&apos;s (and any guardian&apos;s) photo below being
                  stored by {organizationName}, visible only to staff. Required to add a photo.
                </span>
              </label>
              <ImageUploadField
                label={`${childFirstName}'s photo (optional)`}
                helpText="Only visible to staff at the school."
                value={childPhoto}
                disabled={!photoConsentGiven}
                round
                onChange={setChildPhoto}
              />
              <ImageUploadField
                label={`${childFirstName}'s ID document (optional, if available)`}
                helpText="A photo of the ID book/card/birth certificate, for staff to verify against the number above."
                value={childIdPhoto}
                disabled={false}
                onChange={setChildIdPhoto}
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
                      onClick={() => setGuardians((prev) => prev.filter((_, idx) => idx !== i))}
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
                    <Label htmlFor={`phone-${i}`}>Phone</Label>
                    <Input
                      id={`phone-${i}`}
                      value={g.phone}
                      onChange={(e) => updateGuardian(i, { phone: e.target.value })}
                    />
                  </div>
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
                <ImageUploadField
                  label="Photo (optional)"
                  helpText="Only visible to staff at the school. Needs the consent checkbox above."
                  value={g.photoImage}
                  disabled={!photoConsentGiven}
                  round
                  onChange={(dataUrl) => updateGuardian(i, { photoImage: dataUrl })}
                />
                <ImageUploadField
                  label="ID document (optional)"
                  helpText="A photo of the ID book/card, for staff to verify against the number above."
                  value={g.idPhoto}
                  disabled={false}
                  onChange={(dataUrl) => updateGuardian(i, { idPhoto: dataUrl })}
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
