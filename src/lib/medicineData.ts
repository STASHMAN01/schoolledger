import { db } from "@/lib/db";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";

// Server-side helpers for the medicine register routes (Dylan, 5 Oct 2026).

export const dayString = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

export async function orgTimezone(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  return org?.timezone ?? "Africa/Johannesburg";
}

/** The school date a timestamp falls on, on the school's clock. */
export function schoolDayOf(when: Date, timeZone: string): string {
  return schoolClock(timeZone, when).date;
}

export const recordSelect = {
  id: true,
  medicineName: true,
  reason: true,
  isPrescribed: true,
  prescriberName: true,
  dose: true,
  route: true,
  frequency: true,
  scheduledTimes: true,
  startDate: true,
  endDate: true,
  lastDoseAtHome: true,
  storage: true,
  expiryDate: true,
  originalContainer: true,
  labelMatches: true,
  notExpired: true,
  specialInstructions: true,
  consentVersion: true,
  parentName: true,
  parentRelationship: true,
  parentPhone: true,
  signedAt: true,
  returnedAt: true,
  returnedNote: true,
  createdAt: true,
  categoryId: true,
  child: { select: { id: true, firstName: true, lastName: true, allergies: true, parentName: true, parentPhone: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  doses: {
    orderBy: { givenAt: "asc" as const },
    select: {
      id: true,
      givenAt: true,
      outcome: true,
      doseGiven: true,
      note: true,
      witnessName: true,
      givenBy: { select: { name: true } },
    },
  },
} as const;

type RecordRow = Awaited<ReturnType<typeof loadRecord>>;
type Loaded = NonNullable<RecordRow>;

export async function loadRecord(organizationId: string, recordId: string) {
  return db.medicineRecord.findFirst({ where: { id: recordId, organizationId }, select: recordSelect });
}

/** What the register page needs: dates as strings, only the doses of `date`. */
export function serializeRecord(r: Loaded, date: string, timeZone: string) {
  const { startDate, endDate, expiryDate, signedAt, doses, ...rest } = r;
  return {
    ...rest,
    startDate: dayString(startDate)!,
    endDate: dayString(endDate)!,
    expiryDate: dayString(expiryDate),
    signed: Boolean(signedAt),
    signedAt: signedAt ? signedAt.toISOString() : null,
    returnedAt: r.returnedAt ? r.returnedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    dosesToday: doses
      .filter((d) => schoolDayOf(d.givenAt, timeZone) === date)
      .map((d) => ({ ...d, givenAt: d.givenAt.toISOString(), givenBy: d.givenBy.name })),
    createdBy: r.createdBy.name,
  };
}

export { schoolDateValue };
