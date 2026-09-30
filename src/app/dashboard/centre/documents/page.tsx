"use client";

// Missing documents (Dylan, 30 Sept 2026): every current child still
// missing a document the school requires. Click a child to see exactly
// what's missing, upload it on their profile, or send the parent a link to
// upload it themselves. Admins choose which documents are required.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg, useHasPermission } from "../../OrgContext";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { ParentDocumentsLink } from "@/components/ParentDocumentsLink";
import { DOCUMENT_TYPES, type MissingDocument } from "@/lib/documents";

type ChildMissing = {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  missing: MissingDocument[];
};

export default function MissingDocumentsPage() {
  const { organizationId, organizationName } = useOrg();
  const canManage = useHasPermission("MANAGE_CHILDREN");
  const canSettings = useHasPermission("MANAGE_SETTINGS");
  const base = `/api/organizations/${organizationId}`;

  const [children, setChildren] = useState<ChildMissing[] | null>(null);
  const [required, setRequired] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${base}/documents/missing`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't load missing documents. Please refresh the page.");
      return;
    }
    setChildren(data.children);
    setRequired(data.required);
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function saveRequired() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`${base}/documents/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requiredDocuments: editing }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save. Please try again.");
      return;
    }
    setEditing(null);
    load();
  }

  const requiredLabels = DOCUMENT_TYPES.filter((t) => required.includes(t.type)).map((t) => t.label);

  return (
    <div className="animate-in">
      <PageHeader
        title="Missing documents"
        description="Children still missing a document your school requires. Click a child to see what's missing."
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <Card as="div" className="mb-6 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Required for every child</p>
            <p className="text-sm text-muted-foreground">
              {requiredLabels.length ? requiredLabels.join(" · ") : "Nothing is required at the moment."}
            </p>
          </div>
          {canSettings && editing === null && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(required)}>
              Change
            </Button>
          )}
        </div>
        {editing !== null && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted-foreground">
              Tick every document a child must have on file. Parents are asked for these on the online forms.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {DOCUMENT_TYPES.map((t) => (
                <li key={t.type}>
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={editing.includes(t.type)}
                      onChange={(e) =>
                        setEditing((prev) =>
                          e.target.checked ? [...(prev ?? []), t.type] : (prev ?? []).filter((x) => x !== t.type)
                        )
                      }
                    />
                    <span>
                      {t.label}
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={saveRequired} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      {children === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : children.length === 0 ? (
        <Card as="div" className="p-6 text-sm text-muted-foreground">
          {required.length ? "Every child has all the required documents on file." : "No documents are required."}
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {children.length} child{children.length === 1 ? "" : "ren"} missing documents
          </p>
          <Card as="div" className="divide-y divide-border">
            {children.map((c) => {
              const isOpen = open === c.id;
              return (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : c.id)}
                    aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-background"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="block text-xs text-muted-foreground">{c.className}</span>
                    </span>
                    <Badge variant="danger">{c.missing.length} missing</Badge>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-background/50 px-4 pb-4 pt-3">
                      <p className="mb-1 text-sm font-medium text-foreground">Still needed</p>
                      <ul className="mb-3 list-disc pl-5 text-sm text-foreground">
                        {c.missing.map((m) => (
                          <li key={`${m.type}-${m.guardianId ?? ""}`}>{m.label}</li>
                        ))}
                      </ul>
                      <div className="flex flex-col gap-3">
                        <Link
                          href={`/dashboard/centre/children/${c.id}#documents`}
                          className="text-sm text-brand underline underline-offset-2"
                        >
                          Upload on {c.firstName}&apos;s profile
                        </Link>
                        {canManage && (
                          <ParentDocumentsLink
                            organizationId={organizationId}
                            childId={c.id}
                            childFirstName={c.firstName}
                            schoolName={organizationName}
                            parentPhone={c.parentPhone}
                            parentEmail={c.parentEmail}
                            missingLabels={c.missing.map((m) => m.label)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
