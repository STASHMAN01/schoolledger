"use client";

// Centre Management > Forms (Dylan 23 Sept): everything to hand to parents
// in one place --
//   1. the school's permanent online application link for NEW families,
//   2. a one-time link for an existing child's parent to update details,
//   3. blank copies of every form template to print.
// Pre-filled forms for one child are still generated on that child's
// profile (they're saved there with dated history).
import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { FORM_TYPES, FORM_TYPE_LABELS, MONEY_FORM_TYPES } from "@/lib/forms/types";

type ChildOption = { id: string; firstName: string; lastName: string; parentEmail: string | null; archived: boolean; exitDate: string | null };

function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input readOnly value={value} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Link" />
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            // Clipboard blocked: the link is selectable in the box.
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

export default function FormsPage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canMoney = permissions.includes("VIEW_MONEY");

  // 1. School link
  const [schoolUrl, setSchoolUrl] = useState<string | null>(null);
  const [schoolLoading, setSchoolLoading] = useState(!isTeacher);
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [schoolError, setSchoolError] = useState<string | null>(null);

  // 2. Per-child link
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [childId, setChildId] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [childBusy, setChildBusy] = useState(false);
  const [childResult, setChildResult] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [childError, setChildError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const base = `/api/organizations/${organizationId}`;
    try {
      const kidsRes = await fetch(`${base}/children`);
      const kids = await kidsRes.json().catch(() => ({}));
      if (kidsRes.ok) {
        const active = (kids.children as ChildOption[]).filter((c) => !c.archived && !c.exitDate);
        setChildren(active);
        setChildId((prev) => prev || active[0]?.id || "");
      }
    } catch {
      setChildError("Couldn't load your children list.");
    }
    if (!isTeacher) {
      try {
        const res = await fetch(`${base}/apply-link`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setSchoolUrl(data.url);
        else setSchoolError(data.error ?? "Couldn't load the application link.");
      } catch {
        setSchoolError("Couldn't load the application link.");
      } finally {
        setSchoolLoading(false);
      }
    }
  }, [organizationId, isTeacher]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function makeSchoolLink() {
    if (
      schoolUrl &&
      !window.confirm("Replace the link? The current link will stop working for anyone you've already sent it to.")
    ) {
      return;
    }
    setSchoolBusy(true);
    setSchoolError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/apply-link`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSchoolUrl(data.url);
      else setSchoolError(data.error ?? "Couldn't create the link.");
    } catch {
      setSchoolError("Couldn't create the link — check your connection and try again.");
    } finally {
      setSchoolBusy(false);
    }
  }

  async function makeChildLink() {
    if (!childId) return;
    setChildBusy(true);
    setChildError(null);
    setChildResult(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/children/${childId}/parent-form-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChildError(data.error ?? "Couldn't create the link.");
        return;
      }
      setChildResult({ url: data.url, emailSent: !!data.emailSent });
    } catch {
      setChildError("Couldn't create the link — check your connection and try again.");
    } finally {
      setChildBusy(false);
    }
  }

  const selectedChild = children.find((c) => c.id === childId);
  const blankForms = FORM_TYPES.filter((t) => canMoney || !MONEY_FORM_TYPES.includes(t));

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader title="Forms" description="Online forms for parents, and blank forms to print." />

      {!isTeacher && (
        <Card as="div" className="mb-6 p-5">
          <h2 className="font-display mb-1 text-sm font-semibold text-foreground">Online application — new families</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            One link for your website, WhatsApp or email. Parents don&apos;t need an account. Each application waits in
            Admissions → Online submissions, and nothing is saved until you approve it.
          </p>
          {schoolLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : schoolUrl ? (
            <div className="flex flex-col gap-3">
              <CopyBox value={schoolUrl} />
              <div>
                <Button size="sm" variant="ghost" onClick={makeSchoolLink} disabled={schoolBusy}>
                  {schoolBusy ? "Replacing…" : "Replace link (stops the old one working)"}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={makeSchoolLink} disabled={schoolBusy}>
              {schoolBusy ? "Creating…" : "Create the application link"}
            </Button>
          )}
          {schoolError && <p className="mt-3 text-sm text-danger">{schoolError}</p>}
        </Card>
      )}

      <Card as="div" className="mb-6 p-5">
        <h2 className="font-display mb-1 text-sm font-semibold text-foreground">Update form — existing child</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          A one-time link for a parent to fill in or update their child&apos;s details and ID photos. It works once and
          expires after 7 days.
        </p>
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrolled children yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="form-child">Child</Label>
              <Select
                id="form-child"
                value={childId}
                onChange={(e) => {
                  setChildId(e.target.value);
                  setChildResult(null);
                }}
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={sendEmail}
                disabled={!selectedChild?.parentEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              {selectedChild?.parentEmail
                ? `Also email it to ${selectedChild.parentEmail}`
                : "No parent email on file — copy the link and send it yourself"}
            </label>
            <div>
              <Button onClick={makeChildLink} disabled={childBusy || !childId}>
                {childBusy ? "Creating…" : "Create link"}
              </Button>
            </div>
            {childResult && (
              <div className="flex flex-col gap-2">
                <CopyBox value={childResult.url} />
                {sendEmail && (
                  <p className={`text-sm ${childResult.emailSent ? "text-success" : "text-danger"}`}>
                    {childResult.emailSent
                      ? "Emailed to the parent."
                      : "The email couldn't be sent (email isn't set up yet) — copy the link and send it on WhatsApp instead."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {childError && <p className="mt-3 text-sm text-danger">{childError}</p>}
      </Card>

      <Card as="div" className="p-5">
        <h2 className="font-display mb-1 text-sm font-semibold text-foreground">Blank forms to print</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          On your letterhead, with blank lines to fill in by hand. To get a form already filled in with a child&apos;s
          details, open the child&apos;s profile (Enrolled → click their name).
        </p>
        <div className="divide-y divide-border">
          {blankForms.map((t) => (
            <div key={t} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
              <span className="text-sm text-foreground">{FORM_TYPE_LABELS[t]}</span>
              <a
                href={`/api/organizations/${organizationId}/forms/blank?formType=${t}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Download PDF
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
