import Link from "next/link";
import { WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/support";

/**
 * A two-button bar pinned to the bottom of the landing page on phones:
 * WhatsApp us, and Start my free trial. Most owners reach the page on a
 * phone and would rather ask a question first, so the WhatsApp route is
 * one thumb-tap away from anywhere on the page, not only the FAQ and the
 * final section.
 *
 * Phones only (hidden from `sm` up). The page adds matching bottom
 * padding so the footer is never hidden underneath it.
 *
 * The WhatsApp button is deliberately the quieter of the two: WhatsApp's
 * own green with white text misses WCAG AA, so it's an outlined button
 * with a green icon, and the brand-blue button stays the main ask.
 */
export function MobileCtaBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
    >
      <div className="flex gap-2.5">
        {WHATSAPP_NUMBER && (
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-3 text-sm font-semibold text-foreground"
          >
            <WhatsAppIcon />
            WhatsApp us
          </a>
        )}
        <Link
          href="/register"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-3 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-brand)]"
        >
          Start my free trial
        </Link>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-[18px] w-[18px] shrink-0 fill-[#25d366]" aria-hidden="true">
      <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.8 5 2.3 7L4 29l7.3-2.3c1.9 1 4 1.6 6.2 1.6 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm5.9 16.9c-.3.8-1.5 1.5-2.4 1.6-.6.1-1.4.2-4-.8-3.4-1.4-5.5-4.8-5.7-5-.2-.2-1.3-1.8-1.3-3.4s.8-2.4 1.1-2.7c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.3.6-.7.9-.5 1.2.7 1.2 1.6 2 2.8 2.6.3.2.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.3.6.4 0 .1 0 .6-.1 1.1z" />
    </svg>
  );
}
