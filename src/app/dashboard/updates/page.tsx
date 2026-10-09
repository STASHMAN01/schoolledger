"use client";

import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { appInstallUpdate, appVersionCode, inApp } from "@/lib/appBridge";

// Updates (Dylan, 9 Oct 2026): every role in every school can download the
// newest Crechely Android app from here. In a browser it downloads the
// APK; inside the app it installs the update directly. Versions are
// published on /platform/app-updates.

type Latest = { versionCode: number; versionName: string; notes: string | null; sizeBytes: number; publishedAt: string };
type State = "idle" | "downloading" | "installing" | "permission" | "failed";

const MESSAGES: Record<Exclude<State, "idle">, string> = {
  downloading: "Downloading…",
  installing: "Follow the steps on screen to install it.",
  permission: "Allow Crechely to install updates on the screen that opened, then come back and tap Install again.",
  failed: "That didn't work. Check the internet connection and try again.",
};

async function freshLink(): Promise<string | null> {
  const res = await fetch("/api/app/latest").catch(() => null);
  const data = await res?.json().catch(() => null);
  return data?.downloadUrl ?? null;
}

export default function UpdatesPage() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [app, setApp] = useState<{ inside: boolean; versionCode: number | null }>({ inside: false, versionCode: null });
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time detection on mount
    setApp({ inside: inApp(), versionCode: appVersionCode() });
    (async () => {
      const res = await fetch("/api/app/latest").catch(() => null);
      const data = await res?.json().catch(() => null);
      setLatest(data?.latest ?? null);
      setLoaded(true);
    })();
    const onState = (e: Event) => setState((e as CustomEvent<State>).detail);
    window.addEventListener("crechely-update", onState);
    return () => window.removeEventListener("crechely-update", onState);
  }, []);

  async function download() {
    setState("downloading");
    const url = await freshLink();
    if (!url) return setState("failed");
    if (app.inside) {
      if (!appInstallUpdate(url)) setState("failed");
    } else {
      window.location.href = url;
      setState("idle");
    }
  }

  const upToDate = app.inside && app.versionCode !== null && latest !== null && app.versionCode >= latest.versionCode;
  const tooOld = app.inside && app.versionCode === null;
  const size = latest?.sizeBytes ? `${(latest.sizeBytes / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="animate-in max-w-2xl">
      <PageHeader
        title="Updates"
        description="Get the newest Crechely app for your tablet or phone (Android)."
      />
      <Card as="div" className="space-y-3 p-5">
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">No app version has been published yet.</p>
        ) : (
          <>
            <div>
              <p className="font-display text-lg font-semibold text-foreground">Crechely {latest.versionName}</p>
              <p className="text-sm text-muted-foreground">
                {[size, `released ${new Date(latest.publishedAt).toLocaleDateString()}`].filter(Boolean).join(" · ")}
              </p>
              {latest.notes && <p className="mt-2 text-sm text-foreground">{latest.notes}</p>}
            </div>

            {upToDate ? (
              <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
                This tablet already has the latest version.
              </p>
            ) : tooOld ? (
              <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                This copy of the app is too old to update itself. Open <strong>crechely.co.za/dashboard/updates</strong> in
                Chrome on this tablet, download the app there and open the file to install it. After that, updates
                install from inside the app.
              </p>
            ) : (
              <>
                <Button onClick={download} disabled={state === "downloading"}>
                  {state === "downloading" ? "Downloading…" : app.inside ? "Install update" : "Download the app"}
                </Button>
                {!app.inside && (
                  <p className="text-xs text-muted-foreground">
                    On an Android tablet or phone: open the downloaded file and tap Install. If Android asks, allow
                    installing apps from your browser. Your sign-in and data stay as they are.
                  </p>
                )}
              </>
            )}
            {state !== "idle" && <p className="text-sm text-foreground">{MESSAGES[state]}</p>}
          </>
        )}
      </Card>
    </div>
  );
}
