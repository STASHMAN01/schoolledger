import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { FormSpec } from "./types";

// pdf-lib, no headless browser -- same reasoning as statementPdf.ts (this
// runs in a serverless Vercel function). The letterhead-embedding helper
// below is deliberately a near-duplicate of statementPdf.ts's private
// parseImageDataUrl rather than a shared import: small, self-contained,
// and keeps this template renderer from depending on billing/ code for a
// centre-management (non-money) feature.
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

type FormOrg = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  letterheadImage?: string | null;
};

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Greedy word-wrap against a font's actual measured width -- pdf-lib draws
// single lines only, so anything longer than one line (the intro
// paragraph, the disclaimer) needs this before it can be drawn.
function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders one of the 7 pre-built form templates as a PDF: school
 * letterhead, title, intro paragraph, each section's fields (a printed
 * value where the system already has one, an underscored blank line for
 * staff/parent to fill in by hand otherwise), an optional disclaimer box,
 * and a signature/date line. Deliberately plain/static -- no AcroForm
 * fields -- matching decision #8 (form builder, not Adobe-style PDF
 * editing) and this session's "PDF only for now" scope (Session 4 is
 * where a parent fills in real structured answers online).
 */
export async function generateFormPdf(org: FormOrg, spec: FormSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPageIfNeeded(minRemaining: number) {
    if (y < MARGIN + minRemaining) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function text(
    value: string,
    opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}
  ) {
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

  // --- Header / letterhead (same pattern as statementPdf.ts) ---
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
        // Corrupt/unsupported bytes despite passing the regex check -- skip
        // rather than fail the whole document.
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
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 1.2,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 16;

  text(spec.title, { size: 16, f: bold });
  y -= 24;

  paragraph(spec.intro, { size: 10 });
  y -= 8;

  for (const section of spec.sections) {
    newPageIfNeeded(50);
    text(section.heading, { size: 11, f: bold });
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + 140, y },
      thickness: 0.75,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;

    for (const field of section.fields) {
      newPageIfNeeded(20);
      text(`${field.label}:`, { size: 9.5, f: bold, x: MARGIN });
      const labelWidth = bold.widthOfTextAtSize(`${field.label}:`, 9.5);
      const valueX = MARGIN + labelWidth + 8;
      if (field.value) {
        text(field.value, { size: 9.5, x: valueX });
      } else {
        // Blank line for whatever isn't captured elsewhere in the system
        // yet -- filled in by hand.
        page.drawLine({
          start: { x: valueX, y: y - 2 },
          end: { x: PAGE_WIDTH - MARGIN, y: y - 2 },
          thickness: 0.5,
          color: rgb(0.75, 0.75, 0.75),
        });
      }
      y -= 20;
    }
    y -= 8;
  }

  if (spec.disclaimer) {
    newPageIfNeeded(50);
    const boxTop = y;
    y -= 10;
    paragraph(spec.disclaimer, { size: 8.5, f: italic, lineGap: 12 });
    page.drawRectangle({
      x: MARGIN - 8,
      y: y - 4,
      width: CONTENT_WIDTH + 16,
      height: boxTop - y + 4,
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 0.75,
    });
    y -= 20;
  }

  if (spec.signatureLine) {
    newPageIfNeeded(70);
    y -= 20;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.75, color: rgb(0.2, 0.2, 0.2) });
    page.drawLine({ start: { x: MARGIN + 280, y }, end: { x: MARGIN + 420, y }, thickness: 0.75, color: rgb(0.2, 0.2, 0.2) });
    y -= 12;
    text("Parent / guardian signature", { size: 8, color: rgb(0.4, 0.4, 0.4) });
    text("Date", { size: 8, x: MARGIN + 280, color: rgb(0.4, 0.4, 0.4) });
  }

  const generatedOn = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  for (const p of pdf.getPages()) {
    p.drawText(`Generated ${generatedOn} · ${org.name}`, {
      x: MARGIN,
      y: MARGIN - 20,
      size: 7.5,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  return pdf.save();
}

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Same sanitizing reasoning as statementPdf.ts's buildStatementFilename --
// this ends up as an email attachment / downloaded file name, so plain
// ASCII only.
export function buildFormFilename(
  childFirstName: string,
  childLastName: string,
  formLabel: string,
  at: Date = new Date()
): string {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const monthName = MONTH_FULL[at.getMonth()];
  const parts = [clean(childFirstName), clean(childLastName), clean(formLabel), monthName, String(at.getFullYear())].filter(Boolean);
  return `${parts.join("-")}.pdf`;
}
