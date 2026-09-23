import archiver from "archiver";
import zipEncrypted from "archiver-zip-encrypted";
import { PassThrough } from "stream";
import { db } from "@/lib/db";
import { decryptField } from "@/lib/fieldCrypto";
import { generateStatementPdf } from "@/lib/billing/statementPdf";
import { statementChildInclude, toStatementChild } from "@/lib/billing/statementData";
import {
  childFolderName,
  decodeDataUrl,
  formTypeLabel,
  generateBackupPassword,
  isoDate,
  sanitizeFilePart,
  shortId,
} from "./helpers";

// Registering the same format twice throws — which happens on every dev
// hot reload of this module — so swallow that one case.
try {
  archiver.registerFormat("zip-encrypted", zipEncrypted);
} catch {
  // already registered
}

type ZipEntry = { name: string; data: Buffer | string };

/**
 * Builds a full, AES-256 password-protected ZIP of one organization's data
 * (Phase 4 "Download full backup"). Everything is scoped by organizationId
 * and buffered in memory — fine for a preschool-sized dataset; a school
 * with hundreds of photos/PDFs may later need streaming or a background
 * job (flagged in docs/PROGRESS.md, not built).
 *
 * Trashed rows (deletedAt set) are included: a backup means everything.
 * Never included: password hashes, token hashes, Paystack tokens.
 */
export async function buildOrgBackupZip(
  organizationId: string
): Promise<{ zipBuffer: Buffer; password: string; counts: Record<string, number>; schoolName: string }> {
  const organization = await db.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new Error("Organization not found.");

  const entries: ZipEntry[] = [];
  const counts: Record<string, number> = {};
  let skippedFiles = 0;
  const json = (name: string, value: unknown) =>
    entries.push({ name: `data/${name}`, data: JSON.stringify(value, null, 2) });
  const addDataUrl = (path: string, value: string | null | undefined) => {
    if (!value) return;
    const decoded = decodeDataUrl(value);
    if (!decoded) {
      skippedFiles++;
      return;
    }
    entries.push({ name: `${path}.${decoded.ext}`, data: decoded.bytes });
  };

  // ---- Organization profile ------------------------------------------------
  const {
    logoImage,
    letterheadImage,
    paystackCustomerCode: _pc,
    paystackSubscriptionCode: _ps,
    paystackPlanCode: _pp,
    paystackEmailToken: _pt,
    bankAccountNumber,
    ...orgProfile
  } = organization;
  void _pc;
  void _ps;
  void _pp;
  void _pt;
  let bankAccountPlain: string | null = null;
  if (bankAccountNumber) {
    try {
      bankAccountPlain = decryptField(bankAccountNumber);
    } catch {
      bankAccountPlain = "(unreadable — please re-enter in Settings)";
    }
  }
  json("organization.json", { ...orgProfile, bankAccountNumber: bankAccountPlain });
  addDataUrl("school/logo", logoImage);
  addDataUrl("school/letterhead", letterheadImage);

  // ---- Core records ----------------------------------------------------------
  const where = { organizationId };
  const [
    classes,
    children,
    guardians,
    paymentTypes,
    events,
    eventClasses,
    planEntries,
    payments,
    creditBalances,
    attendance,
    submissions,
    memberships,
    auditLogs,
    formDocs,
    scheduleItems,
    whatsappChecks,
  ] = await Promise.all([
    db.category.findMany({ where, orderBy: { name: "asc" } }),
    db.child.findMany({ where, omit: { photoImage: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.guardian.findMany({ where, omit: { photoImage: true }, orderBy: { createdAt: "asc" } }),
    db.paymentType.findMany({ where }),
    db.event.findMany({ where }),
    db.eventCategory.findMany({ where: { event: { organizationId } } }),
    db.financialPlanEntry.findMany({ where, orderBy: [{ year: "asc" }, { month: "asc" }] }),
    db.payment.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        allocations: true,
        receipt: { select: { number: true } },
        recordedBy: { select: { name: true } },
      },
    }),
    db.creditBalance.findMany({ where }),
    db.attendanceRecord.findMany({ where }),
    db.parentSubmission.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      include: { attachments: { omit: { image: true } } },
    }),
    db.membership.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        permissionOverrides: { select: { permission: true, granted: true } },
      },
    }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.formDocument.findMany({ where, orderBy: { generatedAt: "asc" } }),
    db.classScheduleItem.findMany({ where, orderBy: [{ categoryId: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }] }),
    db.whatsAppGroupCheck.findMany({ where }),
  ]);

  json("classes.json", classes);
  json("children.json", children);
  json("guardians.json", guardians);
  json("payment-types.json", paymentTypes);
  json(
    "events.json",
    events.map((e) => ({
      ...e,
      classIds: eventClasses.filter((ec) => ec.eventId === e.id).map((ec) => ec.categoryId),
    }))
  );
  json("financial-plan.json", planEntries);
  json(
    "payments.json",
    payments.map(({ receipt, recordedBy, ...p }) => ({
      ...p,
      receiptNumber: receipt?.number ?? null,
      recordedByName: recordedBy?.name ?? null,
    }))
  );
  json("credit-balances.json", creditBalances);
  json("attendance.json", attendance);
  json("parent-submissions.json", submissions);
  json(
    "team.json",
    memberships.map((m) => ({
      id: m.id,
      role: m.role,
      assignedClassId: m.assignedCategoryId,
      joinedAt: m.createdAt,
      user: m.user,
      permissionOverrides: m.permissionOverrides,
    }))
  );
  json("activity-log.json", auditLogs);
  json("timetables.json", scheduleItems);
  json("whatsapp-group-checks.json", whatsappChecks);

  counts.classes = classes.length;
  counts.children = children.length;
  counts.guardians = guardians.length;
  counts.payments = payments.length;
  counts.planEntries = planEntries.length;
  counts.attendance = attendance.length;
  counts.submissions = submissions.length;
  counts.activityLog = auditLogs.length;

  // ---- Per-child files: photos, forms, statements ---------------------------
  const folderByChild = new Map(children.map((c) => [c.id, `children/${childFolderName(c)}`]));

  const childPhotos = await db.child.findMany({
    where: { organizationId, photoImage: { not: null } },
    select: { id: true, photoImage: true },
  });
  for (const p of childPhotos) {
    const folder = folderByChild.get(p.id);
    if (folder) addDataUrl(`${folder}/photo`, p.photoImage);
  }

  const guardianPhotos = await db.guardian.findMany({
    where: { organizationId, photoImage: { not: null } },
    select: { id: true, childId: true, photoImage: true },
  });
  for (const g of guardianPhotos) {
    const folder = folderByChild.get(g.childId);
    const n = guardians.filter((x) => x.childId === g.childId).findIndex((x) => x.id === g.id) + 1;
    if (folder) addDataUrl(`${folder}/guardian-${n}-photo`, g.photoImage);
  }
  counts.photos = childPhotos.length + guardianPhotos.length;

  for (const f of formDocs) {
    const folder = folderByChild.get(f.childId);
    if (!folder) continue;
    addDataUrl(`${folder}/forms/${formTypeLabel(f.formType)}-${isoDate(f.generatedAt)}-${shortId(f.id)}`, f.pdf);
  }
  counts.forms = formDocs.length;

  // One statement per child per year that has (non-cancelled) charges.
  const years = [...new Set(planEntries.filter((e) => e.status !== "CANCELLED").map((e) => e.year))].sort();
  let statements = 0;
  for (const year of years) {
    const rows = await db.child.findMany({
      where: { organizationId, planEntries: { some: { year, status: { not: "CANCELLED" } } } },
      include: statementChildInclude(year),
    });
    for (const c of rows) {
      const folder = folderByChild.get(c.id);
      if (!folder) continue;
      try {
        const pdf = await generateStatementPdf(organization, [toStatementChild(c)], year);
        entries.push({ name: `${folder}/statements/${year}.pdf`, data: Buffer.from(pdf) });
        statements++;
      } catch {
        skippedFiles++;
      }
    }
  }
  counts.statements = statements;

  // ---- Parent submission attachments ---------------------------------------
  const attachments = await db.parentSubmissionAttachment.findMany({
    where: { submission: { organizationId } },
    select: { id: true, submissionId: true, label: true, image: true },
  });
  for (const a of attachments) {
    const label = sanitizeFilePart(a.label) || "attachment";
    addDataUrl(`submissions/${a.submissionId}/${label}-${shortId(a.id)}`, a.image);
  }
  counts.submissionAttachments = attachments.length;
  counts.skippedFiles = skippedFiles;

  entries.unshift({ name: "README.txt", data: readme(organization.name, new Date(), counts) });

  const password = generateBackupPassword();
  const zipBuffer = await zipInMemory(entries, password);
  return { zipBuffer, password, counts, schoolName: organization.name };
}

async function zipInMemory(entries: ZipEntry[], password: string): Promise<Buffer> {
  // archiver's option types don't know about the zip-encrypted plugin's
  // extra options, hence the cast.
  const archive = archiver.create("zip-encrypted", {
    zlib: { level: 8 },
    encryptionMethod: "aes256",
    password,
  } as archiver.ArchiverOptions);

  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    sink.on("end", () => resolve());
    sink.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(sink);
  for (const e of entries) archive.append(e.data, { name: e.name });
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

function readme(schoolName: string, at: Date, counts: Record<string, number>): string {
  return [
    `Crechely full data backup`,
    `School: ${schoolName}`,
    `Exported: ${at.toISOString()}`,
    ``,
    `HOW TO OPEN`,
    `This file is AES-256 encrypted. Open it with 7-Zip (free, Windows) or`,
    `Keka / The Unarchiver (Mac). The built-in Windows and Mac unzip tools`,
    `can't open AES-encrypted files. Use the password shown when you`,
    `downloaded it - Crechely does not store it.`,
    ``,
    `WHAT'S INSIDE`,
    `data/organization.json      School profile and banking details`,
    `data/classes.json           Classes`,
    `data/children.json          Children (incl. items in the trash - see deletedAt)`,
    `data/guardians.json         Parents / guardians`,
    `data/payment-types.json     Fee and payment types`,
    `data/events.json            Events, with the class ids they apply to`,
    `data/financial-plan.json    Every charge per child per month`,
    `data/payments.json          Payments, allocations and receipt numbers`,
    `data/credit-balances.json   Credit held per child`,
    `data/attendance.json        Attendance register`,
    `data/parent-submissions.json  Online parent forms (review queue)`,
    `data/team.json              Team members, roles and permission overrides`,
    `data/activity-log.json      Full activity log`,
    `data/timetables.json        Weekly class timetables`,
    `data/whatsapp-group-checks.json  Parents ticked as added to class WhatsApp groups`,
    `children/<name>/            Photos, signed forms and yearly statements`,
    `submissions/<id>/           Documents parents uploaded with online forms`,
    `school/                     Logo and letterhead`,
    ``,
    `COUNTS`,
    ...Object.entries(counts).map(([k, v]) => `${k}: ${v}`),
    ``,
    `This file contains children's personal information. Store it securely`,
    `and delete old copies you no longer need (POPIA).`,
    ``,
  ].join("\r\n");
}
