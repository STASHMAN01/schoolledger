"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // "danger" for anything destructive/hard-to-undo (voiding a payment,
  // archiving a record, revoking access) — everything else defaults to
  // the normal brand color.
  variant?: "primary" | "danger";
};

/**
 * A styled, in-design-system replacement for window.confirm(). Native
 * confirm() dialogs look like a browser warning (jarring, inconsistent
 * across OS/browser, easy for a non-technical user to blow past without
 * reading) — this renders as a normal app modal instead, and is the same
 * async/await shape as confirm() so call sites barely change:
 *
 *   const { confirm, dialog } = useConfirmDialog();
 *   if (!(await confirm({ title: "...", description: "..." }))) return;
 *   ...
 *   return <>{dialog}{...rest of page}</>;
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    setOptions(null);
    resolver.current?.(result);
    resolver.current = null;
  }

  const dialog = options ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => close(false)}
    >
      <Card
        className="animate-in w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="font-display text-base font-semibold text-foreground">
          {options.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{options.description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => close(false)}>
            {options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={options.variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={() => close(true)}
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Card>
    </div>
  ) : null;

  return { confirm, dialog };
}
