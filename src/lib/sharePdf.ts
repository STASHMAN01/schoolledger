// Hands a PDF to the phone's own share sheet (WhatsApp, Mail, Messages,
// Save to Files, ...) via the Web Share API. Same approach as the child
// page's Share button: the PDF is fetched into the app and passed over as
// a real file, rather than relying on whatever buttons the phone's PDF
// viewer happens to show.

import { appShareFile, inApp } from "@/lib/appBridge";

export function canShareFiles(): boolean {
  if (inApp()) return true; // the Android app shares through its own bridge
  return typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;
}

export type ShareResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

export async function sharePdfFromUrl(url: string, fallbackName = "document.pdf"): Promise<ShareResult> {
  if (appShareFile(url, fallbackName)) return { ok: true };
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, cancelled: false, message: "Could not load the file." };
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;
    const file = new File([blob], filename, { type: "application/pdf" });
    if (!navigator.canShare?.({ files: [file] })) {
      return { ok: false, cancelled: false, message: "Sharing isn't supported on this device. Use Download instead." };
    }
    await navigator.share({ files: [file], title: filename });
    return { ok: true };
  } catch (err) {
    // Closing the share sheet throws AbortError: a normal outcome, not an error.
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, cancelled: true, message: "" };
    }
    return { ok: false, cancelled: false, message: "Could not share the file." };
  }
}
