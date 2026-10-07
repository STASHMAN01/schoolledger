"use client";

// Loud alarms for the Crechely Android app. They live on the tablet itself
// (they ring with no internet and when the app is closed), so this page only
// works inside the app, which provides window.CrechelyApp. In a normal
// browser it just explains that.
import { useEffect, useState } from "react";
import { appGetAlarms, appRoutineCount, appRoutineEnabled, appSetRoutineEnabled, appOpenSettings, appSetAlarms, appTestAlarm, inApp, type AppAlarm } from "@/lib/appBridge";

const pad = (n: number) => String(n).padStart(2, "0");

export default function AlarmsPage() {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [alarms, setAlarms] = useState<AppAlarm[]>([]);
  const [time, setTime] = useState("08:15");
  const [label, setLabel] = useState("");
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [routineOn, setRoutineOn] = useState(true);
  const [routineCount, setRoutineCount] = useState(0);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read from the app on mount */
    setAvailable(inApp());
    setAlarms(appGetAlarms());
    setRoutineOn(appRoutineEnabled());
    setRoutineCount(appRoutineCount());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function save(next: AppAlarm[]) {
    setAlarms(next);
    appSetAlarms(next);
  }

  function add() {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const id = alarms.reduce((max, a) => Math.max(max, a.id), 0) + 1;
    save([...alarms, { id, hour: h, minute: m, label: label.trim() || "Alarm", weekdaysOnly, enabled: true }]);
    setLabel("");
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!available) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold text-foreground">Alarms</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Loud alarms are only available in the Crechely app on your tablet.
        </p>
      </div>
    );
  }

  const sorted = [...alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  const field = "min-h-11 rounded-lg border border-border bg-surface px-3 text-base text-foreground";
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Alarms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These ring loudly on this tablet at the time you set, even when the app is closed and the tablet is on silent.
          You will also get an alarm if the register has not been taken.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <label className="flex items-center gap-3 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={routineOn}
            onChange={(e) => {
              setRoutineOn(e.target.checked);
              appSetRoutineEnabled(e.target.checked);
            }}
            className="h-5 w-5"
          />
          Ring when the class routine changes
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Uses the class timetable (Timetable tab). It rings for 30 seconds at the start of each activity.{" "}
          {routineCount > 0 ? `${routineCount} timetable entries loaded on this tablet.` : "No timetable loaded yet: open the dashboard once while online."}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-3">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} aria-label="Time" />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What is it for? (e.g. Take the register)"
            className={`${field} min-w-0 flex-1`}
            maxLength={80}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={weekdaysOnly} onChange={(e) => setWeekdaysOnly(e.target.checked)} className="h-5 w-5" />
          Weekdays only
        </label>
        <button
          type="button"
          onClick={add}
          className="transition-standard min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
        >
          Add alarm
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alarms yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {sorted.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-foreground">
                  {pad(a.hour)}:{pad(a.minute)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.label} · {a.weekdaysOnly ? "Weekdays" : "Every day"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={a.enabled}
                  onChange={(e) => save(alarms.map((x) => (x.id === a.id ? { ...x, enabled: e.target.checked } : x)))}
                  className="h-5 w-5"
                />
                On
              </label>
              <button
                type="button"
                onClick={() => save(alarms.filter((x) => x.id !== a.id))}
                className="min-h-11 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-background"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={appTestAlarm}
          className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-background"
        >
          Test the alarm now
        </button>
        <button
          type="button"
          onClick={appOpenSettings}
          className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-background"
        >
          Notification settings
        </button>
      </div>
    </div>
  );
}
