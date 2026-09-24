"use client";

// App-wide safety net (Dylan 23 Sept: "if a button does nothing there
// should be an error message explaining"). Any action on a dashboard page
// that fails in a way the page itself didn't handle -- lost connection, the
// server returning an error page instead of data -- ends up as an
// "unhandled rejection". Instead of silently doing nothing, show a plain
// message the user can act on. Pages still show their own specific errors
// where they have them; this only catches what slips through.
import { useEffect, useState } from "react";

export function ErrorCatcher() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function onRejection() {
      setMessage(
        navigator.onLine
          ? "Something didn't work — Crechely couldn't finish that. Please try again, and if it keeps happening, contact support."
          : "You're offline — check your internet connection, then try again."
      );
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-danger/30 bg-surface p-4 text-sm text-danger shadow-lg sm:bottom-6"
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        className="min-h-9 shrink-0 rounded-lg px-2 font-medium text-foreground hover:bg-background"
      >
        Dismiss
      </button>
    </div>
  );
}
