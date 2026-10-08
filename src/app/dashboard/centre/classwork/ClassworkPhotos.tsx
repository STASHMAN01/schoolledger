"use client";

// Photos for one classwork entry (Dylan, 8 Oct 2026): a group activity gets
// up to 5 shared photos; an individual activity gets, per child in the
// class, an optional single photo of that child doing the activity. Either
// way, only an admin may remove a photo once it's uploaded -- a teacher can
// add but never delete, including their own.
//
// The photo is shrunk on the tablet first (see PhotoAttachments.shrinkPhoto),
// then uploaded straight to the bucket with a short-lived link from our own
// server, so it never passes through the website itself.
import { useRef, useState } from "react";
import { shrinkPhoto } from "@/components/PhotoAttachments";
import { MAX_GROUP_PHOTOS } from "@/lib/lessonPlan";

export type ClassworkPhoto = { id: string; caption: string | null; contentType: string; childId: string | null };
export type RosterChild = { id: string; firstName: string; lastName: string };

function Thumb({
  organizationId,
  photo,
  canRemove,
  busy,
  onRemove,
}: {
  organizationId: string;
  photo: ClassworkPhoto;
  canRemove: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative">
      <a
        href={`/api/organizations/${organizationId}/files/${photo.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL from our own API */}
        <img
          src={`/api/organizations/${organizationId}/files/${photo.id}`}
          alt={photo.caption ?? "Photo"}
          className="h-20 w-20 rounded-lg border border-border object-cover"
        />
      </a>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(photo.id)}
          disabled={busy}
          aria-label="Remove photo"
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs text-danger shadow"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function ClassworkPhotos({
  organizationId,
  entryId,
  activityType,
  photos,
  roster,
  canAdd,
  canRemove,
  onChanged,
}: {
  organizationId: string;
  entryId: string;
  activityType: "GROUP" | "INDIVIDUAL";
  photos: ClassworkPhoto[];
  /** The class roster -- only needed (and only fetched by the caller) for an INDIVIDUAL entry. */
  roster: RosterChild[];
  canAdd: boolean;
  canRemove: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Which child the next file picked is for (individual activity only).
  const pendingChildId = useRef<string | null>(null);

  async function upload(files: FileList | null, childId: string | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await shrinkPhoto(file);
      const contentType = blob.type === "application/pdf" ? "application/pdf" : "image/jpeg";

      const start = await fetch(`/api/organizations/${organizationId}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "CLASSWORK",
          contentType,
          sizeBytes: blob.size,
          classworkEntryId: entryId,
          ...(childId ? { childId } : {}),
        }),
      });
      const started = await start.json().catch(() => ({}));
      if (!start.ok) throw new Error(started.error ?? "Could not start the upload.");

      const put = await fetch(started.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
      if (!put.ok) throw new Error("The photo didn't upload. Check the signal and try again.");

      const confirm = await fetch(`/api/organizations/${organizationId}/uploads/${started.fileId}`, { method: "PUT" });
      if (!confirm.ok) {
        const problem = await confirm.json().catch(() => ({}));
        throw new Error(problem.error ?? "The photo didn't save.");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/organizations/${organizationId}/uploads/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onChanged();
    else setError("Could not remove that photo.");
  }

  if (activityType === "GROUP") {
    return (
      <div className="mt-2">
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <Thumb key={p.id} organizationId={organizationId} photo={p} canRemove={canRemove} busy={busy} onRemove={remove} />
            ))}
          </div>
        )}
        {canAdd && photos.length < MAX_GROUP_PHOTOS && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => upload(e.target.files, null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="transition-standard mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-background disabled:opacity-60"
            >
              {busy ? "Adding photo…" : `Add a photo (${photos.length}/${MAX_GROUP_PHOTOS})`}
            </button>
          </>
        )}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  // INDIVIDUAL: one row per child in the class, named, with that child's
  // photo (if any) or an add button.
  const byChild = new Map(photos.filter((p) => p.childId).map((p) => [p.childId as string, p]));
  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => upload(e.target.files, pendingChildId.current)}
      />
      <div className="divide-y divide-border rounded-lg border border-border">
        {roster.map((child) => {
          const photo = byChild.get(child.id);
          const name = `${child.firstName} ${child.lastName}`;
          return (
            <div key={child.id} className="flex items-center gap-3 p-2">
              {photo ? (
                <Thumb organizationId={organizationId} photo={photo} canRemove={canRemove} busy={busy} onRemove={remove} />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{name}</p>
                {canAdd && !photo && (
                  <button
                    type="button"
                    onClick={() => {
                      pendingChildId.current = child.id;
                      inputRef.current?.click();
                    }}
                    disabled={busy}
                    className="transition-standard mt-1 text-sm font-medium text-brand underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    {busy ? "Adding…" : "Add photo"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {roster.length === 0 && <p className="p-3 text-sm text-muted-foreground">No children in this class yet.</p>}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
