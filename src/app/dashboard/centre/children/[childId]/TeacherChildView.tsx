"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

// What a Teacher sees when they open a child (Dylan, 4 Oct 2026): name,
// class, gender, age, allergies and emergency contact, read-only. The
// server sends nothing more (serializeChildForTeacher in childView.ts).
type TeacherChild = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  category: { name: string } | null;
};

const GENDER_LABEL: Record<string, string> = { MALE: "Boy", FEMALE: "Girl", OTHER: "Other" };

function ageText(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "Not recorded";
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let months = (now.getFullYear() - dob.getUTCFullYear()) * 12 + (now.getMonth() - dob.getUTCMonth());
  if (now.getDate() < dob.getUTCDate()) months -= 1;
  if (months < 0) return "Not recorded";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  return rest === 0 ? `${years} year${years === 1 ? "" : "s"}` : `${years} year${years === 1 ? "" : "s"}, ${rest} month${rest === 1 ? "" : "s"}`;
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-6">
      <span className="w-40 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${warn ? "font-semibold text-danger" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

export function TeacherChildView({ organizationId, childId }: { organizationId: string; childId: string }) {
  const [child, setChild] = useState<TeacherChild | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/organizations/${organizationId}/children/${childId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Couldn't load this child.");
        else setChild(data.child);
      })
      .catch(() => !cancelled && setError("Couldn't load this child."));
    return () => {
      cancelled = true;
    };
  }, [organizationId, childId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!child) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const allergies = child.allergies?.trim();
  const emergency = child.emergencyContactName
    ? [
        child.emergencyContactName,
        child.emergencyContactRelationship ? `(${child.emergencyContactRelationship})` : "",
        child.emergencyContactPhone ?? "",
      ]
        .filter(Boolean)
        .join(" ")
    : "Not recorded";

  return (
    <div className="animate-in max-w-2xl">
      <Link href="/dashboard/centre/enrolled" className="mb-3 inline-block text-sm text-brand hover:underline">
        ← Back to Enrolled
      </Link>
      <PageHeader title={`${child.firstName} ${child.lastName}`} description={child.category?.name ?? undefined} />
      <Card className="divide-y divide-border px-4">
        <Row label="Gender" value={child.gender ? GENDER_LABEL[child.gender] ?? child.gender : "Not recorded"} />
        <Row label="Age" value={ageText(child.dateOfBirth)} />
        <Row label="Allergies" value={allergies || "None recorded"} warn={Boolean(allergies)} />
        <Row label="Emergency contact" value={emergency} />
      </Card>
    </div>
  );
}
