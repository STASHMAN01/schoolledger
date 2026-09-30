"use client";

// "Ask the parent for missing documents" (Dylan, 30 Sept 2026): makes a
// documents-only link for this child (valid 7 days) and offers it to copy,
// send on WhatsApp, or email. The parent just uploads photos of what's
// missing -- each goes straight onto the child's file.
import { useState } from "react";
import { Button } from "@/components/ui";

function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "27" + d.slice(1);
  return d.length >= 10 ? d : null;
}

export function ParentDocumentsLink({
  organizationId,
  childId,
  childFirstName,
  schoolName,
  parentPhone,
  parentEmail,
  missingLabels,
  size = "sm",
}: {
  organizationId: string;
  childId: string;
  childFirstName: string;
  schoolName: string;
  parentPhone?: string | null;
  parentEmail?: string | null;
  missingLabels: string[];
  size?: "sm" | "md";
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"link" | "email" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(sendEmail: boolean) {
    setBusy(sendEmail ? "email" : "link");
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/organizations/${organizationId}/children/${childId}/parent-form-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "documents", sendEmail }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not create the link. Please try again.");
      return;
    }
    setUrl(data.url);
    if (sendEmail) setMessage(data.emailSent ? `Emailed to ${parentEmail}.` : "The link was made, but the email didn't send. Copy it instead.");
  }

  const text = url
    ? `Hi, this is ${schoolName}. We still need these documents for ${childFirstName}: ${missingLabels.join(", ")}. ` +
      `Please upload a clear photo of each here (the link works for 7 days): ${url}`
    : "";
  const wa = waNumber(parentPhone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Message and link copied.");
    } catch {
      setMessage("Copy didn't work here. Select the link below and copy it.");
    }
  }

  if (!url) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-2">
          <Button size={size} onClick={() => create(false)} disabled={busy !== null}>
            {busy === "link" ? "Making link…" : "Get link for parent"}
          </Button>
          {parentEmail && (
            <Button size={size} variant="secondary" onClick={() => create(true)} disabled={busy !== null}>
              {busy === "email" ? "Sending…" : "Email the parent a link"}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">
        Link for {childFirstName}&apos;s parent (works for 7 days). They only see the missing documents.
      </p>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground" />
      <div className="flex flex-wrap gap-2">
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
          >
            Send on WhatsApp
          </a>
        )}
        <Button size="sm" variant="secondary" onClick={copy}>
          Copy message
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
