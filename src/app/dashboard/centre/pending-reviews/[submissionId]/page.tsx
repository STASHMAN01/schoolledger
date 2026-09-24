"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../../OrgContext";
import { Badge, Button, Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { todayLocal } from "@/lib/date";

type SubmittedGuardian = {
  relationship: string;
  firstName: string;
  lastName: string;
  idNumber?: string;
  occupation?: string;
  phone?: string;
  email?: string;
  photoImage?: string | null;
};

type SubmissionDetail = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isNewApplicant: boolean;
  createdChildId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  data: {
    child: {
      firstName?: string;
      lastName?: string;
      preferredStartDate?: string;
      dateOfBirth?: string;
      gender?: "MALE" | "FEMALE" | "OTHER";
      childIdNumber?: string;
      photoImage?: string | null;
      photoConsentGiven?: boolean;
    };
    guardians: SubmittedGuardian[];
  };
  attachments: { id: string; kind: string; label: string; image: string }[];
};

type CurrentChild = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  childIdNumber: string | null;
  parentName?: string;
};

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  return v;
}

export default function ReviewSubmissionPage() {
  const { organizationId } = useOrg();
  const params = useParams<{ submissionId: string }>();
  const router = useRouter();

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [current, setCurrent] = useState<{ child: CurrentChild; guardians: { firstName: string; lastName: string; relationship: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  // Off by default: an update from (say) a grandparent shouldn't silently
  // redirect fee reminders. See lib/billingContact.ts.
  const [updateBilling, setUpdateBilling] = useState(false);
  // New family only: which class and from when (fees start from this date).
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/parent-submissions/${params.submissionId}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSubmission(data.submission);
      setCurrent(data.current);
      if (data.submission.isNewApplicant) {
        setStartDate(data.submission.data.child.preferredStartDate?.slice(0, 10) || todayLocal());
        const cRes = await fetch(`/api/organizations/${organizationId}/categories`);
        const cData = await cRes.json().catch(() => ({}));
        if (cRes.ok) {
          const active = (cData.categories as { id: string; name: string; archived: boolean }[]).filter(
            (k) => !k.archived
          );
          setClasses(active);
          setClassId(active[0]?.id ?? "");
        }
      }
    } else {
      setError(data.error ?? "Not found.");
    }
    setLoading(false);
  }, [organizationId, params.submissionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function decide(action: "approve" | "reject") {
    setDeciding(true);
    setError(null);
    const res = await fetch(
      `/api/organizations/${organizationId}/parent-submissions/${params.submissionId}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject"
            ? { reviewNotes }
            : submission?.isNewApplicant
              ? { categoryId: classId, enrollmentDate: startDate }
              : { updateBillingContact: updateBilling }
        ),
      }
    );
    const data = await res.json().catch(() => ({}));
    setDeciding(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save that decision.");
      return;
    }
    router.push("/dashboard/centre/admissions#submissions");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error && !submission) return <p className="text-sm text-danger">{error}</p>;
  if (!submission) return null;

  const c = submission.data.child;
  const isNew = submission.isNewApplicant;
  const onFile = current?.child ?? null;

  return (
    <div className="animate-in">
      <PageHeader
        title={
          isNew
            ? `New family: ${c.firstName ?? ""} ${c.lastName ?? ""}`
            : `Review: ${onFile?.firstName ?? ""} ${onFile?.lastName ?? ""}`
        }
        description={
          isNew
            ? "A new family applied with the school's online link. Nothing is saved until you approve it — approving enrols the child in the class you choose and starts their fees from the start date."
            : "What the parent submitted, next to what's currently on file. Nothing here is saved until you approve it."
        }
      />

      <div className="mb-6 flex items-center gap-2">
        <Badge variant={submission.status === "PENDING" ? "accent" : submission.status === "APPROVED" ? "success" : "danger"}>
          {submission.status}
        </Badge>
        <Link href="/dashboard/centre/admissions#submissions" className="text-sm text-brand underline">
          Back to online submissions
        </Link>
      </div>

      <Card as="div" className="mb-6 p-5">
        <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Child</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-1/3 pb-2 font-normal">Field</th>
              <th className="w-1/3 pb-2 font-normal">Currently on file</th>
              <th className="w-1/3 pb-2 font-normal">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isNew && (
              <>
                <tr>
                  <td className="py-2 text-muted-foreground">Name</td>
                  <td className="py-2">—</td>
                  <td className="py-2 font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Preferred start</td>
                  <td className="py-2">—</td>
                  <td className="py-2 font-medium text-foreground">{fmt(c.preferredStartDate?.slice(0, 10))}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="py-2 text-muted-foreground">Date of birth</td>
              <td className="py-2">{fmt(onFile?.dateOfBirth?.slice(0, 10))}</td>
              <td className="py-2 font-medium text-foreground">{fmt(c.dateOfBirth)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Gender</td>
              <td className="py-2">{fmt(onFile?.gender)}</td>
              <td className="py-2 font-medium text-foreground">{fmt(c.gender)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Child ID number</td>
              <td className="py-2">{fmt(onFile?.childIdNumber)}</td>
              <td className="py-2 font-medium text-foreground">{fmt(c.childIdNumber)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Photo consent</td>
              <td className="py-2">—</td>
              <td className="py-2 font-medium text-foreground">{c.photoConsentGiven ? "Given" : "Not given"}</td>
            </tr>
          </tbody>
        </table>
        {c.photoImage && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL */}
            <img src={c.photoImage} alt="Submitted child photo" className="h-20 w-20 rounded-full border border-border object-cover" />
          </div>
        )}
      </Card>

      <Card as="div" className="mb-6 p-5">
        <h2 className="font-display mb-3 text-sm font-semibold text-foreground">
          Guardians submitted ({submission.data.guardians.length})
        </h2>
        {current && current.guardians.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            Already on file: {current.guardians.map((g) => `${g.firstName} ${g.lastName} (${g.relationship})`).join(", ")}.
            Approving adds the submitted guardians below as new entries alongside these.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {submission.data.guardians.map((g, i) => (
            <div key={i} className="flex items-start gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
              {g.photoImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL
                <img src={g.photoImage} alt="" className="h-12 w-12 shrink-0 rounded-full border border-border object-cover" />
              ) : null}
              <div>
                <p className="font-medium text-foreground">
                  {g.firstName} {g.lastName} <Badge variant="neutral">{g.relationship}</Badge>
                </p>
                {g.occupation && <p className="text-sm text-muted-foreground">{g.occupation}</p>}
                {g.phone && <p className="text-sm text-muted-foreground">{g.phone}</p>}
                {g.email && <p className="text-sm text-muted-foreground">{g.email}</p>}
                {g.idNumber && <p className="text-sm text-muted-foreground">ID: {g.idNumber}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {submission.attachments.length > 0 && (
        <Card as="div" className="mb-6 p-5">
          <h2 className="font-display mb-3 text-sm font-semibold text-foreground">ID document photos</h2>
          <div className="flex flex-wrap gap-4">
            {submission.attachments.map((a) => (
              <div key={a.id} className="w-40">
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL */}
                <img src={a.image} alt={a.label} className="mb-1 w-full rounded-lg border border-border object-cover" />
                <p className="text-xs text-muted-foreground">{a.label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {submission.status === "PENDING" ? (
        <Card as="div" className="p-5">
          <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Decision</h2>
          <div className="mb-3">
            <Textarea
              placeholder="Optional note (shown only if you reject)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={2}
            />
          </div>
          {isNew && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="approveClass">Enrol in class</Label>
                <Select id="approveClass" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {classes.length === 0 && <option value="">No classes yet</option>}
                  {classes.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="approveStart">Start date (fees start from here)</Label>
                <Input id="approveStart" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
          )}
          {!isNew && submission.data.guardians.length > 0 && (
            <label className="mb-4 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={updateBilling}
                onChange={(e) => setUpdateBilling(e.target.checked)}
              />
              <span>
                Also send fees &amp; reminders to {submission.data.guardians[0].firstName}{" "}
                {submission.data.guardians[0].lastName} from now on
                {onFile?.parentName ? ` (currently ${onFile.parentName})` : ""}. Statements, fee
                reminders and absence emails use this contact.
              </span>
            </label>
          )}
          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={deciding || (isNew && (!classId || !startDate))}
              onClick={() => decide("approve")}
            >
              {deciding ? "Saving…" : isNew ? "Approve — enrol this child" : "Approve — save to child & guardians"}
            </Button>
            <Button variant="secondary" disabled={deciding} onClick={() => decide("reject")}>
              Reject
            </Button>
          </div>
        </Card>
      ) : (
        <Card as="div" className="p-5">
          <p className="text-sm text-muted-foreground">
            Already {submission.status.toLowerCase()}
            {submission.reviewedAt ? ` on ${new Date(submission.reviewedAt).toLocaleDateString()}` : ""}.
            {submission.reviewNotes ? ` Note: ${submission.reviewNotes}` : ""}
          </p>
        </Card>
      )}
    </div>
  );
}
