"use client";

// Shared client-side image upload/compress control -- extracted from
// dashboard/accounting/settings/general/page.tsx (which has its own
// identical copy for the org logo/letterhead and is left untouched to
// avoid touching working Accounting-side code). Used by the Phase 2
// child/guardian profile photo fields. Resizes/re-compresses whatever the
// person picks down to something that comfortably fits as an inline
// data: URL server-side (see validation.ts's imageDataUrlSchema), so
// nobody has to manually shrink a photo from their phone first.
import { useRef, useState } from "react";
import { Button, Label } from "@/components/ui";

const MAX_DATA_URL_CHARS = 1_300_000;
const TARGET_DATA_URL_CHARS = 900_000;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that file — it may not be a valid image."));
    };
    img.src = url;
  });
}

function drawToDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  mimeType: string,
  quality?: number
): string {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image in this browser.");
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mimeType, quality);
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  const img = await loadImageElement(file);
  const preferPng = file.type === "image/png" || file.type === "image/gif";

  if (preferPng) {
    for (const dim of [1400, 1000, 700, 500, 350]) {
      const dataUrl = drawToDataUrl(img, dim, "image/png");
      if (dataUrl.length <= TARGET_DATA_URL_CHARS) return dataUrl;
    }
  }

  for (const dim of [1600, 1300, 1000, 800, 600, 450]) {
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const dataUrl = drawToDataUrl(img, dim, "image/jpeg", quality);
      if (dataUrl.length <= TARGET_DATA_URL_CHARS) return dataUrl;
    }
  }

  return drawToDataUrl(img, 300, "image/jpeg", 0.4);
}

export function ImageUploadField({
  label,
  helpText,
  value,
  disabled,
  round = false,
  onChange,
}: {
  label: string;
  helpText: string;
  value: string | null;
  disabled: boolean;
  round?: boolean;
  onChange: (dataUrl: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setCompressing(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_CHARS) {
        setError("Could not shrink that image enough — please try a simpler/smaller file.");
        return;
      }
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file — please try again.");
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a Next-optimizable remote image
          <img
            src={value}
            alt={label}
            className={
              round
                ? "h-16 w-16 rounded-full border border-border object-cover"
                : "h-16 max-w-[160px] rounded-lg border border-border object-contain"
            }
          />
        ) : (
          <div
            className={
              round
                ? "flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border-strong text-xs text-muted"
                : "flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border-strong text-xs text-muted"
            }
          >
            None
          </div>
        )}
        {!disabled && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={compressing}
                onClick={() => inputRef.current?.click()}
              >
                {compressing ? "Processing…" : value ? "Replace" : "Upload"}
              </Button>
              {value && !compressing && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
