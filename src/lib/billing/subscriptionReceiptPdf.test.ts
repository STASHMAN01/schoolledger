import { describe, it, expect } from "vitest";
import {
  formatReceiptNumber,
  generateSubscriptionReceiptPdf,
  receiptFilename,
} from "./subscriptionReceiptPdf";

const payment = {
  receiptNumber: 7,
  paystackReference: "T478560488399908",
  amountCents: 49900,
  currencyCode: "ZAR",
  paidAt: new Date("2026-09-28T08:05:00Z"),
  periodStart: new Date("2026-09-28T08:05:00Z"),
  periodEnd: new Date("2026-10-28T08:05:00Z"),
  planName: "Crechely Monthly",
  planInterval: "monthly",
  channel: "card",
  cardBrand: "visa",
  cardLast4: "4081",
};

describe("subscription receipts", () => {
  it("numbers receipts CRE-000001 style", () => {
    expect(formatReceiptNumber(7)).toBe("CRE-000007");
    expect(formatReceiptNumber(1234567)).toBe("CRE-1234567");
  });

  it("names the file after the receipt number and payment date", () => {
    expect(receiptFilename(payment)).toBe("Crechely-receipt-CRE-000007-2026-09-28.pdf");
  });

  it("produces a PDF", async () => {
    const bytes = await generateSubscriptionReceiptPdf(payment, {
      name: "Dees Duckling Centre",
      addressLine1: "12 Example Road",
      addressLine2: null,
      province: "Gauteng",
      contactEmail: "admin@example.com",
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("doesn't fail on characters the PDF font can't draw (emoji in a school name)", async () => {
    const bytes = await generateSubscriptionReceiptPdf(payment, {
      name: "Little Stars 🌟 Crèche",
      addressLine1: null,
      addressLine2: null,
      province: null,
      contactEmail: null,
    });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
