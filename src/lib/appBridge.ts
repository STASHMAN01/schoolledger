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
