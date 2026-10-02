"use client";

// The Files section (Dylan, 2 Oct 2026): folders for every document the
// app produces. Shared by Accounting (Statements only) and Centre
// Management (Statements plus forms, reports and attendance registers).
// Which folders appear is decided by the API from the person's
// permissions -- this component just draws whatever comes back.
//
// Where you are lives in the URL (?folder=&month=&classId=), so the back
// button, bookmarks and the installed app's own back gesture all work.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/app/dashboard/OrgContext";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { FileEntry, FilesMode, FilesResponse } from "@/lib/files";
import { canShareFiles, sharePdfFromUrl } from "@/lib/sharePdf";

function FolderIcon() {
  return (
    <svg className="h-6 w-6 shrink-0 text-brand" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 6.75A2.25 2.25 0 0 1 5.25 4.5h3.69c.6 0 1.17.24 1.59.66l1.06 1.06c.14.14.33.22.53.22h6.63A2.25 2.25 0 0 1 21 8.69v8.56a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 17.25V6.75Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7l-4-4Z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}

function FolderRow({ href, title, subtitle }: { href: string; title: string; subtitle?: string }) {
  return (
    <Link
      href={href}
      className="transition-standard flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:bg-background"
    >
      <FolderIcon />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <span className="text-muted-foreground" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

function FileRow({ file }: { file: FileEntry }) {
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Only phones/tablets (and some desktops) can share files; check on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time feature detection on mount
    setCanShare(canShareFiles());
  }, []);

  async function share() {
    setSharing(true);
    setShareError(null);
    const result = await sharePdfFromUrl(file.downloadHref, `${file.name}.pdf`);
    if (!result.ok && !result.cancelled) setShareError(result.message);
    setSharing(false);
  }

  const buttonClass =
    "transition-standard rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background";
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileIcon />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="truncate text-xs text-muted-foreground">{file.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href={file.href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          Open
        </a>
        <a href={file.downloadHref} className={buttonClass}>
          Download
        </a>
        {file.shareable && canShare && (
          <button type="button" onClick={share} disabled={sharing} className={`${buttonClass} disabled:opacity-50`}>
            {sharing ? "Preparing…" : "Share"}
          </button>
        )}
      </div>
      {shareError && <p className="w-full text-xs text-danger">{shareError}</p>}
    </div>
  );
}

function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Folder path" className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-muted-foreground" aria-hidden="true">
              ›
            </span>
          )}
          {item.href ? (
            <Link href={item.href} className="text-brand hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Browser({ mode }: { mode: FilesMode }) {
  const { organizationId } = useOrg();
  const search = useSearchParams();
  const folder = search.get("folder");
  const month = search.get("month");
  const classId = search.get("classId");

  const [state, setState] = useState<{ key: string; data: FilesResponse | null; error: string | null } | null>(null);

  const base = `/dashboard/${mode}/files`;
  const requestKey = `${folder ?? ""}|${month ?? ""}|${classId ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ mode });
    if (folder) qs.set("folder", folder);
    if (month) qs.set("month", month);
    if (classId) qs.set("classId", classId);
    fetch(`/api/organizations/${organizationId}/files?${qs.toString()}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ key: requestKey, data: null, error: body.error ?? "Couldn't load these files. Please try again." });
        } else {
          setState({ key: requestKey, data: body as FilesResponse, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, data: null, error: "Couldn't load these files. Check your connection and try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, mode, folder, month, classId, requestKey]);

  // Only trust a response that belongs to the folder currently in the URL.
  const current = state && state.key === requestKey ? state : null;
  const data = current?.data ?? null;

  const rootLabel = "Files";
  let crumbs: { label: string; href?: string }[] = [{ label: rootLabel }];
  if (data && data.level !== "root") {
    const folderHref = `${base}?folder=${data.folder.key}`;
    crumbs = [{ label: rootLabel, href: base }];
    if (data.level === "months") {
      crumbs.push({ label: data.folder.label });
    } else {
      crumbs.push({ label: data.folder.label, href: folderHref });
      const monthHref = `${folderHref}&month=${data.month.key}`;
      if (data.level === "classes") crumbs.push({ label: data.month.label });
      else {
        crumbs.push({ label: data.month.label, href: monthHref });
        crumbs.push({ label: data.className });
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Files"
        description={
          mode === "accounting"
            ? "Statements, organised by month and class."
            : "Statements, forms, reports and registers, organised by month and class."
        }
      />

      {current?.error && (
        <p role="alert" className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground">
          {current.error}
        </p>
      )}

      {!current && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          {crumbs.length > 1 && crumbs[crumbs.length - 2].href && (
            <Link
              href={crumbs[crumbs.length - 2].href as string}
              className="transition-standard mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
            >
              <span aria-hidden="true">&larr;</span> Back
              <span className="sr-only"> to {crumbs[crumbs.length - 2].label}</span>
            </Link>
          )}
          <Crumbs items={crumbs} />

          {data.level === "root" &&
            (data.folders.length === 0 ? (
              <EmptyState
                title="No folders to show"
                description="You don't have permission to see any documents here. Ask an admin if you need access."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.folders.map((f) => (
                  <FolderRow key={f.key} href={`${base}?folder=${f.key}`} title={f.label} subtitle={f.hint} />
                ))}
              </div>
            ))}

          {data.level === "months" &&
            (data.months.length === 0 ? (
              <EmptyState
                title={`No ${data.folder.label.toLowerCase()} yet`}
                description="They'll appear here, by month, as soon as the first one is made."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.months.map((m) => (
                  <FolderRow key={m.key} href={`${base}?folder=${data.folder.key}&month=${m.key}`} title={m.label} />
                ))}
              </div>
            ))}

          {data.level === "classes" &&
            (data.classes.length === 0 ? (
              <EmptyState
                title="No classes to show"
                description="There are no classes you can open yet. A teacher needs a class assigned first."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.classes.map((c) => (
                  <FolderRow
                    key={c.id}
                    href={`${base}?folder=${data.folder.key}&month=${data.month.key}&classId=${c.id}`}
                    title={c.name}
                    subtitle={c.summary}
                  />
                ))}
              </div>
            ))}

          {data.level === "class" && (
            <div className="space-y-4">
              {data.folder.key === "statements" && (
                <p className="text-xs text-muted-foreground">
                  Opening a statement makes a fresh one from today&apos;s figures, so it may differ from the copy sent
                  earlier.
                </p>
              )}
              {data.files.length > 0 && (
                <Card className="divide-y divide-border">
                  {data.files.map((f) => (
                    <FileRow key={f.id} file={f} />
                  ))}
                </Card>
              )}
              {data.children.length > 0 && (
                <Card className="divide-y divide-border">
                  {data.children.map((child) => (
                    <div key={child.id}>
                      <p className="px-4 pt-3 text-sm font-semibold text-foreground">{child.name}</p>
                      {child.files.length === 0 ? (
                        <p className="px-4 pb-3 pt-1 text-xs text-muted-foreground">{child.emptyText}</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {child.files.map((f) => (
                            <FileRow key={f.id} file={f} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              )}
              {data.files.length === 0 && data.children.length === 0 && (
                <EmptyState
                  title="Nothing in this folder"
                  description="No documents were made for this class in this month."
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FilesBrowser({ mode }: { mode: FilesMode }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Browser mode={mode} />
    </Suspense>
  );
}
