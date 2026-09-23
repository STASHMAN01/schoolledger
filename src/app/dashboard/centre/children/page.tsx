import { redirect } from "next/navigation";

// The separate Children tab was removed (Dylan 23 Sept): children are found
// and added under Enrolled. Child profiles still live at
// /dashboard/centre/children/[childId].
export default function CentreChildrenRedirect() {
  redirect("/dashboard/centre/enrolled");
}
