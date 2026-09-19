"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

type Testimonial = {
  id: string;
  authorName: string;
  schoolName: string | null;
  quote: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { name: string; email: string } | null;
};

const STATUS_BADGE = {
  PENDING: "accent",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

export default function PlatformTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/platform/testimonials");
    const data = await res.json();
    if (res.ok) setTestimonials(data.testimonials);
    else setError(data.error ?? "Could not load testimonials.");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/platform/testimonials/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update this testimonial.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const visible =
    filter === "PENDING" ? testimonials.filter((t) => t.status === "PENDING") : testimonials;

  return (
    <div className="animate-in">
      <PageHeader
        title="Testimonials"
        description="Nothing submitted here shows on the public site until you approve it. Rejecting one just hides it — it's never deleted, and you can change your mind later."
      />

      <div className="mb-4 flex gap-2 text-sm">
        {(["PENDING", "ALL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`transition-standard rounded-lg px-3 py-1.5 font-medium ${
              filter === f
                ? "bg-brand-soft text-brand-soft-foreground"
                : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "PENDING" ? "Awaiting review" : "All"}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter === "PENDING" ? "Nothing waiting for review." : "No testimonials yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((t) => (
            <Card key={t.id} as="div" className="p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-foreground">{t.authorName}</span>
                  {t.schoolName && (
                    <span className="ml-2 text-sm text-muted-foreground">{t.schoolName}</span>
                  )}
                </div>
                <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
              </div>
              <p className="mb-3 whitespace-pre-wrap text-sm text-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Submitted {new Date(t.createdAt).toLocaleDateString()}
                {t.reviewedBy &&
                  ` · Reviewed by ${t.reviewedBy.name} on ${
                    t.reviewedAt ? new Date(t.reviewedAt).toLocaleDateString() : ""
                  }`}
              </p>
              {t.status !== "APPROVED" && (
                <Button size="sm" onClick={() => act(t.id, "approve")} disabled={busyId === t.id}>
                  Approve — show on website
                </Button>
              )}
              {t.status !== "REJECTED" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-2"
                  onClick={() => act(t.id, "reject")}
                  disabled={busyId === t.id}
                >
                  {t.status === "APPROVED" ? "Unpublish" : "Reject"}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
