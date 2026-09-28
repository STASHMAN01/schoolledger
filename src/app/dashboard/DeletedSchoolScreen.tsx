"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

// Shown instead of the whole dashboard while the school is in the 30-day
// trash (Organization.deletedAt) -- see the gate in dashboard/layout.tsx.
// Admins can restore it; everyone else is told to ask one.
export function DeletedSchoolScreen({
  organizationId,
  schoolName,
  purgeAfter,
  canRestore,
}: {
  organizationId: string;
  schoolName: string;
  purgeAfter: string;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "restoring" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const when = new Date(purgeAfter).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function restore() {
    setStatus("restoring");
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/account/restore`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not restore the school. Try again.");
      setStatus("error");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <Card className="animate-in p-6 text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {schoolName} has been deleted
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It will be permanently removed on{" "}
          <span className="font-medium text-foreground">{when}</span>, together with all its
          children, payments and records. Until then it can be restored exactly as it was.
        </p>
        {canRestore ? (
          <Button className="mt-4" onClick={restore} disabled={status === "restoring"}>
            {status === "restoring" ? "Restoring…" : "Restore school"}
          </Button>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Only an admin of this school can restore it.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </Card>
    </div>
  );
}
