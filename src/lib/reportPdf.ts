import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { INCIDENT_TYPE_LABELS, INCIDENT_TYPES, REPORT_TYPE_INFO, ageAt, type ReportTypeValue } from "@/lib/reports";

// Printable PDF for one Centre Management report (incident/academic/
// disciplinary) -- same pdf-lib approach as statementPdf.ts and
// forms/formPdf.ts (no headless browser, works in a Vercel function).
// Deliberately a near-duplicate of formPdf.ts's letterhead/wrapText
// helpers rather than a shared import, for the same reason formPdf.ts
// gives for not sharing with statementPdf.ts: small, self-contained, and
// this is a non-money feature that shouldn't depend on billing/ code.

function parseImageDataUrl(dataUrl: string): { bytes: Buffer; kind: "png" | "jpg" } | null {
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, subtype, base64] = match;
  if (subtype !== "png" && subtype !== "jpg" && subtype !== "jpeg") return null;
  try {
    return { bytes: Buffer.from(base64, "base64"), kind: subtype === "png" ? "png" : "jpg" };
  } catch {
    return null;
  }
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
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

type ReportOrg = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  letterheadImage?: string | null;
};

type ReportData = {
  type: ReportTypeValue;
  occurredAt: Date;
  summary: string;
  injury: boolean | null;
  firstAidGiven: boolean | null;
  witnesses: string | null;
  actionTaken: string | null;
  incidentTime?: string | null;
  location?: string | null;
  incidentTypes?: string[];
  incidentTypeOther?: string | null;
  caregiver?: string | null;
  emergencyCareRequired?: boolean | null;
  staffConsulted?: boolean | null;
  witnessesPresent?: boolean | null;
  term: string | null;
  developmentArea: string | null;
  rating: string | null;
  behaviour: string | null;
  followUp: string | null;
  parentNotified: boolean;
  parentNotifiedAt: Date | null;
  child: { firstName: string; lastName: string; dateOfBirth?: Date | null };
  category: { name: string };
  createdBy: { name: string };
  createdAt: Date;
};

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function yesNo(v: boolean | null | undefined) {
  return v == null ? "Not recorded" : v ? "Yes" : "No";
}

export async function generateReportPdf(org: ReportOrg, report: ReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPageIfNeeded(minRemaining: number) {
    if (y < MARGIN + minRemaining) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function text(value: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) {
    page.drawText(value, {
      x: opts.x ?? MARGIN,
      y,
      size: opts.size ?? 10,
      font: opts.f ?? font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
  }

  function paragraph(value: string, opts: { size?: number; f?: PDFFont; lineGap?: number } = {}) {
    const size = opts.size ?? 10;
    const lineGap = opts.lineGap ?? size + 4;
    for (const line of wrapText(value, opts.f ?? font, size, CONTENT_WIDTH)) {
      newPageIfNeeded(lineGap + 10);
      text(line, { size, f: opts.f });
      y -= lineGap;
    }
  }

  function field(label: string, value: string) {
    newPageIfNeeded(20);
    text(`${label}:`, { size: 9.5, f: bold });
    const labelWidth = bold.widthOfTextAtSize(`${label}:`, 9.5);
    text(value, { size: 9.5, x: MARGIN + labelWidth + 8 });
    y -= 16;
  }

  function section(heading: string) {
    newPageIfNeeded(40);
    y -= 6;
    text(heading, { size: 11, f: bold });
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 140, y }, thickness: 0.75, color: rgb(0.7, 0.7, 0.7) });
    y -= 16;
  }

  // --- Header / letterhead (same pattern as formPdf.ts) ---
  let letterheadDrawn = false;
  if (org.letterheadImage) {
    const parsed = parseImageDataUrl(org.letterheadImage);
    if (parsed) {
      try {
        const image = parsed.kind === "png" ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes);
        const maxWidth = CONTENT_WIDTH;
        const maxHeight = 90;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 16;
        letterheadDrawn = true;
      } catch {
        // Corrupt/unsupported bytes despite passing the regex check.
      }
    }
  }
  if (!letterheadDrawn) {
    text(org.name, { size: 18, f: bold });
    y -= 20;
    const addressParts = [org.addressLine1, org.addressLine2, org.province].filter(Boolean);
    if (addressParts.length) {
      text(addressParts.join(", "), { size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    }
  }
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 1.2, color: rgb(0.15, 0.15, 0.15) });
  y -= 16;

  text(REPORT_TYPE_INFO[report.type].label, { size: 16, f: bold });
  y -= 24;

  field("Child", `${report.child.firstName} ${report.child.lastName}`);
  if (report.type === "INCIDENT") {
    field("Date of report", fmtDate(report.createdAt));
    field("Age", ageAt(report.child.dateOfBirth, report.occurredAt) ?? "Not recorded");
  }
  field("Class", report.category.name);
  field(report.type === "INCIDENT" ? "Incident date" : "Date", fmtDate(report.occurredAt));
  if (report.type === "INCIDENT") {
    if (report.incidentTime) field("Time", report.incidentTime);
    if (report.location) field("Location", report.location);
    if (report.caregiver) field("Caregiver", report.caregiver);
  }
  field("Written by", report.createdBy.name);
  if (report.type === "ACADEMIC" && report.term) field("Term", report.term);
  if (report.type === "ACADEMIC" && report.developmentArea) field("Development area", report.developmentArea);
  if (report.type === "ACADEMIC" && report.rating) field("Rating", report.rating);
  y -= 4;

  if (report.type === "INCIDENT") {
    const picked = new Set(report.incidentTypes ?? []);
    section("Type of incident");
    if (picked.size === 0) {
      // Reports written before the template fields existed.
      field("Injury", report.injury ? "Yes" : "No");
    } else {
      for (const t of INCIDENT_TYPES) {
        if (!picked.has(t)) continue;
        const label = INCIDENT_TYPE_LABELS[t];
        field(label, t === "OTHER" && report.incidentTypeOther ? report.incidentTypeOther : "Yes");
      }
    }
  }

  section(report.type === "DISCIPLINARY" ? "What happened" : report.type === "INCIDENT" ? "Description of the incident" : "Summary");
  paragraph(report.summary || "—");

  if (report.type === "INCIDENT") {
    section("Care and response");
    field("First aid provided", yesNo(report.firstAidGiven));
    field("Emergency care required", yesNo(report.emergencyCareRequired));
    field("Staff member or nurse consulted", yesNo(report.staffConsulted));
    if (report.actionTaken) {
      y -= 2;
      text("Care or intervention provided:", { size: 9.5, f: bold });
      y -= 14;
      paragraph(report.actionTaken, { size: 9.5 });
    }
    section("Witnesses");
    field("Any witnesses", yesNo(report.witnessesPresent ?? (report.witnesses ? true : null)));
    if (report.witnesses) {
      paragraph(report.witnesses, { size: 9.5 });
    }
  }

  if (report.type === "DISCIPLINARY") {
    if (report.behaviour) {
      section("Behaviour observed");
      paragraph(report.behaviour);
    }
    if (report.followUp) {
      section("Follow-up");
      paragraph(report.followUp);
    }
  }

  section("Parent");
  field("Parent notified", report.parentNotified ? `Yes${report.parentNotifiedAt ? `, ${fmtDate(report.parentNotifiedAt)}` : ""}` : "No");

  y -= 20;
  newPageIfNeeded(60);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });
  y -= 12;
  text("Staff signature", { size: 8.5, color: rgb(0.45, 0.45, 0.45) });

  const generatedOn = fmtDateTime(new Date());
  for (const p of pdf.getPages()) {
    p.drawText(`Generated ${generatedOn} · ${org.name}`, {
      x: MARGIN,
      y: 24,
      size: 7.5,
      font,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  return pdf.save();
}

export function buildReportFilename(type: ReportTypeValue, firstName: string, lastName: string, occurredAt: Date) {
  const slug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const date = occurredAt.toISOString().slice(0, 10);
  const kind = type.toLowerCase();
  return `${kind}-report-${slug}-${date}.pdf`;
}
