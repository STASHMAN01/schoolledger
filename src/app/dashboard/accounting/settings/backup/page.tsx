"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../../OrgContext";
import { Button, Card, PageHeader } from "@/components/ui";

type ExportEntry = {
  id: string;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

export default function BackupPage() {
  const { organizationId, permissions } = useOrg();
  const canExport = permissions.includes("EXPORT_DATA");
  const canSeeLog = permissions.includes("VIEW_ACTIVITY_LOG");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<ExportEntry[]>([]);

  const loadRecent = useCallback(async () => {
    if (!canSeeLog) return;
    try {
      const res = await fetch(`/api/organizations/${organizationId}/audit?entityTypes=Export`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setRecent((data.entries ?? []).slice(0, 10));
    } catch {
      // The log is a nice-to-have on this page; never block the backup on it.
    }
  }, [organizationId, canSeeLog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    if (canExport) loadRecent();
  }, [canExport, loadRecent]);

  async function download() {
    setBusy(true);
    setError(null);
    setPassword(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/export`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "The backup could not be created. Please try again.");
        return;
      }
      const pw = res.headers.get("X-Export-Password");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "crechely-backup.zip";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setPassword(pw);
      loadRecent();
    } catch {
      setError("The backup could not be created. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the password is still visible to copy by hand.
    }
  }

  if (!canExport) {
    return (
      <div className="animate-in max-w-3xl">
        <PageHeader title="Backup & export" />
        <Card className="p-4 text-sm text-muted-foreground">
          Only an admin can download a full backup of the school&apos;s data.
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Backup & export"
        description="Download everything Crechely holds for your school — children, guardians, classes, fees, payments, attendance, forms, photos and the activity log — as one password-protected ZIP file."
      />

      <Card className="mb-6 p-4">
        <Button onClick={download} disabled={busy}>
          {busy ? "Preparing backup… this can take up to a minute" : "Download full backup"}
        </Button>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {password && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Your backup password</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="select-all rounded-md bg-background px-3 py-2 font-mono text-base tracking-wider text-foreground">
                {password}
              </code>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Save this password now. Crechely doesn&apos;t store it and can&apos;t show it again. You&apos;ll need
              7-Zip (free) to open this file.
            </p>
          </div>
        )}
      </Card>

      {canSeeLog && (
        <>
          <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Recent exports</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups downloaded yet.</p>
          ) : (
            <Card className="divide-y divide-border">
              {recent.map((e) => (
                <div key={e.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-foreground">{e.actor?.name ?? "Unknown user"}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
