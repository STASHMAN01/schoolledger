"use client";

// The visual engine for the first-time guided walkthrough: a dimmed
// backdrop with a spotlight cutout around the current step's element and a
// popover describing it. Mounted once in the dashboard layout so it can
// spotlight header elements (mode switch, nav, Support) as well as
// page-body elements (tiles, to-do panel) -- see TourContext for how a
// page starts it and src/lib/tourSteps.ts for the step content.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "./OrgContext";
import { useTour } from "./TourContext";
import { CENTRE_TOUR_STEPS, ACCOUNTING_TOUR_STEPS, type TourStep } from "@/lib/tourSteps";
import { Button } from "@/components/ui";

const STEPS: Record<"centre" | "accounting", TourStep[]> = {
  centre: CENTRE_TOUR_STEPS,
  accounting: ACCOUNTING_TOUR_STEPS,
};
const NO_STEPS: TourStep[] = [];

type Rect = { top: number; left: number; width: number; height: number };

function measure(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourOverlay() {
  const { organizationId } = useOrg();
  const { activeTour, stop } = useTour();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const steps = useMemo(() => (activeTour ? STEPS[activeTour] : NO_STEPS), [activeTour]);

  const finish = useCallback(() => {
    if (activeTour) {
      fetch(`/api/organizations/${organizationId}/tour`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: activeTour }),
      }).catch(() => {
        // Best-effort -- worst case the tour just auto-opens again next visit.
      });
    }
    stop();
  }, [activeTour, organizationId, stop]);

  const next = useCallback(() => setStepIndex((i) => i + 1), []);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // Reset to the first step whenever a new tour starts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local step position to the (externally-owned) activeTour prop changing
    if (activeTour) setStepIndex(0);
  }, [activeTour]);

  // Locate + measure the current step's target, walking forward past any
  // step whose element isn't in the DOM right now rather than showing an
  // empty spotlight. If nothing from here on is present, the tour is done.
  useEffect(() => {
    if (!activeTour) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the spotlight once the (externally-owned) tour closes
      setRect(null);
      return;
    }
    let index = stepIndex;
    let found: Rect | null = null;
    while (index < steps.length) {
      const r = measure(steps[index].target);
      if (r) {
        found = r;
        break;
      }
      index += 1;
    }
    if (!found) {
      finish();
      return;
    }
    if (index !== stepIndex) {
      setStepIndex(index);
      return; // effect re-runs with the corrected index
    }
    setRect(found);
    document.querySelector(`[data-tour="${steps[index].target}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeTour, stepIndex, steps, finish]);

  // Keep the spotlight aligned if the page reflows while the tour is open.
  useEffect(() => {
    if (!activeTour) return;
    function reposition() {
      const r = measure(steps[stepIndex]?.target ?? "");
      if (r) setRect(r);
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [activeTour, stepIndex, steps]);

  useEffect(() => {
    if (!activeTour) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeTour, finish, next, back]);

  if (!activeTour || !rect) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;
  const PADDING = 6;
  const highlight = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  const POPOVER_WIDTH = 320;
  const GAP = 12;
  const spaceBelow = window.innerHeight - (highlight.top + highlight.height);
  const placeAbove = spaceBelow < 200 && highlight.top > 200;
  const popoverTop = placeAbove ? undefined : Math.min(highlight.top + highlight.height + GAP, window.innerHeight - 12);
  const popoverBottom = placeAbove ? window.innerHeight - highlight.top + GAP : undefined;
  const popoverLeft = Math.min(Math.max(highlight.left, 12), Math.max(12, window.innerWidth - POPOVER_WIDTH - 12));

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      <div className="fixed inset-0" />
      <div
        className="transition-standard pointer-events-none fixed rounded-xl outline outline-2 outline-brand"
        style={{
          top: highlight.top,
          left: highlight.left,
          width: highlight.width,
          height: highlight.height,
          boxShadow: "0 0 0 9999px rgba(12, 10, 9, 0.55)",
        }}
      />
      <div
        className="animate-in fixed w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-surface p-4 shadow-lg"
        style={{ top: popoverTop, bottom: popoverBottom, left: popoverLeft }}
      >
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h3 className="font-display mb-1.5 text-base font-semibold text-foreground">{step.title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{step.description}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="min-h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button variant="secondary" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={isLast ? finish : next}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
