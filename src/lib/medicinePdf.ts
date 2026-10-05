import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  DOSE_OUTCOME_LABELS,
  ROUTE_LABELS,
  STORAGE_LABELS,
  consentStatements,
  type DOSE_OUTCOMES,
  type ROUTES,
  type STORAGE,
} from "@/lib/medicine";

// Printable medicine consent and administration record (Dylan, 5 Oct 2026):
// the child, the medicine, the checks done on arrival, the parent's wording
// and signature, and every dose given. Same pdf-lib approach as reportPdf.ts.

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Helvetica only has Latin-1: swap anything else for a safe character. */
function safe(v: string): string {
  return v
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of safe(value).split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

export type MedicinePdfData = {
  org: { name: string; addressLine1: string | null; addressLine2: string | null; province: string | null };
  timezone: string;
  child: { firstName: string; lastName: string; allergies: string | null };
  className: string;
  medicineName: string;
  reason: string;
  isPrescribed: boolean;
  prescriberName: string | null;
  dose: string;
  route: string;
  frequency: string;
  scheduledTimes: string[];
  startDate: string;
  endDate: string;
  lastDoseAtHome: string | null;
  storage: string;
  expiryDate: string | null;
  originalContainer: boolean;
  labelMatches: boolean;
  notExpired: boolean;
  specialInstructions: string | null;
  parentName: string | null;
  parentRelationship: string | null;
  parentPhone: string | null;
  signatureImage: string | null;
  signedAt: Date | null;
  receivedBy: string;
  returnedAt: Date | null;
  returnedNote: string | null;
  doses: {
    givenAt: Date;
    outcome: string;
    doseGiven: string | null;
    note: string | null;
    witnessName: string | null;
    givenBy: string;
  }[];
};

export async function generateMedicinePdf(d: MedicinePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dim = rgb(0.4, 0.4, 0.4);
  const ink = rgb(0.1, 0.1, 0.1);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const fmtStamp = (when: Date) =>
    when.toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: d.timezone,
    });
  const fmtTime = (when: Date) =>
    when.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: d.timezone });

  function room(min: number) {
    if (y < MARGIN + min) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }
  function put(value: string, o: { size?: number; f?: PDFFont; x?: number; color?: ReturnType<typeof rgb> } = {}) {
    page.drawText(safe(value), { x: o.x ?? MARGIN, y, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? ink });
  }
  function paragraph(value: string, o: { size?: number; f?: PDFFont; indent?: number } = {}) {
    const size = o.size ?? 9.5;
    const indent = o.indent ?? 0;
    for (const line of wrap(value, o.f ?? font, size, CONTENT_WIDTH - indent)) {
      room(size + 14);
      put(line, { size, f: o.f, x: MARGIN + indent });
      y -= size + 4;
    }
  }
  function field(label: string, value: string) {
    const size = 9.5;
    const labelW = 120;
    const lines = wrap(value || "-", font, size, CONTENT_WIDTH - labelW);
    room(lines.length * 14 + 6);
    put(`${label}:`, { size, f: bold });
    lines.forEach((line, i) => {
      put(line, { size, x: MARGIN + labelW });
      if (i < lines.length - 1) y -= 13;
    });
    y -= 15;
  }
  function section(heading: string) {
    room(50);
    y -= 6;
    put(heading, { size: 11, f: bold });
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 140, y }, thickness: 0.75, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;
  }
  const tick = (v: boolean) => (v ? "Yes" : "No");

  // Letterhead
  put(d.org.name, { size: 18, f: bold });
  y -= 20;
  const address = [d.org.addressLine1, d.org.addressLine2, d.org.province].filter(Boolean).join(", ");
  if (address) {
    put(address, { size: 9, color: dim });
    y -= 14;
  }
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 1.2, color: ink });
  y -= 16;
  put("Medicine Consent and Administration Record", { size: 16, f: bold });
  y -= 26;

  section("Child");
  field("Child", `${d.child.firstName} ${d.child.lastName}`);
  field("Class", d.className);
  field("Allergies on file", d.child.allergies?.trim() || "None recorded");

  section("Medicine");
  field("Medicine", d.medicineName);
  field("What it is for", d.reason);
  field("Type", d.isPrescribed ? `Prescribed${d.prescriberName ? ` by ${d.prescriberName}` : ""}` : "Over the counter");
  field("Dose", d.dose);
  field("How it is given", ROUTE_LABELS[d.route as (typeof ROUTES)[number]] ?? d.route);
  field("How often", d.frequency);
  field("Times to give", d.scheduledTimes.length ? d.scheduledTimes.join(", ") : "As written above");
  field("Course", `${fmtDay(d.startDate)} to ${fmtDay(d.endDate)}`);
  field("Last dose at home", d.lastDoseAtHome || "Not recorded");
  field("Special instructions", d.specialInstructions || "None");

  section("Checked when the medicine arrived");
  field("Stored", STORAGE_LABELS[d.storage as (typeof STORAGE)[number]] ?? d.storage);
  field("Expiry date", d.expiryDate ? fmtDay(d.expiryDate) : "Not on the packaging");
  field("Original container", tick(d.originalContainer));
  field("Label matches this form", tick(d.labelMatches));
  field("Not past expiry date", tick(d.notExpired));
  field("Received by", d.receivedBy);

  section("Parent permission");
  consentStatements(d.org.name).forEach((s, i) => paragraph(`${i + 1}. ${s}`, { size: 9 }));
  y -= 8;
  if (d.signedAt && d.parentName) {
    field("Parent / guardian", `${d.parentName} (${d.parentRelationship ?? ""})`);
    field("Phone today", d.parentPhone ?? "-");
    field("Signed", fmtStamp(d.signedAt));
    if (d.signatureImage) {
      const m = /^data:image\/png;base64,(.+)$/.exec(d.signatureImage);
      if (m) {
        try {
          const img = await pdf.embedPng(Buffer.from(m[1], "base64"));
          const scale = Math.min(220 / img.width, 70 / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          room(h + 24);
          put("Signature:", { size: 9.5, f: bold });
          page.drawImage(img, { x: MARGIN + 120, y: y - h + 8, width: w, height: h });
          y -= h + 12;
          page.drawLine({ start: { x: MARGIN + 120, y: y + 4 }, end: { x: MARGIN + 120 + 230, y: y + 4 }, thickness: 0.5, color: dim });
          y -= 8;
        } catch {
          // A corrupt image should not stop the form printing.
        }
      }
    }
  } else {
    room(60);
    put("NOT YET SIGNED. Do not give this medicine until the parent has signed.", { size: 10, f: bold, color: rgb(0.75, 0.1, 0.1) });
    y -= 22;
    field("Parent / guardian", "");
    field("Signature", "");
  }

  section("Doses given");
  if (d.doses.length === 0) {
    paragraph("No doses recorded yet.", { size: 9.5 });
  } else {
    for (const dose of d.doses) {
      const label = DOSE_OUTCOME_LABELS[dose.outcome as (typeof DOSE_OUTCOMES)[number]] ?? dose.outcome;
      const parts = [
        `${fmtStamp(dose.givenAt)} (${fmtTime(dose.givenAt)})`,
        label + (dose.doseGiven ? `: ${dose.doseGiven}` : ""),
        `by ${dose.givenBy}`,
        dose.witnessName ? `checked by ${dose.witnessName}` : "",
        dose.note ? `Note: ${dose.note}` : "",
      ].filter(Boolean);
      paragraph(parts.join(" | "), { size: 9 });
      y -= 2;
    }
  }

  if (d.returnedAt) {
    section("Finished");
    field("Handed back / finished", fmtStamp(d.returnedAt));
    if (d.returnedNote) field("Note", d.returnedNote);
  }

  return pdf.save();
}

export function buildMedicineFilename(firstName: string, lastName: string, startDate: string) {
  const slug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `medicine-record-${slug}-${startDate}.pdf`;
}
