// Parent contact details live in two places (inspection finding D9):
//   - Child.parentName / parentPhone / parentEmail: the BILLING contact.
//     Statements, fee reminders and absence emails use these.
//   - Guardian rows: the full list of parents/guardians on the Centre
//     profile.
// Decision (Dylan, 24 Sept 2026): no schema change. The billing contact
// stays on Child, and it is linked to a guardian by matching. Editing the
// matching guardian keeps the billing contact in sync, and staff can pick
// a different guardian with "Use for fees & reminders".
import { normalizePhone } from "@/lib/phone";

type GuardianLike = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
};

type BillingLike = {
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
};

const E164 = /^\+[1-9]\d{7,14}$/;

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function phoneKey(p: string | null | undefined): string | null {
  const n = normalizePhone(p ?? "");
  return typeof n === "string" && n ? n : null;
}

// Which guardian (if any) IS the billing contact. Strongest signal first:
// full name, then email, then phone, so two guardians sharing a family
// email don't both count.
export function pickBillingGuardianId(guardians: GuardianLike[], billing: BillingLike): string | null {
  const name = norm(billing.parentName);
  const byName = guardians.find((g) => name && norm(`${g.firstName} ${g.lastName}`) === name);
  if (byName) return byName.id;

  const email = norm(billing.parentEmail);
  const byEmail = guardians.find((g) => email && norm(g.email) === email);
  if (byEmail) return byEmail.id;

  const phone = phoneKey(billing.parentPhone);
  const byPhone = guardians.find((g) => phone && phoneKey(g.phone) === phone);
  return byPhone ? byPhone.id : null;
}

export type BillingFields = {
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
};

// Turns a guardian into billing-contact fields. The guardian phone field is
// free text (paper forms), but the billing phone must be a real number in
// international format, so a phone that can't be read is reported rather
// than copied.
export function billingFieldsFromGuardian(
  g: Pick<GuardianLike, "firstName" | "lastName" | "phone" | "email">
): { fields: BillingFields; phoneProblem: boolean } {
  const phone = phoneKey(g.phone);
  const phoneOk = phone === null || E164.test(phone);
  return {
    fields: {
      parentName: `${g.firstName} ${g.lastName}`.trim().replace(/\s+/g, " "),
      parentPhone: phone && phoneOk ? phone : null,
      parentEmail: g.email?.trim() ? g.email.trim() : null,
    },
    phoneProblem: !phoneOk,
  };
}
