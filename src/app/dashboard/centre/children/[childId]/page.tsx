"use client";

// A child's full Centre Management profile: photo (with required consent),
// date of birth, masked ID numbers with an audit-logged reveal, and one or
// more guardians -- Phase 2 Session 1 per docs/PLAN.md. No money anywhere
// on this page; billing fields (fee override, exit date, category/class
// reassignment) stay on the Accounting-side child page.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOrg, useHasPermission } from "../../../OrgContext";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { ImageUploadField } from "@/components/ImageUploadField";

type Guardian = {
  id: string;
  relationship: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  photoImage: string | null;
};

type ChildProfile = {
  id: string;
  firstName: string;
  lastName: string;
  category: { name: string };
  dateOfBirth: string | null;
  photoImage: string | null;
  photoConsentGiven: boolean;
  childIdNumber: string | null;
  parentIdNumber: string | null;
  guardians: Guardian[];
};

function RevealableId({
  label,
  masked,
  onReveal,
}: {
  label: string;
  masked: string | null;
  onReveal: () => Promise<string | null>;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!masked) return <p className="text-sm text-muted-foreground">{label}: not on file</p>;

  return (
    <p className="text-sm text-foreground">
      {label}:{" "}
      <span className="font-mono">{revealed ?? masked}</span>{" "}
      {revealed === null && (
        <button
          type="button"
          className="text-brand underline underline-offset-2"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            const value = await onReveal();
            setRevealed(value ?? "(none)");
            setLoading(false);
          }}
        >
          {loading ? "Revealing…" : "Reveal"}
        </button>
      )}
    </p>
  );
}

function GuardianCard({
  guardian,
  canManage,
  onUpdate,
  onDelete,
  onReveal,
}: {
  guardian: Guardian;
  canManage: boolean;
  onUpdate: (id: string, patch: Partial<Guardian>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReveal: (id: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(guardian.firstName);
  const [lastName, setLastName] = useState(guardian.lastName);
  const [relationship, setRelationship] = useState(guardian.relationship);
  const [occupation, setOccupation] = useState(guardian.occupation ?? "");
  const [phone, setPhone] = useState(guardian.phone ?? "");
  const [email, setEmail] = useState(guardian.email ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <Card as="div" className="p-4">
      <div className="flex items-start gap-3">
        {guardian.photoImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL
          <img
            src={guardian.photoImage}
            alt=""
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border-strong text-xs text-muted">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              </div>
              <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Relationship (e.g. Mother)" />
              <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Occupation" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    await onUpdate(guardian.id, { firstName, lastName, relationship, occupation, phone, email });
                    setSaving(false);
                    setEditing(false);
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {guardian.firstName} {guardian.lastName}{" "}
                <Badge variant="neutral">{guardian.relationship}</Badge>
              </p>
              {guardian.occupation && (
                <p className="text-sm text-muted-foreground">{guardian.occupation}</p>
              )}
              {guardian.phone && <p className="text-sm text-muted-foreground">{guardian.phone}</p>}
              {guardian.email && <p className="text-sm text-muted-foreground">{guardian.email}</p>}
              <div className="mt-1">
                <RevealableId
                  label="ID number"
                  masked={guardian.idNumber}
                  onReveal={() => onReveal(guardian.id)}
                />
              </div>
              {canManage && (
                <div className="mt-2 flex gap-3 text-sm">
                  <button type="button" className="text-brand underline underline-offset-2" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-danger underline underline-offset-2"
                    onClick={() => onDelete(guardian.id)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ChildProfilePage() {
  const { organizationId } = useOrg();
  const canManage = useHasPermission("MANAGE_CHILDREN");
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [child, setChild] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [gFirstName, setGFirstName] = useState("");
  const [gLastName, setGLastName] = useState("");
  const [gRelationship, setGRelationship] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/children/${childId}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    if (res.ok) {
      setChild(data.child);
      setDateOfBirth(data.child.dateOfBirth ? data.child.dateOfBirth.slice(0, 10) : "");
    }
    setLoading(false);
  }, [organizationId, childId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  async function patchChild(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/children/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save that change.");
      return;
    }
    load();
  }

  async function revealChildField(field: "childIdNumber" | "parentIdNumber") {
    const res = await fetch(
      `/api/organizations/${organizationId}/children/${childId}/reveal-id`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      }
    );
    const data = await res.json();
    return res.ok ? (data.value as string | null) : null;
  }

  async function revealGuardianId(guardianId: string) {
    const res = await fetch(
      `/api/organizations/${organizationId}/children/${childId}/guardians/${guardianId}/reveal-id`,
      { method: "POST" }
    );
    const data = await res.json();
    return res.ok ? (data.value as string | null) : null;
  }

  async function addGuardian(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/organizations/${organizationId}/children/${childId}/guardians`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: gFirstName,
          lastName: gLastName,
          relationship: gRelationship,
        }),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add that guardian.");
      return;
    }
    setGFirstName("");
    setGLastName("");
    setGRelationship("");
    setShowAddGuardian(false);
    load();
  }

  async function updateGuardian(id: string, patch: Partial<Guardian>) {
    await fetch(
      `/api/organizations/${organizationId}/children/${childId}/guardians/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    load();
  }

  async function deleteGuardian(id: string) {
    if (!confirm("Remove this guardian from the profile?")) return;
    await fetch(
      `/api/organizations/${organizationId}/children/${childId}/guardians/${id}`,
      { method: "DELETE" }
    );
    load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (notFound || !child) {
    return (
      <p className="text-sm text-muted-foreground">
        That child couldn&apos;t be found, or isn&apos;t in your class.
      </p>
    );
  }

  return (
    <div className="animate-in">
      <PageHeader
        title={`${child.firstName} ${child.lastName}`}
        description={child.category.name}
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card as="div" className="p-5">
          <h2 className="font-display mb-4 text-sm font-semibold text-foreground">
            Photo & birthdate
          </h2>
          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={child.photoConsentGiven}
                disabled={!canManage || child.photoConsentGiven}
                onChange={(e) => patchChild({ photoConsentGiven: e.target.checked })}
              />
              <span>
                Parent/guardian has consented to this child&apos;s photo being stored.
                {child.photoConsentGiven ? " (on file)" : " Required before a photo can be uploaded."}
              </span>
            </label>
            <ImageUploadField
              label="Child's photo"
              helpText="Only visible inside the app to staff with access to this class."
              value={child.photoImage}
              disabled={!canManage || !child.photoConsentGiven}
              round
              onChange={(dataUrl) => patchChild({ photoImage: dataUrl, photoConsentGiven: true })}
            />
            <div>
              <Label>Date of birth</Label>
              <Input
                type="date"
                value={dateOfBirth}
                disabled={!canManage}
                onChange={(e) => setDateOfBirth(e.target.value)}
                onBlur={() => dateOfBirth && patchChild({ dateOfBirth })}
              />
            </div>
          </div>
        </Card>

        <Card as="div" className="p-5">
          <h2 className="font-display mb-4 text-sm font-semibold text-foreground">
            ID numbers
          </h2>
          <div className="flex flex-col gap-3">
            <RevealableId
              label="Child's ID number"
              masked={child.childIdNumber}
              onReveal={() => revealChildField("childIdNumber")}
            />
            <RevealableId
              label="Parent's ID number"
              masked={child.parentIdNumber}
              onReveal={() => revealChildField("parentIdNumber")}
            />
            <p className="text-xs text-muted-foreground">
              Masked by default. Every reveal is recorded in the activity log.
              To add or change one, use Accounting → Children (this page doesn&apos;t
              edit them yet).
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-foreground">Guardians</h2>
        {canManage && (
          <Button size="sm" onClick={() => setShowAddGuardian((v) => !v)}>
            {showAddGuardian ? "Cancel" : "Add guardian"}
          </Button>
        )}
      </div>

      {showAddGuardian && (
        <Card as="div" className="mt-3 p-4">
          <form onSubmit={addGuardian} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <Label>First name</Label>
              <Input required value={gFirstName} onChange={(e) => setGFirstName(e.target.value)} />
            </div>
            <div className="min-w-[140px]">
              <Label>Last name</Label>
              <Input required value={gLastName} onChange={(e) => setGLastName(e.target.value)} />
            </div>
            <div className="min-w-[160px]">
              <Label>Relationship</Label>
              <Input required placeholder="Mother, Father, ..." value={gRelationship} onChange={(e) => setGRelationship(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </form>
        </Card>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {child.guardians.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guardians on file yet.</p>
        ) : (
          child.guardians.map((g) => (
            <GuardianCard
              key={g.id}
              guardian={g}
              canManage={canManage}
              onUpdate={updateGuardian}
              onDelete={deleteGuardian}
              onReveal={revealGuardianId}
            />
          ))
        )}
      </div>
    </div>
  );
}
