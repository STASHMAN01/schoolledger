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
    amountDueCents: number;
    amountPaidCents: number;
    status: string;
  }[];
};

type StatementOrg = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  currencyCode: string;
};

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

  // --- Header / letterhead-lite ---
  text(org.name, { size: 18, f: bold });
  y -= 18;
  const addressParts = [org.addressLine1, org.addressLine2, org.province].filter(Boolean);
  if (addressParts.length) {
    text(addressParts.join(", "), { size: 9, color: rgb(0.35, 0.35, 0.35) });
    y -= 14;
  }
  if (org.bankName || org.bankAccountNumber) {
    text(
      `Banking details: ${org.bankName ?? ""} ${org.bankAccountNumber ?? ""}`.trim(),
      { size: 9, color: rgb(0.35, 0.35, 0.35) }
    );
    y -= 14;
  }
  y -= 6;
  text(`Statement — ${year}`, { size: 13, f: bold });
  y -= 24;

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

    // Table header
    text("Period", { size: 9, f: bold, x: MARGIN });
    text("Description", { size: 9, f: bold, x: MARGIN + 70 });
    text("Due", { size: 9, f: bold, x: MARGIN + 320 });
    text("Paid", { size: 9, f: bold, x: MARGIN + 390 });
    text("Status", { size: 9, f: bold, x: MARGIN + 460 });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 14;

    // Oldest to latest, per spec — entries are expected pre-sorted by the
    // caller (year, month asc); one-time charges (month === null) are
    // treated as belonging to the very start of the year they were raised.
    let childTotalDue = 0;
    let childTotalPaid = 0;

    for (const entry of child.entries) {
      newPageIfNeeded(30);
      const period = entry.month
        ? `${entry.year}-${String(entry.month).padStart(2, "0")}`
        : `${entry.year}`;
      text(period, { size: 9, x: MARGIN });
      text(entry.description.slice(0, 40), { size: 9, x: MARGIN + 70 });
      text(money(entry.amountDueCents, org.currencyCode), { size: 9, x: MARGIN + 320 });
      text(money(entry.amountPaidCents, org.currencyCode), { size: 9, x: MARGIN + 390 });
      text(statusLabel(entry.status), { size: 9, x: MARGIN + 460 });
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

  return pdf.save();
}
