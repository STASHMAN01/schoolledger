"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrg } from "../OrgContext";
import { Button } from "@/components/ui";
import { schoolClock } from "@/lib/dailySummary";
import { alertsForDay, dueAlert, type RoutineAlert, type RoutineItem } from "@/lib/routineAlerts";
import { playSound } from "@/lib/routineSounds";

const TICK_MS = 5_000;
const REFRESH_MS = 10 * 60 * 1000;
const BANNER_MS = 60_000;
const MUTE_KEY = "crechely.routineSoundsMuted";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * Chimes on a class tablet whenever its routine moves on (Dylan, 4 Oct
 * 2026). Browsers only allow sound after a tap, so a teacher starts the day
 * with one button. It only works while the app is open with the screen on;
 * "Keep screen on" asks the tablet not to sleep.
 */
export function RoutineSounds() {
  const { organizationId, role } = useOrg();
  const isTeacher = role === "TEACHER";

  const [items, setItems] = useState<RoutineItem[]>([]);
  const [timezone, setTimezone] = useState("Africa/Johannesburg");
  const [hasToday, setHasToday] = useState(false);
  const [on, setOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const [banner, setBanner] = useState<RoutineAlert | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const lastMinutesRef = useRef(0);
  const mutedRef = useRef(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved mute choice once
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      // Storage unavailable: start unmuted.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/schedule`);
      if (!res.ok) return;
      const data = await res.json();
      const tz: string = data.timezone ?? "Africa/Johannesburg";
      const list: RoutineItem[] = data.items ?? [];
      setItems(list);
      setTimezone(tz);
      setHasToday(alertsForDay(list, schoolClock(tz).weekday).length > 0);
    } catch {
      // Offline: keep what we have.
    }
  }, [organizationId]);

  useEffect(() => {
    if (!isTeacher) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load, then pick up routine edits
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [isTeacher, load]);

  const releaseWake = useCallback(() => {
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  const acquireWake = useCallback(async () => {
    try {
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock || wakeRef.current) return;
      wakeRef.current = await nav.wakeLock.request("screen");
    } catch {
      // Not supported or refused: the chimes still work while the screen is on.
    }
  }, []);

  // The clock: every few seconds, play whatever alert has just come due.
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const clock = schoolClock(timezone);
      const alerts = alertsForDay(items, clock.weekday);
      if (clock.minutes < lastMinutesRef.current) lastMinutesRef.current = clock.minutes; // passed midnight
      const due = dueAlert(alerts, lastMinutesRef.current, clock.minutes);
      lastMinutesRef.current = clock.minutes;
      if (!due) return;
      setBanner(due);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS);
      const ctx = audioRef.current;
      if (ctx && !mutedRef.current) {
        ctx.resume().catch(() => {});
        playSound(ctx, due.sound);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [on, items, timezone]);

  // Keep the screen awake while the day is running, and take it back after
  // the tablet returns from another app.
  useEffect(() => {
    if (!on || !keepAwake) {
      releaseWake();
      return;
    }
    acquireWake();
    function onVisible() {
      if (document.visibilityState === "visible") {
        wakeRef.current = null;
        acquireWake();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [on, keepAwake, acquireWake, releaseWake]);

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      releaseWake();
      audioRef.current?.close().catch(() => {});
    },
    [releaseWake]
  );

  function startDay() {
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor && !audioRef.current) audioRef.current = new Ctor();
      audioRef.current?.resume().catch(() => {});
      // A short test chime so the teacher knows it works.
      if (audioRef.current && !mutedRef.current) playSound(audioRef.current, "chime");
    } catch {
      // No audio support: the on-screen banner still works.
    }
    lastMinutesRef.current = schoolClock(timezone).minutes;
    setOn(true);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable: the choice lasts until the page reloads.
    }
  }

  if (!isTeacher || items.length === 0) return null;

  if (!on) {
    if (!hasToday) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
        <p className="min-w-0 flex-1 text-sm text-foreground">Turn on routine sounds so you hear when it&apos;s time for the next activity.</p>
        <Button onClick={startDay}>Start the day</Button>
      </div>
    );
  }

  return (
    <>
      {banner && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-40 bg-brand px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center text-sm font-medium text-white shadow-lg"
        >
          {banner.kind === "end" ? banner.label : `Now: ${banner.label}`}
        </div>
      )}
      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground shadow-md">
        <span>Routine sounds {muted ? "muted" : "on"}</span>
        <button type="button" onClick={toggleMute} className="font-medium text-brand underline underline-offset-2">
          {muted ? "Unmute" : "Mute"}
        </button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={keepAwake} onChange={(e) => setKeepAwake(e.target.checked)} />
          Keep screen on
        </label>
      </div>
    </>
  );
}
