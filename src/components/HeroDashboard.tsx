"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's product panel: a typeset Crechely dashboard that plays one
 * short sequence — a reminder goes out, a family settles, the outstanding
 * total comes down.
 *
 * Why this is typeset rather than a screenshot: Dylan asked for the
 * product to *move* (2 Oct 2026), and a JPEG cannot. The real screenshots
 * are still on the page further down, where attendance and documents are
 * shown as actual captured screens. This panel is clearly captioned as
 * sample data by its caller, exactly as the earlier typeset panel on this
 * page was — the names and figures below are invented and must never be
 * presented as a real school's.
 *
 * The sequence runs once, when the panel is first in view. It does not
 * loop: the hero should settle down and let someone read the headline.
 */

const PRESENT = "42 of 46";
const OWING_BEFORE = 4250;
const OWING_AFTER = 3400;

// Comma-grouped by hand rather than toLocaleString, which groups with a
// space in en-ZA and would read "R4 250" against "R4,990" elsewhere.
const rand = (n: number) => `R${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

type Step = "idle" | "sending" | "sent" | "settled";

export function HeroDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion: show the outcome immediately, skip the journey.
    if (reduced) {
      // Same pattern as Reveal.tsx: the preference can only be read in
      // the browser, so the finished state is set here rather than in
      // lazy initial state, which would differ between server and client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("settled");
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const play = () => {
      timers.push(setTimeout(() => setStep("sending"), 900));
      timers.push(setTimeout(() => setStep("sent"), 1900));
      timers.push(setTimeout(() => setStep("settled"), 3300));
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

  const settled = step === "settled";

  return (
    <div
      ref={ref}
      className="rounded-3xl bg-shell p-2.5 shadow-[var(--shadow-lift)] sm:p-3"
    >
      <div className="overflow-hidden rounded-2xl bg-background">
        {/* Window chrome, so the panel reads as a screen rather than a card. */}
        <div className="flex items-center gap-1.5 border-b border-border bg-surface px-3.5 py-2.5">
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="ml-2 font-mono text-[10px] text-muted">crechely.co.za</span>
        </div>

        <div className="grid grid-cols-[1fr] sm:grid-cols-[132px_1fr]">
          {/* Sidebar is hidden on phones: at 390px it would steal a third
              of the width from the numbers, which are the point. */}
          <aside className="hidden flex-col gap-0.5 bg-panel px-2.5 py-3.5 sm:flex">
            <span className="px-2 font-display text-xs font-semibold text-panel-foreground">
              Crechely
            </span>
            <span className="mt-4 px-2 font-mono text-[9px] uppercase tracking-[0.12em] text-panel-muted">
              Centre
            </span>
            {["Dashboard", "Children", "Attendance", "Fees", "Reminders"].map((item) => (
              <span
                key={item}
                className={`rounded-md px-2 py-1.5 text-[11px] ${
                  item === "Fees"
                    ? "bg-white/10 text-panel-foreground"
                    : "text-panel-muted"
                }`}
              >
                {item}
              </span>
            ))}
          </aside>

          <div className="relative p-3.5 sm:p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-sm font-semibold text-foreground">
                School Demo
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Today</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label="Present today" value={PRESENT} />
              <Metric
                label="Fees outstanding"
                value={rand(settled ? OWING_AFTER : OWING_BEFORE)}
                tone="warn"
                changed={settled}
              />
              <Metric label="Paid this month" value={settled ? "39" : "38"} tone="ok" changed={settled} />
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
              <p className="border-b border-border bg-background px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Fees
              </p>
              <FeeRow name="Pillay family" status="paid" />
              <FeeRow
                name="Mokoena family"
                status={settled ? "paid" : "owing"}
                amount="R850"
                highlight={step === "sending" || step === "sent"}
                changed={settled}
              />
              <FeeRow name="Naidoo family" status="paid" last />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">
                {settled ? "Everyone is up to date." : "1 family behind"}
              </span>
              <span
                className={`rounded-lg bg-brand px-2.5 py-1.5 text-[10px] font-semibold text-brand-foreground ${
                  step === "sending" ? "demo-ping" : ""
                }`}
              >
                Send all reminders
              </span>
            </div>

            {/* The notification, shown only while the reminder is going out. */}
            {step === "sent" && (
              <div className="demo-toast pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-foreground px-3 py-2 text-[11px] font-medium text-background shadow-[var(--shadow-lift)]">
                Reminder and statement emailed to the Mokoena family
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  changed = false,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
  changed?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <span className="block text-[9px] text-muted-foreground">{label}</span>
      <span
        key={value}
        className={`font-display text-sm font-semibold sm:text-base ${
          tone === "warn"
            ? "text-accent-soft-foreground"
            : tone === "ok"
              ? "text-success"
              : "text-foreground"
        } ${changed ? "demo-settle" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function FeeRow({
  name,
  status,
  amount,
  highlight = false,
  changed = false,
  last = false,
}: {
  name: string;
  status: "paid" | "owing";
  amount?: string;
  highlight?: boolean;
  changed?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 text-[11px] ${
        last ? "" : "border-b border-border"
      } ${highlight ? "bg-brand-soft" : ""}`}
    >
      <span className="text-foreground">{name}</span>
      <span
        key={status}
        className={`font-medium ${
          status === "paid" ? "text-success" : "text-accent-soft-foreground"
        } ${changed ? "demo-settle" : ""}`}
      >
        {status === "paid" ? "Paid ✓" : `${amount} owing`}
      </span>
    </div>
  );
}
