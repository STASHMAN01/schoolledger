// "What it looks like" panels for the homepage features section (Dylan,
// 1 Oct 2026: "show features clearly with what each looks like"). These
// are real screenshots of the live Crechely dashboard — captured from the
// "School Demo" account (seed/sample children, all enrolled the same day,
// no real family's data) — not typeset mockups. Each is captioned as a
// demo school below, in src/app/page.tsx.
//
// Cropped tight to the content: the app's two navigation bars and the
// page's left/right margins are cut away, so the panel shows the screen
// itself rather than a shrunk-down browser window. Combined with the
// wider max-w-lg slot in page.tsx, the actual content renders roughly
// 1.8x larger than the first pass did, which was the complaint.
// Source crops live in scratchpad/screenshots-final; the uncropped
// captures are scratchpad/screenshots-raw.

import Image from "next/image";

function ScreenshotFrame({
  title,
  tag,
  src,
  alt,
  width,
  height,
}: {
  title: string;
  tag?: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <div className="overflow-hidden border border-border-strong bg-surface">
      <div className="flex items-baseline justify-between border-b border-border-strong px-4 py-2.5">
        <span className="font-display text-xs font-semibold text-foreground">{title}</span>
        {tag && <span className="font-mono text-[10px] text-muted-foreground">{tag}</span>}
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="block w-full"
        sizes="(min-width: 1024px) 512px, 90vw"
      />
    </div>
  );
}

export function FeesPreview() {
  return (
    <ScreenshotFrame
      title="Accounting — School Demo"
      tag="Live dashboard"
      src="/screenshots/fees.jpg"
      alt="Crechely accounting dashboard showing outstanding fees, amount paid this month, and accounts due, for a demo school of 30 children"
      width={1176}
      height={314}
    />
  );
}

export function RemindersPreview() {
  return (
    <ScreenshotFrame
      title="Payment reminders"
      tag="Live dashboard"
      src="/screenshots/reminders.jpg"
      alt="Crechely's payment reminders screen, showing the option to email all families who owe fees at once, or turn on automatic reminders"
      width={1176}
      height={314}
    />
  );
}

export function AttendancePreview() {
  return (
    <ScreenshotFrame
      title="Attendance"
      tag="Live dashboard"
      src="/screenshots/attendance.jpg"
      alt="Crechely's attendance register for a class, with every child marked Present and a Save register button"
      width={1176}
      height={448}
    />
  );
}

export function DocumentsPreview() {
  return (
    <ScreenshotFrame
      title="Missing documents"
      tag="Live dashboard"
      src="/screenshots/documents.jpg"
      alt="Crechely's missing documents list, showing which children still need a birth certificate, clinic card, or parent ID on file"
      width={1176}
      height={452}
    />
  );
}
