import { redirect } from "next/navigation";

// "Pending reviews" was renamed "Online submissions" and moved into
// Admissions (Dylan 23 Sept). Old links/bookmarks land in the right place.
export default function PendingReviewsRedirect() {
  redirect("/dashboard/centre/admissions#submissions");
}
