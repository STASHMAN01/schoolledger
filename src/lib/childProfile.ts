// "Core" child details every child must have (Dylan 23 Sept): name, date of
// birth, gender, class, and a parent/guardian phone number. Anything else
// (ID numbers, medical info, ...) can come later. A child missing a core
// detail shows an "Incomplete profile" badge and feeds a dashboard to-do.
export type ProfileCheckInput = {
  dateOfBirth: Date | string | null;
  gender: string | null;
  parentPhone: string | null;
  guardians?: { phone: string | null }[];
};

export function missingCoreDetails(c: ProfileCheckInput): string[] {
  const missing: string[] = [];
  if (!c.dateOfBirth) missing.push("date of birth");
  if (!c.gender) missing.push("gender");
  const hasPhone = !!c.parentPhone || (c.guardians ?? []).some((g) => !!g.phone);
  if (!hasPhone) missing.push("a parent/guardian phone number");
  return missing;
}

export function isProfileIncomplete(c: ProfileCheckInput): boolean {
  return missingCoreDetails(c).length > 0;
}
