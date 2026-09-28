import { normalizePhone } from "@/lib/phone";

// A child's emergency contact must be someone OTHER than the parents /
// guardians already on file (Dylan, 28 Sept 2026) -- the point is a second
// person to call when the parents can't be reached. Used by the add-child
// form (client), the create/edit routes and the Excel import, so the rule
// and its wording are identical everywhere.

export type EmergencyContactInput = {
  name?: string | null;
  relationship?: string | null;
  phone?: string | null;
};

export type PersonOnFile = {
  name?: string | null; // full name
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  extraPhones?: string[] | null;
};

function nameKey(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Comparable form of a phone: +27821234567 for any SA shape, else digits.
export function phoneKey(p: string | null | undefined): string | null {
  const n = normalizePhone(p ?? "");
  if (typeof n !== "string" || !n) return null;
  return n.replace(/[^\d+]/g, "") || null;
}

/** null when fine (or no emergency contact given); otherwise a message to show. */
export function emergencyContactProblem(ec: EmergencyContactInput, people: PersonOnFile[]): string | null {
  const name = (ec.name ?? "").trim();
  const phone = (ec.phone ?? "").trim();
  const rel = (ec.relationship ?? "").trim();
  if (!name && !phone && !rel) return null;
  if (!name) return "Add the emergency contact's name, or leave all the emergency contact fields empty.";
  if (!phone) return "Add the emergency contact's phone number, or leave all the emergency contact fields empty.";

  const ecPhone = phoneKey(phone);
  const ecName = nameKey(name);
  for (const p of people) {
    const full = nameKey(p.name ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`);
    if (full && full === ecName) {
      return "The emergency contact must be someone other than the parents or guardians. Add a different person.";
    }
    for (const raw of [p.phone, ...(p.extraPhones ?? [])]) {
      const pPhone = phoneKey(raw);
      if (ecPhone && pPhone && ecPhone === pPhone) {
        return "The emergency contact's phone number is the same as a parent's. Add a different person's number.";
      }
    }
  }
  return null;
}

/** How the phone is stored: +27… when it's a South African number, otherwise as typed. */
export function storedEmergencyPhone(phone: string | null | undefined): string | null {
  const t = (phone ?? "").trim();
  if (!t) return null;
  const n = normalizePhone(t);
  return typeof n === "string" && /^\+\d{8,15}$/.test(n) ? n : t;
}
