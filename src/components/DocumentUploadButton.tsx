"use client";

// Pick a document (photo or PDF) and hand it back as a data: URL -- photos
// are shrunk first with the same helper as profile photos, so a picture
// straight from a phone camera uploads quickly (Dylan, 30 Sept 2026).
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { compressImageToDataUrl } from "@/components/ImageUploadField";
import { MAX_DOCUMENT_DATA_URL_CHARS } from "@/lib/documents";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

export async function fileToDocumentDataUrl(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    const dataUrl = await readAsDataUrl(file);
    if (dataUrl.length > MAX_DOCUMENT_DATA_URL_CHARS) {
      throw new Error("That PDF is too large (over 2 MB). Take a photo of the page instead.");
    }
    return dataUrl;
  }
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo or a PDF.");
  return compressImageToDataUrl(file);
}

export function DocumentUploadButton({
  label = "Upload",
  size = "sm",
  variant = "secondary",
  disabled,
  onUpload,
}: {
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  /** Called with the file; resolve with an error message to show, or null. */
  onUpload: (file: { dataUrl: string; fileName: string }) => Promise<string | null>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    setError(null);
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDocumentDataUrl(file);
      const problem = await onUpload({ dataUrl, fileName: file.name.slice(0, 200) });
      if (problem) setError(problem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that file. Please try again.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" size={size} variant={variant} disabled={disabled || busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
