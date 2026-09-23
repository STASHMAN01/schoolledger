"use client";

// One-time link to update an EXISTING child's details (Phase 2 Session 4).
// The form itself is shared with the school's permanent new-family link --
// see src/app/apply/ParentForm.tsx.
import { useParams } from "next/navigation";
import { ParentForm } from "../ParentForm";

export default function ParentApplyPage() {
  const params = useParams<{ token: string }>();
  return <ParentForm apiPath={`/api/apply/${params.token}`} isNewApplicant={false} />;
}
