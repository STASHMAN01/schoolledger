"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrg } from "../../../OrgContext";
import { Badge, Button, Card, PageHeader, Textarea } from "@/components/ui";

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
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  data: {
    child: {
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

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/parent-submissions/${params.submissionId}`);
    const data = await res.json();
    if (res.ok) {
      setSubmission(data.submission);
      setCurrent(data.current);
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
        body: JSON.stringify(action === "reject" ? { reviewNotes } : undefined),
      }
    );
    const data = await res.json();
    setDeciding(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save that decision.");
      return;
    }
    router.push("/dashboard/centre/pending-reviews");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error && !submission) return <p className="text-sm text-danger">{error}</p>;
  if (!submission || !current) return null;

  const c = submission.data.child;

  return (
    <div className="animate-in">
      <PageHeader
        title={`Review: ${current.child.firstName} ${current.child.lastName}`}
        description="What the parent submitted, next to what's currently on file. Nothing here is saved until you approve it."
      />

      <div className="mb-6 flex items-center gap-2">
        <Badge variant={submission.status === "PENDING" ? "accent" : submission.status === "APPROVED" ? "success" : "danger"}>
          {submission.status}
        </Badge>
        <Link href="/dashboard/centre/pending-reviews" className="text-sm text-brand underline">
          Back to pending reviews
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
            <tr>
              <td className="py-2 text-muted-foreground">Date of birth</td>
              <td className="py-2">{fmt(current.child.dateOfBirth?.slice(0, 10))}</td>
              <td className="py-2 font-medium text-foreground">{fmt(c.dateOfBirth)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Gender</td>
              <td className="py-2">{fmt(current.child.gender)}</td>
              <td className="py-2 font-medium text-foreground">{fmt(c.gender)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Child ID number</td>
              <td className="py-2">{fmt(current.child.childIdNumber)}</td>
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
        {current.guardians.length > 0 && (
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
          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button disabled={deciding} onClick={() => decide("approve")}>
              {deciding ? "Saving…" : "Approve — save to child & guardians"}
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
