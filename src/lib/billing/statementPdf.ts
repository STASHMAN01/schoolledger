import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatMoneyCents } from "@/lib/money";

// pdf-lib is pure JavaScript — no native binary, no headless-browser
// dependency (unlike puppeteer-based PDF generation). That matters for a
// serverless deployment (Vercel functions): nothing to download, nothing
// platform-specific to break in production.

type StatementChild = {
  firstName: string;
  lastName: string;
  parentName: string;
  category: { name: string };
  creditBalanceCents: number;
  entries: {
    year: number;
    month: number | null;
    description: string;
    // The PaymentType this charge belongs to (e.g. "School Fees",
    // "Registration") — combined with the month at render time into a
    // specific label like "Jan Fees" instead of the generic stored
    // description, per the org owner's own instruction.
    paymentTypeName: string;
    amountDueCents: number;
    amountPaidCents: number;
    status: string;
    // Every date money was actually applied against this charge — can be
    // more than one for a charge paid off in installments. Empty when
    // nothing's been paid yet.
    paidDates: Date[];
  }[];
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Turns a charge's period + payment type into a specific, readable label —
// "Jan Fees" rather than the generic "School Fees — 2026-01" stored on the
// row itself. One-time charges (month === null, e.g. Registration or an
// event) keep their own description as-is since there's no month to fold in.
function chargeLabel(entry: Pick<StatementChild["entries"][number], "month" | "description" | "paymentTypeName">) {
  if (entry.month == null) return entry.description;
  const monthName = MONTH_ABBR[entry.month - 1] ?? `M${entry.month}`;
  // "School Fees" -> "Fees" reads less redundant once it's prefixed with
  // the month ("Jan Fees" beats "Jan School Fees"); any other payment
  // type name is used in full ("Jan Aftercare", "Jan Trip Deposit").
  const typeName = entry.paymentTypeName.replace(/^school\s+/i, "");
  return `${monthName} ${typeName}`;
}

function formatPaidDates(dates: Date[]): string {
  if (dates.length === 0) return "—";
  return dates
    .map((d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }))
    .join(", ");
}

type StatementOrg = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  currencyCode: string;
  // A data: URL (base64), same format the school profile upload stores —
  // see Organization.letterheadImage. Optional/absent on any org that
  // hasn't uploaded one yet.
  letterheadImage?: string | null;
};

// Parses a "data:image/png;base64,AAAA..." string into raw bytes plus which
// pdf-lib embed method applies. Returns null for anything malformed rather
// than throwing — a bad/legacy value should degrade to "no letterhead", not
// break statement generation for the whole school.
function parseImageDataUrl(
  dataUrl: string
): { bytes: Buffer; kind: "png" | "jpg" } | null {
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, subtype, base64] = match;
  // pdf-lib only embeds PNG/JPEG directly; webp/gif letterheads are skipped
  // rather than mis-decoded.
  if (subtype !== "png" && subtype !== "jpg" && subtype !== "jpeg") return null;
  try {
    return { bytes: Buffer.from(base64, "base64"), kind: subtype === "png" ? "png" : "jpg" };
  } catch {
    return null;
  }
}

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const money = formatMoneyCents;

function statusLabel(status: string) {
  return status.replace("_", " ");
}

/**
 * Builds a professional-enough MVP statement: school header (name, address,
 * banking details — logo/custom letterhead image comes once file uploads
 * are wired up, see PHASES.md), one section per child sorted oldest entry
 * first, and — when more than one child is passed — a combined grand total
 * at the end, for the joint-statement case (shared surname / shared payer).
 */
export async function generateStatementPdf(
  org: StatementOrg,
  children: StatementChild[],
  year: number
): Promise<Uint8Array> {
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

  // --- Header / letterhead ---
  // When a letterhead is uploaded, it already carries the school's name
  // (and usually a logo/tagline) — printing the name again in plain text
  // right underneath it just looked redundant and generic, per the org
  // owner's own note. So the plain-text name only appears as a fallback
  // for schools that haven't uploaded a letterhead yet.
  let letterheadDrawn = false;
  if (org.letterheadImage) {
    const parsed = parseImageDataUrl(org.letterheadImage);
    if (parsed) {
      try {
        const image =
          parsed.kind === "png"
            ? await pdf.embedPng(parsed.bytes)
            : await pdf.embedJpg(parsed.bytes);
        const maxWidth = PAGE_WIDTH - MARGIN * 2;
        const maxHeight = 90;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 16;
        letterheadDrawn = true;
      } catch {
        // Corrupt/unsupported bytes despite passing the regex check above —
        // skip the image rather than fail the whole statement.
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
  if (org.bankName || org.bankAccountNumber) {
    text(
      `Banking details: ${org.bankName ?? ""} ${org.bankAccountNumber ?? ""}`.trim(),
      { size: 9, color: rgb(0.4, 0.4, 0.4) }
    );
    y -= 14;
  }
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 1.2,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 12;
  text(`Statement of account — ${year}`, { size: 14, f: bold });
  y -= 26;

  const COL = { charge: MARGIN, due: MARGIN + 175, paid: MARGIN + 245, paidOn: MARGIN + 315, status: MARGIN + 440 };

  function drawTableHeader() {
    text("Charge", { size: 9, f: bold, x: COL.charge });
    text("Due", { size: 9, f: bold, x: COL.due });
    text("Paid", { size: 9, f: bold, x: COL.paid });
    text("Paid on", { size: 9, f: bold, x: COL.paidOn });
    text("Status", { size: 9, f: bold, x: COL.status });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 14;
  }

  function truncate(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  let grandTotalDue = 0;
  let grandTotalPaid = 0;

  for (const child of children) {
    newPageIfNeeded(120);

    text(`${child.firstName} ${child.lastName}`, { size: 12, f: bold });
    y -= 14;
    text(`${child.category.name} · Parent/guardian: ${child.parentName}`, {
      size: 9,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 18;

    drawTableHeader();

    // Oldest to latest, per spec — entries are expected pre-sorted by the
    // caller (year, month asc); one-time charges (month === null) are
    // treated as belonging to the very start of the year they were raised.
    let childTotalDue = 0;
    let childTotalPaid = 0;

    for (const entry of child.entries) {
      const isNewPage = y < MARGIN + 30;
      newPageIfNeeded(30);
      if (isNewPage) drawTableHeader(); // repeat the header after a page break

      text(truncate(chargeLabel(entry), 32), { size: 9, x: COL.charge });
      text(money(entry.amountDueCents, org.currencyCode), { size: 9, x: COL.due });
      text(money(entry.amountPaidCents, org.currencyCode), { size: 9, x: COL.paid });
      text(truncate(formatPaidDates(entry.paidDates), 26), { size: 8, x: COL.paidOn });
      text(statusLabel(entry.status), { size: 8.5, x: COL.status });
      y -= 16;

      childTotalDue += entry.amountDueCents;
      childTotalPaid += entry.amountPaidCents;
    }

    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;

    text(`Total charged: ${money(childTotalDue, org.currencyCode)}`, { size: 10 });
    text(`Total paid: ${money(childTotalPaid, org.currencyCode)}`, {
      size: 10,
      x: MARGIN + 200,
    });
    y -= 14;
    text(
      `Outstanding: ${money(childTotalDue - childTotalPaid, org.currencyCode)}`,
      { size: 10, f: bold }
    );
    if (child.creditBalanceCents > 0) {
      text(`Credit balance: ${money(child.creditBalanceCents, org.currencyCode)}`, {
        size: 10,
        x: MARGIN + 200,
        color: rgb(0, 0.4, 0),
      });
    }
    y -= 28;

    grandTotalDue += childTotalDue;
    grandTotalPaid += childTotalPaid;
  }

  if (children.length > 1) {
    newPageIfNeeded(60);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 20;
    text("Combined (joint statement)", { size: 12, f: bold });
    y -= 16;
    text(
      `Total outstanding across ${children.length} children: ${money(
        grandTotalDue - grandTotalPaid,
        org.currencyCode
      )}`,
      { size: 11, f: bold }
    );
  }

  // A small "generated on" footer on every page reads as more of a real
  // financial document and less like a printed screenshot — cheap
  // polish, but it's exactly the kind of detail that made the old layout
  // feel generic.
  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
