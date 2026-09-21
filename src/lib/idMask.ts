// Masks a government/national ID number for display: everything except
// the last 4 characters becomes a bullet. Used everywhere a child or
// guardian ID number is returned from the API by default -- the full
// value is only ever sent back by the dedicated reveal endpoints, which
// log an AuditLog "child.idNumber.revealed" entry each time (see
// src/app/api/organizations/[organizationId]/children/[childId]/reveal-id/route.ts).
//
// Deliberately a display-time transform, not a stored/encrypted column --
// the underlying value is unchanged in the database.
export function maskIdNumber(value: string | null): string | null {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return "•".repeat(trimmed.length - 4) + trimmed.slice(-4);
}
