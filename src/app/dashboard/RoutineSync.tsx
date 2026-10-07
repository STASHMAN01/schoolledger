"use client";

// Inside the Android app, a teacher's tablet rings at every change in their
// class timetable. The app can't read the timetable itself, so this quietly
// hands it over whenever the dashboard opens (and again when the app comes
// back to the front). Does nothing in a normal browser.
import { useEffect } from "react";
import { useOrg } from "./OrgContext";
import { appRoutineEnabled, appSetRoutine, inApp } from "@/lib/appBridge";

type Item = { dayOfWeek: number; startTime: string; activity: string };

export function RoutineSync() {
  const { organizationId, role } = useOrg();

  useEffect(() => {
    if (role !== "TEACHER" || !inApp()) return;
    let cancelled = false;

    async function sync() {
      if (!appRoutineEnabled()) return;
      try {
        const res = await fetch(`/api/organizations/${organizationId}/schedule`);
        if (!res.ok) return;
        const data = (await res.json()) as { items?: Item[] };
        if (cancelled || !data.items) return;
        appSetRoutine(
          data.items.map((i) => {
            const [h, m] = i.startTime.split(":").map(Number);
            return { day: i.dayOfWeek, hour: h, minute: m, activity: i.activity };
          }),
        );
      } catch {
        // offline: the alarms already on the tablet keep working
      }
    }

    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [organizationId, role]);

  return null;
}
