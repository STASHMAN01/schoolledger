"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrg } from "../OrgContext";
import { Button, Card } from "@/components/ui";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const SNOOZE_MS = 30 * 60 * 1000;

/**
 * From 12:00 school time on weekdays, pops up on a class teacher's screen
 * until today's daily summary is sent (Dylan, 4 Oct 2026). "Later" hides
 * it for 30 minutes; it never blocks the register or an incident report.
 */
export function DailySummaryPrompt() {
  const { organizationId, role } = useOrg();
  const pathname = usePathname();
  const isTeacher = role === "TEACHER";
  const [due, setDue] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/daily-summary`);
      if (!res.ok) return;
      const data = await res.json();
      setDue(Boolean(data.isDue && !data.summary && !data.noClass));
    } catch {
      // Offline or a blip: try again on the next tick.
    }
    setNow(Date.now());
  }, [organizationId]);

  useEffect(() => {
    if (!isTeacher) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first check on mount, then on a timer
    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [isTeacher, check, pathname]);

  const onFormPage =
    pathname.startsWith("/dashboard/centre/daily-summary") || pathname.startsWith("/dashboard/centre/reports");
  if (!isTeacher || !due || onFormPage || now < snoozedUntil) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="animate-in w-full max-w-sm p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Time for today&apos;s daily report</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Five quick questions about how the day went: injuries, illness, the routine, the children and anything that
          needs attention. It takes a couple of minutes.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setSnoozedUntil(Date.now() + SNOOZE_MS);
              setNow(Date.now());
            }}
          >
            Later
          </Button>
          <Link
            href="/dashboard/centre/daily-summary"
            className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
          >
            Fill it in now
          </Link>
        </div>
      </Card>
    </div>
  );
}
