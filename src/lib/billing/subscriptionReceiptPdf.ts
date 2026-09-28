import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoneyCents } from "@/lib/money";
import { formatDateZA } from "@/lib/date";
import { SELLER, VAT_RATE } from "@/lib/billing/seller";

// Receipt for one Crechely subscription payment (Settings -> Billing),
// so a school can file it as a business expense (Dylan, 28 Sept 2026).
// pdf-lib, same as statements: pure JS, nothing native for Vercel to break.

export type ReceiptPayment = {
  receiptNumber: number;
  paystackReference: string;
  amountCents: number;
  currencyCode: string;
  paidAt: Date;
  periodStart: Date;
  periodEnd: Date;
  planName: string | null;
  planInterval: string | null;
  channel: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
};

export type ReceiptCustomer = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  contactEmail: string | null;
};

export function formatReceiptNumber(n: number): string {
  return `CRE-${String(n).padStart(6, "0")}`;
}

export function receiptFilename(payment: Pick<ReceiptPayment, "receiptNumber" | "paidAt">): string {
  const date = payment.paidAt.toISOString().slice(0, 10);
  return `Crechely-receipt-${formatReceiptNumber(payment.receiptNumber)}-${date}.pdf`;
}

// The standard PDF fonts only cover Windows-1252. Anything outside it
// (emoji, other scripts in a school name) would make pdf-lib throw, so it's
// swapped for "?" rather than failing the whole receipt.
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ–—‘’“”•€]/g, "?");
}

function planLabel(p: ReceiptPayment): string {
  if (p.planInterval === "annually") return "Yearly plan";
  if (p.planInterval === "monthly") return "Monthly plan";
  return p.planName ? safe(p.planName) : "Subscription";
}

function paidWith(p: ReceiptPayment): string {
  if (p.cardLast4) {
    const brand = p.cardBrand ? p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1) : "Card";
    return `${safe(brand)} card ending in ${safe(p.cardLast4)}`;
  }
  if (p.channel) return safe(p.channel.replace(/_/g, " "));
  return "Online payment";
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const BRAND = rgb(0.02, 0.44, 0.73);
const LINE = rgb(0.86, 0.88, 0.9);
const GREEN = rgb(0.09, 0.55, 0.3);

export async function generateSubscriptionReceiptPdf(
  payment: ReceiptPayment,
  customer: ReceiptCustomer
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const money = (cents: number) => formatMoneyCents(cents, payment.currencyCode);
  const isTaxInvoice = Boolean(SELLER.vatNumber);

  pdf.setTitle(`${isTaxInvoice ? "Tax invoice" : "Receipt"} ${formatReceiptNumber(payment.receiptNumber)}`);
  pdf.setAuthor(SELLER.legalName ?? SELLER.tradingName);

  const text = (p: PDFPage, s: string, x: number, y: number, size: number, f: PDFFont = font, color = INK) =>
    p.drawText(safe(s), { x, y, size, font: f, color });
  const rightText = (s: string, rightX: number, y: number, size: number, f: PDFFont = font, color = INK) =>
    text(page, s, rightX - f.widthOfTextAtSize(safe(s), size), y, size, f, color);

  const right = PAGE_WIDTH - MARGIN;
  let y = PAGE_HEIGHT - MARGIN;

  // Seller (left) and document title (right)
  text(page, SELLER.tradingName, MARGIN, y - 4, 22, bold, BRAND);
  rightText(isTaxInvoice ? "TAX INVOICE" : "RECEIPT", right, y - 4, 18, bold);
  y -= 26;
  const sellerLines = [
    ...(SELLER.legalName && SELLER.legalName !== SELLER.tradingName ? [SELLER.legalName] : []),
    ...SELLER.addressLines,
    ...(SELLER.registrationNumber ? [`Reg. no. ${SELLER.registrationNumber}`] : []),
    ...(SELLER.vatNumber ? [`VAT no. ${SELLER.vatNumber}`] : []),
    SELLER.email,
    SELLER.website,
  ];
  const metaLines: [string, string][] = [
    ["Receipt no.", formatReceiptNumber(payment.receiptNumber)],
    ["Date paid", formatDateZA(payment.paidAt)],
  ];
  let sy = y;
  for (const line of sellerLines) {
    text(page, line, MARGIN, sy, 9.5, font, MUTED);
    sy -= 13;
  }
  let my = y;
  for (const [label, value] of metaLines) {
    rightText(value, right, my, 10, bold);
    rightText(label, right - 110, my, 10, font, MUTED);
    my -= 15;
  }
  // PAID stamp
  const stamp = "PAID";
  const stampW = bold.widthOfTextAtSize(stamp, 12) + 20;
  page.drawRectangle({
    x: right - stampW,
    y: my - 10,
    width: stampW,
    height: 20,
    borderColor: GREEN,
    borderWidth: 1.2,
  });
  text(page, stamp, right - stampW + 10, my - 4, 12, bold, GREEN);

  y = Math.min(sy, my - 20) - 20;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 26;

  // Billed to
  text(page, "BILLED TO", MARGIN, y, 8.5, bold, MUTED);
  y -= 15;
  text(page, customer.name, MARGIN, y, 11, bold);
  y -= 14;
  for (const line of [customer.addressLine1, customer.addressLine2, customer.province, customer.contactEmail]) {
    if (!line) continue;
    text(page, line, MARGIN, y, 10, font, MUTED);
    y -= 13;
  }
  y -= 22;

  // Line item table
  const colPeriod = MARGIN + 250;
  text(page, "DESCRIPTION", MARGIN, y, 8.5, bold, MUTED);
  text(page, "PERIOD", colPeriod, y, 8.5, bold, MUTED);
  rightText("AMOUNT", right, y, 8.5, bold, MUTED);
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 18;
  text(page, `Crechely subscription - ${planLabel(payment)}`, MARGIN, y, 10.5);
  text(page, `${formatDateZA(payment.periodStart)} - ${formatDateZA(payment.periodEnd)}`, colPeriod, y, 10.5);
  rightText(money(payment.amountCents), right, y, 10.5);
  y -= 12;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 22;

  // Totals
  const totalsLabelX = right - 200;
  if (isTaxInvoice) {
    const excl = Math.round(payment.amountCents / (1 + VAT_RATE));
    const vat = payment.amountCents - excl;
    text(page, "Subtotal (excl. VAT)", totalsLabelX, y, 10, font, MUTED);
    rightText(money(excl), right, y, 10);
    y -= 16;
    text(page, `VAT (${Math.round(VAT_RATE * 100)}%)`, totalsLabelX, y, 10, font, MUTED);
    rightText(money(vat), right, y, 10);
    y -= 18;
  }
  text(page, "Total paid", totalsLabelX, y, 12, bold);
  rightText(money(payment.amountCents), right, y, 12, bold);
  y -= 40;

  // Payment details
  text(page, "PAYMENT DETAILS", MARGIN, y, 8.5, bold, MUTED);
  y -= 16;
  const details: [string, string][] = [
    ["Paid with", paidWith(payment)],
    ["Processed by", "Paystack"],
    ["Payment reference", payment.paystackReference],
  ];
  for (const [label, value] of details) {
    text(page, label, MARGIN, y, 10, font, MUTED);
    text(page, value, MARGIN + 130, y, 10);
    y -= 15;
  }

  // Footer
  const footer = `Thank you for using Crechely. Questions about this ${isTaxInvoice ? "invoice" : "receipt"}? Email ${SELLER.email}`;
  text(page, footer, MARGIN, MARGIN, 9, font, MUTED);

  return pdf.save();
}
