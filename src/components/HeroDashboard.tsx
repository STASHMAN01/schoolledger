"use client";

import { useEffect, useRef, useState } from "react";
import { AppFrame, DemoToastSlot, StatTile } from "@/components/demo/AppFrame";

/**
 * The hero's product panel: the real Accounting screen, redrawn so it can
 * move, with a payment being recorded.
 *
 * Typeset rather than a screenshot because a JPEG cannot animate, but it
 * mirrors the actual screen — same chrome, same blue-header tiles, same
 * to-do card. See src/components/demo/AppFrame.tsx for why that matters.
 *
 * The figures are sample data and the caller captions them as such. The
 * sequence is deliberately the honest one: recording a payment is what
 * moves Outstanding down. Sending a reminder does not collect money, and
 * the panel never implies it does.
 */

// Formatted exactly as the app formats money on this screen -- a space
// after the R and two decimals ("R 426,000.00" in the real capture).
const rand = (n: number) =>
  `R ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.00`;

const OWING_BEFORE = 12_400;
const OWING_AFTER = 11_550;
const PAID_BEFORE = 18_250;
const PAID_AFTER = 19_100;

export function HeroDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const [recorded, setRecorded] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // Same pattern as Reveal.tsx: the preference can only be read in the
      // browser, so the finished state is set here rather than in lazy
      // initial state, which would differ between server and client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecorded(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const play = () => {
      timers.push(setTimeout(() => setToast(true), 1400));
      timers.push(setTimeout(() => setRecorded(true), 2000));
    };

    if (typeof IntersectionObserver === "undefined") {
      play();
      return () => timers.forEach(clearTimeout);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            play();
            io.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={ref}>
      <AppFrame tab="Home">
        <p className="font-display text-sm font-semibold text-foreground">Accounting</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          Good morning. Fees, payments and reminders for School Demo.
        </p>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-[1.55fr_1fr]">
          <div className="grid grid-cols-2 gap-1.5">
            <StatTile
              label="Outstanding"
              value={rand(recorded ? OWING_AFTER : OWING_BEFORE)}
              note="Tap to see by class"
              changed={recorded}
            />
            <StatTile
              label="Paid this month"
              value={rand(recorded ? PAID_AFTER : PAID_BEFORE)}
              note="Tap to see by class"
              changed={recorded}
            />
            <StatTile
              label="Accounts due"
              value={recorded ? "11" : "12"}
              note="Tap to see who owes"
              changed={recorded}
            />
            <StatTile
              label="Children"
              value="46"
              note="Active children"
            />
          </div>

          {/* The to-do card, as on the real screen. */}
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between bg-brand px-2 py-1">
              <span className="text-[9px] font-semibold text-brand-foreground">Your to-do list</span>
              <span className="rounded-full bg-danger px-1.5 text-[8px] font-bold text-danger-foreground">
                {recorded ? 2 : 3}
              </span>
            </div>
            <ul className="divide-y divide-border">
              <li className="flex items-center justify-between gap-2 px-2 py-1.5 text-[9px] text-foreground">
                Send payment reminders
                <span className="rounded-full bg-accent-soft px-1.5 text-[8px] font-semibold text-accent-soft-foreground">
                  12
                </span>
              </li>
              <li
                className={`px-2 py-1.5 text-[9px] ${
                  recorded
                    ? "text-muted line-through demo-settle"
                    : "text-foreground"
                }`}
              >
                Record the Mokoena payment
              </li>
              <li className="px-2 py-1.5 text-[9px] text-foreground">Review 2 applications</li>
            </ul>
          </div>
        </div>

        <DemoToastSlot>
          {toast
            ? recorded
              ? "Payment recorded · the family's balance updated"
              : "Recording R 850.00 from the Mokoena family…"
            : null}
        </DemoToastSlot>
      </AppFrame>
    </div>
  );
}
