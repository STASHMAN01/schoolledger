// The Crechely Android app shows this website inside a native shell. The
// shell adds `window.CrechelyApp` so the page can ask for things a website
// can't do alone (loud alarms, sharing a file). In an ordinary browser the
// object doesn't exist and every helper here returns "not in the app".

export type AppAlarm = { id: number; hour: number; minute: number; label: string; weekdaysOnly: boolean; enabled: boolean };

type Bridge = {
  appVersion(): string;
  getAlarms(): string; // JSON array of AppAlarm
  setAlarms(json: string): void;
  testAlarm(): void;
  shareFile(url: string, name: string): void;
  openAppSettings(): void;
  getRoutineEnabled(): boolean;
  setRoutineEnabled(on: boolean): void;
  setRoutine(json: string): void;
  routineCount(): number;
  registerPush?(): void;
  /** Only in app builds that can update themselves (versionCode 2+). */
  appVersionCode?(): number;
  installUpdate?(url: string): void;
};

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { CrechelyApp?: Bridge }).CrechelyApp;
  return b ?? null;
}

export function inApp(): boolean {
  return bridge() !== null;
}

export function appGetAlarms(): AppAlarm[] {
  const b = bridge();
  if (!b) return [];
  try {
    const v = JSON.parse(b.getAlarms());
    return Array.isArray(v) ? (v as AppAlarm[]) : [];
  } catch {
    return [];
  }
}

export function appSetAlarms(alarms: AppAlarm[]): void {
  bridge()?.setAlarms(JSON.stringify(alarms));
}

export function appTestAlarm(): void {
  bridge()?.testAlarm();
}

export function appOpenSettings(): void {
  bridge()?.openAppSettings();
}

/** Hands a file (by URL on this site) to the tablet's share sheet. */
export function appShareFile(url: string, name: string): boolean {
  const b = bridge();
  if (!b) return false;
  b.shareFile(new URL(url, window.location.origin).toString(), name);
  return true;
}

export type RoutineAlarm = { day: number; hour: number; minute: number; activity: string };

export function appRoutineEnabled(): boolean {
  return bridge()?.getRoutineEnabled?.() ?? false;
}
export function appSetRoutineEnabled(on: boolean): void {
  bridge()?.setRoutineEnabled?.(on);
}
export function appRoutineCount(): number {
  return bridge()?.routineCount?.() ?? 0;
}
/** Sends the class timetable to the app so it can ring at every change. */
export function appSetRoutine(items: RoutineAlarm[]): void {
  bridge()?.setRoutine?.(JSON.stringify(items));
}

/**
 * Asks the app to (re-)send its push token to the server. The app also does
 * this on its own after a cold page load, but that native hook misses a
 * sign-in that redirects straight to /dashboard client-side without a full
 * page reload -- so the dashboard calls this itself every time it mounts.
 */
export function appRegisterPush(): void {
  bridge()?.registerPush?.();
}

/** The installed app's version code, or null in a browser or an app too old to update itself. */
export function appVersionCode(): number | null {
  const b = bridge();
  if (!b?.appVersionCode) return null;
  try {
    const v = Number(b.appVersionCode());
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Asks the app to download and install a new version. Progress comes back
 * as a "crechely-update" window event whose detail is one of
 * "downloading" | "installing" | "permission" | "failed".
 */
export function appInstallUpdate(url: string): boolean {
  const b = bridge();
  if (!b?.installUpdate) return false;
  b.installUpdate(url);
  return true;
}
