"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { appInstallUpdate, appVersionCode } from "@/lib/appBridge";

// "New update available" inside the Android app (Dylan, 9 Oct 2026: it
// "should be available to update for everyone"). Shown to every signed-in
// user of the app, any role, any school, whenever /platform/app-updates has
// a newer version than the one installed. Invisible in a normal browser.

type Update = { versionName: string; notes: string | null; sizeBytes: number };
type State = "idle" | "downloading" | "installing" | "permission" | "failed";

const MESSAGES: Record<Exclude<State, "idle">, string> = {
  downloading: "Downloading the update…",
  installing: "Follow the steps on screen to install it.",
  permission: "Allow Crechely to install updates on the screen that opened, then come back and tap Update again.",
  failed: "The download didn't work. Check the internet connection and try again.",
};

export function AppUpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [state, setState] = useState<State>("idle");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const installed = appVersionCode();
    if (installed === null) return;
    (async () => {
      const res = await fetch(`/api/mobile/app-update?versionCode=${installed}`).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (data?.available) setUpdate({ versionName: data.versionName, notes: data.notes, sizeBytes: data.sizeBytes });
    })();
    const onState = (e: Event) => setState((e as CustomEvent<State>).detail);
    window.addEventListener("crechely-update", onState);
    return () => window.removeEventListener("crechely-update", onState);
  }, []);

  async function install() {
    setState("downloading");
    // Ask again for a fresh link: the one from page load may have expired.
    const res = await fetch(`/api/mobile/app-update?versionCode=${appVersionCode() ?? 0}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!data?.downloadUrl || !appInstallUpdate(data.downloadUrl)) setState("failed");
  }

  if (!update || hidden) return null;
  const busy = state === "downloading";
  const mb = update.sizeBytes ? ` (${(update.sizeBytes / 1024 / 1024).toFixed(1)} MB)` : "";

  return (
    <div role="status" className="mb-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">New update available</p>
          <p className="text-sm text-muted-foreground">
            Crechely {update.versionName}
            {mb}
            {update.notes ? ` · ${update.notes}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setHidden(true)} disabled={busy}>
            Later
          </Button>
          <Button onClick={install} disabled={busy}>
            {busy ? "Downloading…" : "Update"}
          </Button>
        </div>
      </div>
      {state !== "idle" && <p className="mt-2 text-sm text-foreground">{MESSAGES[state]}</p>}
    </div>
  );
}
