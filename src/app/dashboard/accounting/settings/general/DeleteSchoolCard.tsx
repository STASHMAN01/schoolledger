"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

// Admin-only "danger zone" at the bottom of Settings → General. Deleting
// moves the school into a 30-day trash (see /api/.../account/delete):
// everyone is locked out at once, an admin can restore it from the
// dashboard, and after 30 days it's permanently removed.
export function DeleteSchoolCard({
  organizationId,
  schoolName,
}: {
  organizationId: string;
  schoolName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMatches = confirmName.trim().toLowerCase() === schoolName.trim().toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/account/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete the school.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-10 border-danger/40 p-5">
      <h2 className="font-display text-base font-semibold text-danger">Delete school</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Removes {schoolName} for everyone on your team. It stays in the trash for 30 days and can
        be restored until then; after that it and all its children, payments and records are
        permanently deleted.
      </p>

      {!open ? (
        <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          Delete this school…
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="confirmSchoolName">
              Type <span className="font-semibold text-foreground">{schoolName}</span> to confirm
            </Label>
            <Input
              id="confirmSchoolName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Your password</Label>
            <div className="mt-1">
              <PasswordInput
                id="confirmPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" disabled={busy || !nameMatches || !password}>
              {busy ? "Deleting…" : "Delete school"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(false);
                setConfirmName("");
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
