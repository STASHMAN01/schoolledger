"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A full-screen sheet on phones and tablets, a centred card on large screens.
 * Title and × stay at the top, the footer (Save / Cancel) stays at the
 * bottom, and only the middle scrolls, so nothing is ever cut off. It is
 * rendered on document.body so no page animation or overflow can clip it.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onClick={() => !busy && onClose()}
    >
      <div
        className="animate-in flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[90dvh] sm:rounded-xl sm:border sm:border-border sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-3">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-2xl text-muted-foreground hover:bg-background"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
