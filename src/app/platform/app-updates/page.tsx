"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, PageHeader, Textarea } from "@/components/ui";

// Publish a new Android app version (Dylan, 9 Oct 2026). Every tablet and
// phone running the app then shows "New update available" and can install
// it from inside the app. See src/lib/appRelease.ts.

type Latest = { versionCode: number; versionName: string; notes: string | null; sizeBytes: number; publishedAt: string };

export default function AppUpdatesPage() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [versionCode, setVersionCode] = useState("");
  const [versionName, setVersionName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/platform/app-release");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLatest(data.latest);
        if (data.latest) setVersionCode(String(data.latest.versionCode + 1));
      } else setError(data.error ?? "Could not load the current version.");
      setLoaded(true);
    })();
  }, []);

  async function publish() {
    if (!file) return;
    setError(null);
    setDone(null);
    const meta = { versionCode: Number(versionCode), versionName, notes };
    try {
      setBusy("Preparing…");
      const start = await fetch("/api/platform/app-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meta, sizeBytes: file.size }),
      });
      const started = await start.json().catch(() => ({}));
      if (!start.ok) throw new Error(started.error ?? "Could not start the upload.");

      setBusy("Uploading the APK…");
      const put = await fetch(started.uploadUrl, { method: "PUT", headers: { "Content-Type": started.contentType }, body: file });
      if (!put.ok) throw new Error("The upload didn't go through. Try again.");

      setBusy("Publishing…");
      const fin = await fetch("/api/platform/app-release", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
      const finished = await fin.json().catch(() => ({}));
      if (!fin.ok) throw new Error(finished.error ?? "Could not publish it.");

      setLatest(finished.latest);
      setDone(`Version ${finished.latest.versionName} is live. Apps will offer the update the next time they open.`);
      setVersionCode(String(finished.latest.versionCode + 1));
      setVersionName("");
      setNotes("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="App updates"
        description="Upload a new version of the Android app. Everyone using the app sees “New update available” and can install it from inside the app."
      />

      <Card as="div" className="mb-5 p-4">
        <p className="text-sm font-medium text-foreground">Current version</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {!loaded
            ? "Loading…"
            : latest
              ? `${latest.versionName} (version code ${latest.versionCode}), published ${new Date(latest.publishedAt).toLocaleString()}`
              : "Nothing published yet."}
        </p>
      </Card>

      <Card as="div" className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">APK file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-foreground"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Version code</label>
            <Input type="number" min={1} value={versionCode} onChange={(e) => setVersionCode(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Version name</label>
            <Input value={versionName} maxLength={40} placeholder="e.g. 1.2.0" onChange={(e) => setVersionName(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Must match <code>versionCode</code> and <code>versionName</code> in android/app/build.gradle.kts for the APK you
          upload, and the code must go up by at least 1 every release.
        </p>
        <Textarea
          rows={2}
          maxLength={500}
          value={notes}
          placeholder="What's new (optional), e.g. Teachers can take photos with the camera"
          onChange={(e) => setNotes(e.target.value)}
          aria-label="What's new"
        />
        {error && <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
        {done && (
          <p role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
            {done}
          </p>
        )}
        <Button onClick={publish} disabled={!!busy || !file || !versionCode || !versionName.trim()}>
          {busy ?? "Publish update"}
        </Button>
      </Card>
    </div>
  );
}
