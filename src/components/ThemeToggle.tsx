"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// CHANGELOG (2026-09-19): this used to fall back to the visitor's OS/
// browser preference (matchMedia("prefers-color-scheme: dark")) whenever
// nothing was saved yet, so anyone with a dark-mode OS saw a dark site by
// default. Dylan wants light to be the actual default for everyone —
// dark only when someone explicitly picks it here — so the fallback is
// now always "light", full stop, regardless of OS setting.
const DEFAULT_THEME: Theme = "light";

/**
 * Explicit light/dark toggle. Defaults to light for every visitor; the
 * choice is saved and only changes for that visitor once they click this.
 * The actual switching happens via `data-theme` on <html> (see
 * globals.css); the blocking script in layout.tsx applies a saved choice
 * before first paint so there's no flash of the wrong theme.
 */
export function ThemeToggle() {
  // Starts null so the icon doesn't render (and mismatch) before the
  // client can read localStorage — see the fixed-size wrapper below,
  // which keeps the header from jumping once it does render.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Reads from localStorage, which doesn't exist during SSR — this has
    // to run as a mount effect, not a lazy initializer, to avoid a
    // hydration mismatch between server and client markup.
    const stored = window.localStorage.getItem("theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored === "light" || stored === "dark" ? stored : DEFAULT_THEME);
  }, []);

  function toggle() {
    const next: Theme = (theme ?? DEFAULT_THEME) === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="transition-standard flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
    >
      {theme === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : theme === "light" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
      ) : (
        // Not yet mounted — invisible placeholder holding the same box size.
        <span className="block h-[18px] w-[18px]" />
      )}
    </button>
  );
}
