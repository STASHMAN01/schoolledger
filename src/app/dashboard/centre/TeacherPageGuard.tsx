"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOrg } from "../OrgContext";
import { teacherMayOpen } from "@/lib/teacherAccess";

/**
 * Sends a Teacher back to Centre home from any page that isn't theirs
 * (forms, admissions, documents, files, classes, staff, communication,
 * settings -- src/lib/teacherAccess.ts). The data behind those pages is
 * refused by the server anyway; this just avoids showing an empty or
 * error-filled page.
 */
export function TeacherPageGuard({ children }: { children: React.ReactNode }) {
  const { role } = useOrg();
  const pathname = usePathname();
  const router = useRouter();
  const blocked = role === "TEACHER" && !teacherMayOpen(pathname);

  useEffect(() => {
    if (blocked) router.replace("/dashboard/centre");
  }, [blocked, router]);

  if (blocked) return null;
  return <>{children}</>;
}
