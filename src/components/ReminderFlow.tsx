"use client";

import { useEffect, useRef, useState } from "react";
import { AppFrame, DemoToastSlot } from "@/components/demo/AppFrame";

/**
 * The money moment, demonstrated on the real Payment reminders screen:
 * the "Send all reminders by email" card, the All / Never reminded /
 * Already reminded filters, and the list of families with an outstanding
 * balance — then one press, and each family turns to reminded.
 *
 * This is Dylan's storyboard (2 Oct 2026) and it stops where his did, at
 * "reminder sent". It does not go on to show anyone paying: sending a
 * reminder is not a payment, and the panel should not suggest otherwise.
 *
 * Redrawn rather than screenshotted so it can move, and matched to the
 * real screen — see src/components/demo/AppFrame.tsx.
 */

const FAMILIES = [
  { name: "Lerato Mokoena", klass: "Baby Bees", amount: "R 1,050.00" },
  { name: "Aiden Pillay", klass: "Grasshoppers", amount: "R 750.00" },
  { name: "Anika Venter", klass: "Ladybugs", amount: "R 420.00" },
];

export function ReminderFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState(0);
  const [pressing, setPressing] = useState(false);
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
      setSent(FAMILIES.length);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let stopped = false;

    const run = () => {
      if (stopped) return;
      setSent(0);
      setToast(false);
      timers.push(setTimeout(() => setPressing(true), 900));
      timers.push(
        setTimeout(() => {
          setPressing(false);
          setToast(true);
        }, 1800),
      );
      FAMILIES.forEach((_, i) => {
        timers.push(setTimeout(() => setSent(i + 1), 2200 + i * 450));
      });
      // Hold the finished state well past the toast, then start again.
      timers.push(setTimeout(run, 2200 + FAMILIES.length * 450 + 4500));
    };

    if (typeof IntersectionObserver === "undefined") {
      run();
      return () => {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            run();
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    return () => {
      stopped = true;
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const allSent = sent >= FAMILIES.length;

  return (
    <div ref={ref}>
      <AppFrame tab="Reminders">
        <p className="font-display text-sm font-semibold text-foreground">Payment reminders</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          Every child with an outstanding balance. Email everyone at once, turn
          on automatic reminders, or send one at a time.
        </p>

        {/* "Send all reminders by email" card, as on the real screen. */}
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-foreground">Send all reminders by email</p>
            <p className="mt-0.5 text-[8px] text-muted-foreground">
              {FAMILIES.length} parents with an email owe R 2,220.00 in total.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-md bg-brand px-2 py-1 text-[9px] font-semibold text-brand-foreground ${
              pressing ? "demo-ping" : ""
            }`}
          >
            Send all reminders
          </span>
        </div>

        {/* Filter pills, as on the real screen. The counts move as the
            reminders go out, which is what those filters are for. */}
        <div className="mt-2 flex gap-1">
          <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[8px] font-semibold text-brand-soft-foreground">
            All
          </span>
          <span className="rounded-md px-1.5 py-0.5 text-[8px] text-muted-foreground">
            Never reminded {FAMILIES.length - sent}
          </span>
          <span className="rounded-md px-1.5 py-0.5 text-[8px] text-muted-foreground">
            Already reminded {sent}
          </span>
        </div>

        <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-surface">
          {FAMILIES.map((f, i) => {
            const done = i < sent;
            return (
              <div
                key={f.name}
                className={`flex items-center justify-between gap-3 px-2.5 py-1.5 ${
                  i === FAMILIES.length - 1 ? "" : "border-b border-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px] border border-border-strong"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[9px] font-medium text-foreground">
                    {f.name}
                    <span className="ml-1 font-normal text-muted-foreground">{f.klass}</span>
                  </span>
                </div>
                <span className="shrink-0 text-right text-[9px]">
                  <span className="font-medium text-danger">{f.amount}</span>
                  <span
                    key={done ? "done" : "never"}
                    className={`ml-1.5 ${
                      done ? "text-success demo-settle" : "text-muted-foreground"
                    }`}
                  >
                    {done ? "reminded ✓" : "never reminded"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <DemoToastSlot>
          {toast
            ? allSent
              ? `${FAMILIES.length} reminders emailed, each with the family's statement attached`
              : "Sending reminders…"
            : null}
        </DemoToastSlot>
      </AppFrame>
    </div>
  );
}
