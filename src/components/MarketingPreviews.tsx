// Real screenshots of the live Crechely dashboard, captured from the
// "School Demo" account (seed/sample children, all enrolled the same day,
// no real family's data) — not typeset mockups. Each is captioned as a
// demo school wherever it's used.
//
// Cropped tight to the content: the app's two navigation bars and the
// page's left/right margins are cut away, so the panel shows the screen
// itself rather than a shrunk-down browser window. Source crops live in
// scratchpad/screenshots-final; the uncropped captures are in
// scratchpad/screenshots-raw.
//
// The frame deliberately carries no title bar. It used to, and it read as
// a stutter: the frame said "Attendance" and the screenshot immediately
// below it said "Attendance" again. The screenshot already names itself.

import Image from "next/image";

function Screenshot({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = "(min-width: 1024px) 512px, 90vw",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className="overflow-hidden border border-border-strong bg-surface">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="block w-full"
        sizes={sizes}
        // The hero shot is the largest paint on the page; everything
        // below the fold keeps next/image's default lazy loading.
        priority={priority}
      />
    </div>
  );
}

export function FeesPreview({ priority = false, sizes }: { priority?: boolean; sizes?: string }) {
  return (
    <Screenshot
      src="/screenshots/fees.jpg"
      alt="The Crechely accounting screen for a demo school: outstanding fees of R426,000, amount paid this month, accounts due, reminders and active children"
      // Cropped narrower than the other three (813px, not 1176): this one
      // sits beside the headline rather than filling a column, and at the
      // wider crop the figures were too small to read at hero size.
      width={813}
      height={312}
      priority={priority}
      sizes={sizes}
    />
  );
}

export function RemindersPreview() {
  return (
    <Screenshot
      src="/screenshots/reminders.jpg"
      alt="Crechely's payment reminders screen, with a button to email every family who owes fees and an option to turn on automatic reminders"
      width={1176}
      height={314}
    />
  );
}

export function AttendancePreview() {
  return (
    <Screenshot
      src="/screenshots/attendance.jpg"
      alt="Crechely's attendance register for one class, each child marked Present, with a Save register button"
      width={1176}
      height={448}
    />
  );
}

export function DocumentsPreview() {
  return (
    <Screenshot
      src="/screenshots/documents.jpg"
      alt="Crechely's missing documents list, showing which children still need a birth certificate, clinic card or parent ID"
      width={1176}
      height={452}
    />
  );
}
