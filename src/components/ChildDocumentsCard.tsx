"use client";

// Documents on a child's profile (Dylan, 30 Sept 2026): each document the
// school requires (and the optional ones), whether it's on file, and
// buttons to view, upload or remove. Missing required ones are marked, and
// the parent can be sent a link to upload them.
import { useCallback, useEffect, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { DocumentUploadButton } from "@/components/DocumentUploadButton";
import { ParentDocumentsLink } from "@/components/ParentDocumentsLink";
import { DOCUMENT_TYPES, type MissingDocument } from "@/lib/documents";

type Doc = {
  id: string;
  type: string;
  guardianId: string | null;
  fileName: string | null;
  contentType: string;
  source: string;
  createdAt: string;
};
type GuardianLite = { id: string; firstName: string; lastName: string };

type Row = { key: string; type: string; label: string; hint: string; guardianId: string | null; required: boolean };

export function ChildDocumentsCard({
  organizationId,
  childId,
  childFirstName,
  schoolName,
  guardians,
  parentPhone,
  parentEmail,
  canManage,
}: {
  organizationId: string;
  childId: string;
  childFirstName: string;
  schoolName: string;
  guardians: GuardianLite[];
  parentPhone: string | null;
  parentEmail: string | null;
  canManage: boolean;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [required, setRequired] = useState<string[]>([]);
  const [missing, setMissing] = useState<MissingDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/organizations/${organizationId}`;

  const load = useCallback(async () => {
    const res = await fetch(`${base}/children/${childId}/documents`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't load documents.");
      return;
    }
    setDocs(data.documents);
    setRequired(data.required);
    setMissing(data.missing);
  }, [base, childId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function upload(row: Row, file: { dataUrl: string; fileName: string }): Promise<string | null> {
    const res = await fetch(`${base}/children/${childId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: row.type,
        guardianId: row.guardianId ?? undefined,
        fileName: file.fileName,
        file: file.dataUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Upload failed. Please try again.";
    await load();
    return null;
  }

  async function remove(doc: Doc) {
    if (!window.confirm("Remove this document from the child's file?")) return;
    const res = await fetch(`${base}/children/${childId}/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't remove it.");
      return;
    }
    load();
  }

  const rows: Row[] = [];
  for (const t of DOCUMENT_TYPES) {
    const isRequired = required.includes(t.type);
    if (t.perGuardian && guardians.length > 0) {
      for (const g of guardians) {
        rows.push({
          key: `${t.type}-${g.id}`,
          type: t.type,
          label: `${t.label} — ${g.firstName} ${g.lastName}`.trim(),
          hint: t.hint,
          guardianId: g.id,
          required: isRequired,
        });
      }
    } else {
      rows.push({ key: t.type, type: t.type, label: t.label, hint: t.hint, guardianId: null, required: isRequired });
    }
  }
  // A parent's ID not linked to any parent on file (uploaded before the
  // parents were added, or its parent was removed) still shows, so it can
  // be viewed or removed.
  const guardianIds = new Set(guardians.map((g) => g.id));
  if (guardians.length > 0) {
    for (const t of DOCUMENT_TYPES.filter((x) => x.perGuardian)) {
      if ((docs ?? []).some((d) => d.type === t.type && (!d.guardianId || !guardianIds.has(d.guardianId)))) {
        rows.push({
          key: `${t.type}-unlinked`,
          type: t.type,
          label: `${t.label} — not linked to a parent`,
          hint: "",
          guardianId: "unlinked",
          required: false,
        });
      }
    }
  }
  const docsFor = (row: Row) =>
    (docs ?? []).filter(
      (d) =>
        d.type === row.type &&
        (row.guardianId === "unlinked"
          ? !d.guardianId || !guardianIds.has(d.guardianId)
          : row.guardianId
            ? d.guardianId === row.guardianId
            : true)
    );
  const requiredRows = rows.filter((r) => r.required || r.guardianId === "unlinked");
  const optionalRows = rows.filter((r) => !r.required && r.guardianId !== "unlinked");

  const renderRow = (row: Row) => {
    const onFile = docsFor(row);
    return (
      <li key={row.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {row.label}{" "}
            {onFile.length > 0 ? (
              <Badge variant="success">On file</Badge>
            ) : row.required ? (
              <Badge variant="danger">Missing</Badge>
            ) : (
              <Badge variant="neutral">Optional</Badge>
            )}
          </p>
          {onFile.length === 0 && <p className="text-xs text-muted-foreground">{row.hint}</p>}
          {onFile.map((d) => (
            <p key={d.id} className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <a href={`${base}/documents/${d.id}`} target="_blank" rel="noopener" className="text-brand underline">
                View {d.contentType === "application/pdf" ? "PDF" : "photo"}
              </a>
              <span>
                Added {new Date(d.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                {d.source === "parent" ? " by the parent" : ""}
              </span>
              {canManage && (
                <button type="button" className="underline hover:text-danger" onClick={() => remove(d)}>
                  Remove
                </button>
              )}
            </p>
          ))}
        </div>
        {canManage && row.guardianId !== "unlinked" && (
          <DocumentUploadButton label={onFile.length ? "Add another" : "Upload"} onUpload={(f) => upload(row, f)} />
        )}
      </li>
    );
  };

  return (
    <Card as="div" className="mb-6 p-5" id="documents">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Documents{" "}
          {docs &&
            (missing.length > 0 ? (
              <Badge variant="danger">{missing.length} missing</Badge>
            ) : required.length > 0 ? (
              <Badge variant="success">All required on file</Badge>
            ) : null)}
        </h2>
      </div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {docs === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {canManage && missing.length > 0 && (
            <div className="mb-3">
              <ParentDocumentsLink
                organizationId={organizationId}
                childId={childId}
                childFirstName={childFirstName}
                schoolName={schoolName}
                parentPhone={parentPhone}
                parentEmail={parentEmail}
                missingLabels={missing.map((m) => m.label)}
              />
            </div>
          )}
          {requiredRows.length > 0 && <ul className="divide-y divide-border">{requiredRows.map(renderRow)}</ul>}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-brand">Other documents (optional)</summary>
            <ul className="divide-y divide-border">{optionalRows.map(renderRow)}</ul>
          </details>
        </>
      )}
    </Card>
  );
}

