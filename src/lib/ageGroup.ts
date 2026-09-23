// Class age groups are stored in months (Category.ageMinMonths/MaxMonths)
// and shown in years, e.g. 24-36 -> "2–3 years".
export function monthsToYears(months: number): string {
  const y = months / 12;
  return Number.isInteger(y) ? String(y) : y.toFixed(1).replace(/\.0$/, "");
}

export function ageGroupLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${monthsToYears(min)}–${monthsToYears(max)} years`;
  if (min != null) return `${monthsToYears(min)} years and older`;
  return `Up to ${monthsToYears(max as number)} years`;
}
