"use client";

// Photos attached to a classwork entry or an incident report (Dylan, 8 Oct
// 2026: "teachers take pictures whenever they do an activity, a picture of
// the injury").
//
// The photo is shrunk on the tablet first, then uploaded straight to the
// bucket with a short-lived link from our own server, so it never passes
// through the website itself. Viewing goes back through the server, which
// checks who is asking before handing out a link that expires. Nothing here
// is a public URL: these are children.
import { useRef, useState } from "react";

export type Photo = { id: string; caption: string | null; contentType: string };

const MAX_DIMENSION = 1600;
const TARGET_BYTES = 600 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Shrinks a camera photo to something that uploads quickly on school wifi. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This tablet can't process photos.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) return blob;
    if (blob && quality === 0.4) return blob;
  }
  throw new Error("Could not prepare that photo.");
}

export function PhotoAttachments({
  organizationId,
  kind,
  targetId,
  photos,
  canAdd,
  canRemove,
  onChanged,
}: {
  organizationId: string;
  kind: "CLASSWORK" | "REPORT";
  targetId: string;
  photos: Photo[];
  canAdd: boolean;
  canRemove: boolean;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const blob = await shrinkPhoto(file);
        const contentType = blob.type === "application/pdf" ? "application/pdf" : "image/jpeg";

        const start = await fetch(`/api/organizations/${organizationId}/uploads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            contentType,
            sizeBytes: blob.size,
            ...(kind === "CLASSWORK" ? { classworkEntryId: targetId } : { childReportId: targetId }),
          }),
        });
        const started = await start.json().catch(() => ({}));
        if (!start.ok) throw new Error(started.error ?? "Could not start the upload.");

        const put = await fetch(started.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!put.ok) throw new Error("The photo didn't upload. Check the signal and try again.");

        const confirm = await fetch(`/api/organizations/${organizationId}/uploads/${started.fileId}`, {
          method: "PUT",
        });
        if (!confirm.ok) {
          const problem = await confirm.json().catch(() => ({}));
          throw new Error(problem.error ?? "The photo didn't save.");
        }
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

  return (
    <div className="mt-2">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <a
                href={`/api/organizations/${organizationId}/files/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL from our own API */}
                <img
                  src={`/api/organizations/${organizationId}/files/${p.id}`}
                  alt={p.caption ?? "Photo"}
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
              </a>
              {canRemove && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={busy}
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs text-danger shadow"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="transition-standard mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-background disabled:opacity-60"
          >
            {busy ? "Adding photo…" : photos.length > 0 ? "Add another photo" : "Add a photo"}
          </button>
        </>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
