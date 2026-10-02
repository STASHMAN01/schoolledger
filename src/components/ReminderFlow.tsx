"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The money moment, demonstrated rather than described: a list of families
 * who are behind, one press of "Send all reminders", and each one turns to
 * "Reminder sent". This is the storyboard Dylan asked for on 2 Oct 2026 —
 * owing → send → notification → sent.
 *
 * Typeset, not a screenshot, because the point is the transition. The
 * families and balances are invented and the caller captions the panel as
 * sample data; the real captured screens are further down the page.
 *
 * It loops, unlike the hero, because this one IS the explanation — someone
 * who arrives mid-cycle should get to watch it from the start. There is a
 * long pause between runs so it never reads as a flashing advert, and
 * reduced motion stops it entirely on the finished state.
 */

const FAMILIES = [
  { name: "Mokoena family", amount: "R1,050", child: "Grade R" },
  { name: "Naidoo family", amount: "R750", child: "Baby Bees" },
  { name: "Venter family", amount: "R420", child: "Ladybugs" },
];

export function ReminderFlow() {
  const ref = useRef<HTMLDivElement>(null);
  // -1 = nothing sent yet; 0..n-1 = that many rows sent; n = all sent.
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
      // Same pattern as Reveal.tsx: the preference can only be read in
      // the browser, so the finished state is set here rather than in
      // lazy initial state, which would differ between server and client.
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
      timers.push(setTimeout(() => setPressing(true), 800));
      timers.push(
        setTimeout(() => {
          setPressing(false);
          setToast(true);
        }, 1700),
      );
      FAMILIES.forEach((_, i) => {
        timers.push(setTimeout(() => setSent(i + 1), 2100 + i * 450));
      });
      // Hold the finished state, then start again.
      timers.push(setTimeout(run, 2100 + FAMILIES.length * 450 + 4200));
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
    <div ref={ref} className="rounded-3xl bg-shell p-2.5 shadow-[var(--shadow-lift)] sm:p-3">
      <div className="relative overflow-hidden rounded-2xl bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="font-display text-sm font-semibold text-foreground">
            Payment reminders
          </span>
          <span
            className={`rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-brand-foreground ${
              pressing ? "demo-ping" : ""
            }`}
          >
            Send all reminders
          </span>
        </div>

        <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2 border-b border-border bg-background px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>Family</span>
          <span>Balance</span>
          <span className="text-right">Status</span>
        </div>

        {FAMILIES.map((f, i) => {
          const done = i < sent;
          return (
            <div
              key={f.name}
              className={`grid grid-cols-[1.4fr_0.8fr_1fr] items-center gap-2 px-4 py-2.5 text-[11px] sm:text-xs ${
                i === FAMILIES.length - 1 ? "" : "border-b border-border"
              }`}
            >
              <span className="text-foreground">
                {f.name}
                <span className="block text-[9px] text-muted-foreground">{f.child}</span>
              </span>
              <span className="font-medium text-foreground">{f.amount}</span>
              <span
                key={done ? "done" : "owing"}
                className={`text-right font-medium ${
                  done ? "text-success demo-settle" : "text-accent-soft-foreground"
                }`}
              >
                {done ? "Reminder sent ✓" : "Owing"}
              </span>
            </div>
          );
        })}

        {toast && (
          <div className="demo-toast pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-foreground px-3 py-2 text-[11px] font-medium text-background shadow-[var(--shadow-lift)]">
            {allSent
              ? `${FAMILIES.length} reminders sent, each with the family's statement attached`
              : "Sending reminders…"}
          </div>
        )}
      </div>
    </div>
  );
}
