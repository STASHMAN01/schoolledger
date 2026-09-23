"use client";

// The school's permanent "apply" link for NEW families (fix session B,
// Dylan 23 Sept). Anyone with the link can apply; nothing is created until
// a staff member approves the submission under Admissions > Online
// submissions. Same form as the per-child link, in new-family mode.
import { useParams } from "next/navigation";
import { ParentForm } from "../../ParentForm";

export default function SchoolApplyPage() {
  const params = useParams<{ token: string }>();
  return <ParentForm apiPath={`/api/apply/school/${params.token}`} isNewApplicant />;
}
