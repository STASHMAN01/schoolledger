// Sets up the sales-demo school's classes and fees (Dylan, 29 Sept 2026).
//
//   node --env-file=.env scripts/setup-demo-school.mjs <admin email of the demo school>
//
// Only touches a school whose name contains "Demo", so it can never change a
// real customer. Safe to run again: classes are matched by name and updated.
// Adds NO children -- those come from the demo CSV, imported live in front of
// the prospect.
//
// Also (Dylan, 30 Sept 2026): marks the demo login's email as verified, so
// the demo account works without clicking a verification link (the demo
// address has no real inbox). Billing is left alone: the school stays on its
// normal free trial, so reviewers (e.g. Paystack) see the real Billing page.
import { PrismaClient } from "@prisma/client";

const CLASSES = [
  { name: "Baby Bees", ageMinMonths: 3, ageMaxMonths: 12, fee: 3900 },
  { name: "Ladybugs", ageMinMonths: 12, ageMaxMonths: 24, fee: 3600 },
  { name: "Butterflies", ageMinMonths: 24, ageMaxMonths: 36, fee: 3300 },
  { name: "Grasshoppers", ageMinMonths: 36, ageMaxMonths: 48, fee: 3100 },
  { name: "Grade RR", ageMinMonths: 48, ageMaxMonths: 60, fee: 2950 },
  { name: "Grade R", ageMinMonths: 60, ageMaxMonths: 72, fee: 2950 },
];

// One-time charges. Registration is added to every child automatically on
// enrolment (src/lib/billing/financialPlan.ts), so the demo shows it too.
const ONE_TIME = [
  { name: "Registration", amount: 1000 },
  { name: "Uniform", amount: 450 },
  { name: "Trip", amount: 250 },
];

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node --env-file=.env scripts/setup-demo-school.mjs <admin email of the demo school>");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) throw new Error(`No account with the email ${email}. Sign up the demo school first.`);

  const memberships = await db.membership.findMany({
    where: { userId: user.id, role: "ADMIN" },
    include: { organization: true },
  });
  const demo = memberships.map((m) => m.organization).filter((o) => !o.deletedAt && /demo/i.test(o.name));
  if (demo.length !== 1) {
    throw new Error(
      demo.length
        ? `That account runs ${demo.length} schools with "Demo" in the name; keep only one.`
        : `That account has no school with "Demo" in its name. Name the school e.g. "Sunflower Preschool (Demo)".`
    );
  }
  const org = demo[0];
  console.log(`Setting up: ${org.name}`);

  if (!user.emailVerified) {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    console.log(`  login  ${user.email} marked as verified`);
  }

  for (const c of CLASSES) {
    const data = { ageMinMonths: c.ageMinMonths, ageMaxMonths: c.ageMaxMonths, monthlyFeeCents: c.fee * 100, archived: false };
    const existing = await db.category.findFirst({
      where: { organizationId: org.id, deletedAt: null, name: { equals: c.name, mode: "insensitive" } },
    });
    if (existing) await db.category.update({ where: { id: existing.id }, data });
    else await db.category.create({ data: { organizationId: org.id, name: c.name, ...data } });
    console.log(`  class  ${c.name.padEnd(13)} R${c.fee}/month`);
  }

  for (const t of ONE_TIME) {
    const existing = await db.paymentType.findFirst({
      where: { organizationId: org.id, isRecurring: false, isEventType: false, name: { equals: t.name, mode: "insensitive" } },
    });
    const data = { defaultAmountCents: t.amount * 100, active: true };
    if (existing) await db.paymentType.update({ where: { id: existing.id }, data });
    else await db.paymentType.create({ data: { organizationId: org.id, name: t.name, isRecurring: false, ...data } });
    console.log(`  charge ${t.name.padEnd(13)} R${t.amount} once`);
  }

  // Statements and reminder emails show these; fill only what's empty.
  const details = {};
  if (!org.addressLine1) details.addressLine1 = "12 Sunflower Street, Garsfontein";
  if (!org.province) details.province = "Gauteng";
  if (!org.contactName) details.contactName = user.name || "Principal";
  if (Object.keys(details).length) await db.organization.update({ where: { id: org.id }, data: details });

  const kids = await db.child.count({ where: { organizationId: org.id } });
  console.log(`Done. ${kids} children in this school (import the demo CSV to add them).`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
