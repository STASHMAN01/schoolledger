import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { monthLabel } from "@/lib/files";

// A printable monthly attendance register for one class: a row per child,
// a column per weekday, "P" for present and "A" for absent, with totals.
// A day nobody was marked on is left blank (a public holiday, or a day the
// register simply wasn't taken) rather than counted as an absence.
// Same pdf-lib approach as reportPdf.ts and statementPdf.ts.

export type RegisterOrg = {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
};

export type RegisterChild = {
  firstName: string;
  lastName: string;
  // day-of-month (1-31) -> status
  marks: Map<number, "PRESENT" | "ABSENT">;
};

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const ROW_HEIGHT = 18;

export function weekdaysOfMonth(monthKey: string): number[] {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d);
  }
  return out;
}

export async function generateAttendanceRegisterPdf(
  org: RegisterOrg,
  className: string,
  monthKey: string,
  children: RegisterChild[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const days = weekdaysOfMonth(monthKey);
  const nameWidth = 150;
  const totalWidth = 38;
  const dayWidth = Math.min(
    26,
    (PAGE_WIDTH - MARGIN * 2 - nameWidth - totalWidth * 2) / Math.max(days.length, 1)
  );
  const tableWidth = nameWidth + dayWidth * days.length + totalWidth * 2;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function header(first: boolean) {
    if (first) {
      page.drawText(org.name, { x: MARGIN, y: y - 14, size: 15, font: bold, color: rgb(0.1, 0.1, 0.1) });
      y -= 22;
      const address = [org.addressLine1, org.addressLine2, org.province].filter(Boolean).join(", ");
      if (address) {
        page.drawText(address, { x: MARGIN, y: y - 8, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
      }
      y -= 6;
      page.drawText(`Attendance register: ${className}, ${monthLabel(monthKey)}`, {
        x: MARGIN,
        y: y - 12,
        size: 12,
        font: bold,
      });
      y -= 26;
    }
    // Column headings
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_HEIGHT,
      width: tableWidth,
      height: ROW_HEIGHT,
      color: rgb(0.93, 0.95, 0.97),
    });
    page.drawText("Child", { x: MARGIN + 4, y: y - 12.5, size: 8.5, font: bold });
    days.forEach((d, i) => {
      page.drawText(String(d), {
        x: MARGIN + nameWidth + i * dayWidth + dayWidth / 2 - (d > 9 ? 4 : 2),
        y: y - 12.5,
        size: 8,
        font: bold,
      });
    });
    const totalsX = MARGIN + nameWidth + dayWidth * days.length;
    page.drawText("Present", { x: totalsX + 3, y: y - 12.5, size: 7.5, font: bold });
    page.drawText("Absent", { x: totalsX + totalWidth + 4, y: y - 12.5, size: 7.5, font: bold });
    y -= ROW_HEIGHT;
  }

  header(true);

  const dayTotals = days.map(() => ({ present: 0, absent: 0 }));

  for (const child of children) {
    if (y - ROW_HEIGHT < MARGIN + 30) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      header(false);
    }
    page.drawLine({
      start: { x: MARGIN, y: y - ROW_HEIGHT },
      end: { x: MARGIN + tableWidth, y: y - ROW_HEIGHT },
      thickness: 0.4,
      color: rgb(0.8, 0.8, 0.8),
    });
    const name = `${child.firstName} ${child.lastName}`;
    let shown = name;
    while (shown.length > 3 && font.widthOfTextAtSize(shown, 8.5) > nameWidth - 8) {
      shown = shown.slice(0, -2);
    }
    page.drawText(shown === name ? name : `${shown}…`, { x: MARGIN + 4, y: y - 12.5, size: 8.5, font });

    let present = 0;
    let absent = 0;
    days.forEach((d, i) => {
      const status = child.marks.get(d);
      if (!status) return;
      const isPresent = status === "PRESENT";
      if (isPresent) {
        present++;
        dayTotals[i].present++;
      } else {
        absent++;
        dayTotals[i].absent++;
      }
      page.drawText(isPresent ? "P" : "A", {
        x: MARGIN + nameWidth + i * dayWidth + dayWidth / 2 - 3,
        y: y - 12.5,
        size: 8.5,
        font: bold,
        color: isPresent ? rgb(0.1, 0.45, 0.2) : rgb(0.75, 0.15, 0.15),
      });
    });
    const totalsX = MARGIN + nameWidth + dayWidth * days.length;
    page.drawText(String(present), { x: totalsX + 14, y: y - 12.5, size: 8.5, font });
    page.drawText(String(absent), { x: totalsX + totalWidth + 14, y: y - 12.5, size: 8.5, font });
    y -= ROW_HEIGHT;
  }

  if (children.length === 0) {
    page.drawText("No children in this class.", { x: MARGIN + 4, y: y - 14, size: 9, font });
    y -= ROW_HEIGHT;
  } else {
    if (y - ROW_HEIGHT < MARGIN + 30) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText("Present each day", { x: MARGIN + 4, y: y - 12.5, size: 8, font: bold });
    dayTotals.forEach((t, i) => {
      if (t.present + t.absent === 0) return;
      page.drawText(String(t.present), {
        x: MARGIN + nameWidth + i * dayWidth + dayWidth / 2 - (t.present > 9 ? 4 : 2),
        y: y - 12.5,
        size: 8,
        font,
      });
    });
  }

  const generatedOn = new Date().toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  for (const p of pdf.getPages()) {
    p.drawText(`P = present, A = absent, blank = not marked. Generated ${generatedOn} · ${org.name}`, {
      x: MARGIN,
      y: 18,
      size: 7.5,
      font,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  return pdf.save();
}

export function buildRegisterFilename(className: string, monthKey: string): string {
  const slug = className.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "class";
  return `attendance-register-${slug}-${monthKey}.pdf`;
}
